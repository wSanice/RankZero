-- =====================================================================
-- 003 — Correção de dano dos bosses diários por classe/nível,
--        Boss Quinzenal, Boss de 90 Dias, nome sem espaço e
--        convites de guilda (enviar/aceitar).
-- Idempotente — pode rodar quantas vezes precisar no SQL Editor do Supabase.
--
-- OBS: este arquivo assume as tabelas/colunas criadas em schema.sql e no
-- bloco "007" (guilds, guild_members, global_boss_raids, daily_monsters).
-- Ele também recria colunas que hoje só existem no banco ao vivo
-- (hunter_name, tag, raid_members, global_bosses, global_boss_hits,
-- apply_global_boss_damage) para que este arquivo fique autocontido —
-- os "if not exists" tornam isso seguro mesmo se elas já existirem.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. NOME DE CAÇADOR SEM ESPAÇO
-- ------------------------------------------------------------------
alter table public.profiles add column if not exists hunter_name text;
alter table public.profiles add column if not exists tag text;

-- normaliza registros existentes antes de travar a constraint
update public.profiles
   set hunter_name = regexp_replace(trim(hunter_name), '\s+', '_', 'g')
 where hunter_name is not null and hunter_name ~ '\s';

alter table public.profiles drop constraint if exists chk_hunter_name_no_space;
alter table public.profiles
  add constraint chk_hunter_name_no_space check (hunter_name is null or hunter_name !~ '\s');

-- ------------------------------------------------------------------
-- 2. MONSTRO DIÁRIO: dano por nível/classe (fraqueza + bônus fixo)
-- ------------------------------------------------------------------
alter table public.daily_monsters add column if not exists weak_vs text;
alter table public.daily_monsters add column if not exists bonus_mult numeric not null default 1.2;
alter table public.daily_monsters add column if not exists boss_level integer;

-- ------------------------------------------------------------------
-- 3. BOSS QUINZENAL E BOSS DE 90 DIAS (globais, por ciclo, cooperativos)
-- ------------------------------------------------------------------
create table if not exists public.periodic_bosses (
    id uuid default uuid_generate_v4() primary key,
    kind text not null check (kind in ('quinzenal', 'campanha90')),
    cycle_key text not null, -- identifica o ciclo (ex: '2026-10-09') pra não duplicar boss no mesmo período
    name text not null,
    subtitle text,
    max_hp numeric not null,
    current_hp numeric not null,
    reward_xp integer not null default 0,
    status text not null default 'active', -- active | defeated | expired
    deadline timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (kind, cycle_key)
);

create table if not exists public.periodic_boss_hits (
    id uuid default uuid_generate_v4() primary key,
    boss_id uuid references public.periodic_bosses(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    damage numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.periodic_bosses enable row level security;
drop policy if exists "Ver bosses periodicos" on public.periodic_bosses;
create policy "Ver bosses periodicos" on public.periodic_bosses for select to authenticated using (true);

alter table public.periodic_boss_hits enable row level security;
drop policy if exists "Ver hits de boss periodico" on public.periodic_boss_hits;
create policy "Ver hits de boss periodico" on public.periodic_boss_hits for select to authenticated using (true);
drop policy if exists "Registrar hit proprio" on public.periodic_boss_hits;
create policy "Registrar hit proprio" on public.periodic_boss_hits for insert to authenticated with check (auth.uid() = user_id);

-- Aplica dano num boss periódico de forma atômica (equivalente a apply_global_boss_damage)
create or replace function public.apply_periodic_boss_damage(p_boss_id uuid, p_user_id uuid, p_damage numeric)
returns void as $$
begin
  update public.periodic_bosses
     set current_hp = greatest(current_hp - p_damage, 0)
   where id = p_boss_id and status = 'active';

  update public.periodic_bosses
     set status = 'defeated'
   where id = p_boss_id and current_hp <= 0 and status = 'active';

  insert into public.periodic_boss_hits (boss_id, user_id, damage) values (p_boss_id, p_user_id, p_damage);
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------
-- 4. RAID EM EQUIPE (co-op "matável em equipe" dos bosses invocáveis)
-- ------------------------------------------------------------------
create table if not exists public.raid_members (
    raid_id uuid references public.boss_raids(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (raid_id, user_id)
);
alter table public.raid_members enable row level security;
drop policy if exists "Ver membros da raid" on public.raid_members;
create policy "Ver membros da raid" on public.raid_members for select to authenticated using (true);
drop policy if exists "Entrar na raid" on public.raid_members;
create policy "Entrar na raid" on public.raid_members for insert to authenticated with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 5. CONVITES DE GUILDA (enviar / aceitar / recusar)
-- ------------------------------------------------------------------
create table if not exists public.guild_invites (
    id uuid default uuid_generate_v4() primary key,
    guild_id uuid references public.guilds(id) on delete cascade not null,
    inviter_id uuid references public.profiles(id) on delete cascade not null,
    invitee_id uuid references public.profiles(id) on delete cascade not null,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    responded_at timestamp with time zone
);

-- Apenas um convite pendente por par guilda+convidado
create unique index if not exists uniq_guild_invite_pending
  on public.guild_invites (guild_id, invitee_id)
  where (status = 'pending');

alter table public.guild_invites enable row level security;
drop policy if exists "Ver meus convites" on public.guild_invites;
create policy "Ver meus convites" on public.guild_invites
  for select to authenticated
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

drop policy if exists "Enviar convite (membro da guilda)" on public.guild_invites;
create policy "Enviar convite (membro da guilda)" on public.guild_invites
  for insert to authenticated
  with check (
    auth.uid() = inviter_id
    and exists (select 1 from public.guild_members gm where gm.guild_id = guild_invites.guild_id and gm.user_id = auth.uid())
  );

drop policy if exists "Responder meu convite" on public.guild_invites;
create policy "Responder meu convite" on public.guild_invites
  for update to authenticated
  using (auth.uid() = invitee_id)
  with check (auth.uid() = invitee_id);

-- Aceitar convite = grava em guild_members + marca o convite como aceito, numa transação só
create or replace function public.accept_guild_invite(p_invite_id uuid)
returns void as $$
declare
  v_invite guild_invites%rowtype;
begin
  select * into v_invite from public.guild_invites where id = p_invite_id and status = 'pending';
  if not found then
    raise exception 'Convite não encontrado ou já respondido';
  end if;
  if v_invite.invitee_id <> auth.uid() then
    raise exception 'Este convite não é seu';
  end if;

  insert into public.guild_members (guild_id, user_id)
  values (v_invite.guild_id, v_invite.invitee_id)
  on conflict (guild_id, user_id) do nothing;

  update public.guild_invites set status = 'accepted', responded_at = now() where id = p_invite_id;

  -- outros convites pendentes pro mesmo usuário em outras guildas continuam de pé;
  -- mas convites duplicados pendentes pra MESMA guilda (se houver) são limpos
  update public.guild_invites
     set status = 'declined', responded_at = now()
   where guild_id = v_invite.guild_id and invitee_id = v_invite.invitee_id and status = 'pending';
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------
-- 6. TRIGGER PRINCIPAL: aplica bônus de classe no monstro diário
--    e também bate nos bosses periódicos (quinzenal/90 dias) ativos
-- ------------------------------------------------------------------
create or replace function public.fn_apply_weight_log() returns trigger as $$
declare
  v_uid         uuid;
  v_dmg         numeric;
  v_daily_dmg   numeric;
  v_gain        integer;
  v_pts         record;
  v_profile     profiles%rowtype;
  v_daily       daily_monsters%rowtype;
  v_solo_boss   boss_raids%rowtype;
  v_guild_boss  global_boss_raids%rowtype;
  v_guild_id    uuid;
  v_periodic    periodic_bosses%rowtype;
begin
  select w.user_id into v_uid
  from exercises e
  join machines m on m.id = e.machine_id
  join workouts w on w.id = m.workout_id
  where e.id = new.exercise_id;

  if v_uid is null then return new; end if;

  if new.duration_min is not null then
    v_dmg := new.duration_min * 25;
  else
    v_dmg := coalesce(new.weight,0) * greatest(coalesce(new.reps,1),1);
  end if;

  v_gain := greatest(round(v_dmg / 40), 5);

  select * into v_profile from profiles where id = v_uid;

  if v_profile.last_checkin_date is null or v_profile.last_checkin_date < current_date then
      update profiles
      set xp = xp + v_gain,
          total_checkins = total_checkins + 1,
          last_checkin_date = current_date
      where id = v_uid;
  else
      update profiles set xp = xp + v_gain where id = v_uid;
  end if;

  loop
    select * into v_profile from profiles where id = v_uid;
    exit when v_profile.xp < fn_xp_to_next(v_profile.level);

    select * into v_pts from fn_points_for_level(v_profile.class, v_profile.level + 1);

    update profiles set
      xp = xp - fn_xp_to_next(level),
      level = level + 1,
      str = str + v_pts.d_str,
      agi = agi + v_pts.d_agi,
      vit = vit + v_pts.d_vit
    where id = v_uid;
  end loop;

  -- Combate 1: Monstro Diário — aplica bônus fixo se a classe do caçador
  -- for a fraqueza do boss do dia (weak_vs), senão dano normal.
  select * into v_daily from daily_monsters where user_id = v_uid and monster_date = current_date and status = 'active' limit 1;
  if found then
    if v_daily.weak_vs is not null and v_daily.weak_vs = v_profile.class then
      v_daily_dmg := round(v_dmg * coalesce(v_daily.bonus_mult, 1.2));
    else
      v_daily_dmg := v_dmg;
    end if;
    update daily_monsters set current_hp = greatest(current_hp - v_daily_dmg, 0) where id = v_daily.id;
    update daily_monsters set status = 'defeated' where id = v_daily.id and current_hp <= 0;
  end if;

  -- Combate 2: Boss Solo (30 dias / invocável / mini-boss)
  select * into v_solo_boss from boss_raids where user_id = v_uid and status = 'active' limit 1;
  if found then
    update boss_raids set current_hp = greatest(current_hp - v_dmg, 0) where id = v_solo_boss.id;
    update boss_raids set status = 'defeated' where id = v_solo_boss.id and current_hp <= 0;
    insert into combat_log (user_id, boss_id, exercise_id, damage) values (v_uid, v_solo_boss.id, new.exercise_id, v_dmg);
  else
    insert into combat_log (user_id, boss_id, exercise_id, damage) values (v_uid, null, new.exercise_id, v_dmg);
  end if;

  -- Combate 3: Boss Global da Guilda
  select guild_id into v_guild_id from guild_members where user_id = v_uid limit 1;
  if v_guild_id is not null then
    select * into v_guild_boss from global_boss_raids where guild_id = v_guild_id and status = 'active' limit 1;
    if found then
      update global_boss_raids set current_hp = greatest(current_hp - v_dmg, 0) where id = v_guild_boss.id;
      update global_boss_raids set status = 'defeated' where id = v_guild_boss.id and current_hp <= 0;
    end if;
  end if;

  -- Combate 4: Bosses Periódicos (Quinzenal e Campanha de 90 dias) — cooperativos,
  -- qualquer caçador que treina bate neles, por isso dão conta sozinhos em
  -- poucos dias de treino ou bem mais rápido com um grupo treinando junto.
  for v_periodic in
    select * from periodic_bosses
     where status = 'active'
       and (deadline is null or deadline > now())
       and kind in ('quinzenal', 'campanha90')
  loop
    perform public.apply_periodic_boss_damage(v_periodic.id, v_uid, v_dmg);
  end loop;

  return new;
end;
$$ language plpgsql security definer;

NOTIFY pgrst, 'reload schema';
