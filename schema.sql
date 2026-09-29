-- =====================================================================
-- SCRIPT MESTRE DEFINITIVO - MONTAGEM E RESET COMPLETO
-- Este script apaga a estrutura antiga de forma segura e recria o banco
-- com todas as tabelas, colunas (incluindo 'rank' e 'logged_at'),
-- funções, gatilhos de RPG e políticas de segurança RLS.
-- =====================================================================

-- 1. LIMPEZA SEGURA DAS TABELAS E FUNÇÕES (Não afeta a autenticação de usuários)
drop table if exists public.combat_log cascade;
drop table if exists public.boss_raids cascade;
drop table if exists public.weight_logs cascade;
drop table if exists public.exercises cascade;
drop table if exists public.machines cascade;
drop table if exists public.workouts cascade;
drop table if exists public.daily_missions cascade;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user cascade;
drop function if exists public.fn_apply_weight_log cascade;
drop function if exists public.fn_xp_to_next cascade;
drop function if exists public.fn_points_for_level cascade;
drop table if exists public.profiles cascade;

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- ==========================================
-- 2. CRIAÇÃO DAS TABELAS
-- ==========================================

-- Perfis (Profiles) - Agora incluindo 'rank', 'updated_at' e outros dados comuns
create table public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    name text,
    full_name text,
    username text,
    email text,
    website text,
    avatar_url text,
    theme text,
    rank text default 'E',
    class text not null default 'colosso',
    second_class text, 
    title text,        
    level integer not null default 1,
    xp integer not null default 0,
    str integer not null default 0,
    agi integer not null default 0,
    vit integer not null default 0,
    free_points integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Fichas de Treino (Workouts)
create table public.workouts (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    letter text, 
    title text not null, 
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Máquinas / Agrupamentos (Machines)
create table public.machines (
    id uuid default uuid_generate_v4() primary key,
    workout_id uuid references public.workouts(id) on delete cascade not null,
    name text not null,
    kind text, 
    position integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Exercícios (Exercises)
create table public.exercises (
    id uuid default uuid_generate_v4() primary key,
    machine_id uuid references public.machines(id) on delete cascade not null,
    name text not null,
    position integer default 0,
    target_sets integer not null default 3,
    target_reps integer not null default 10,
    target_weight numeric not null default 0,
    target_minutes integer not null default 20,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Registros de Treino (Weight Logs) - Utilizando 'logged_at' conforme exigido pelo frontend
create table public.weight_logs (
    id uuid default uuid_generate_v4() primary key,
    exercise_id uuid references public.exercises(id) on delete cascade not null,
    weight numeric,
    reps integer,
    duration_min numeric,
    logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chefões (Boss Raids)
create table public.boss_raids (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    max_hp numeric not null,
    current_hp numeric not null,
    status text not null default 'active',
    deadline timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Log de Combate (Combat Log)
create table public.combat_log (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    boss_id uuid references public.boss_raids(id) on delete set null,
    exercise_id uuid references public.exercises(id) on delete set null,
    damage numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Missões Diárias (Daily Missions)
create table public.daily_missions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    mission_date date not null,
    title text not null,
    description text,
    target numeric,
    unit text,
    xp_reward integer,
    is_completed boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (user_id, mission_date, title) 
);

-- ==========================================
-- 3. FUNÇÕES BASE E RPG
-- ==========================================

create or replace function public.fn_xp_to_next(p_level integer)
returns integer as $$
begin
    return p_level * 100; 
end;
$$ language plpgsql immutable;

create or replace function public.fn_points_for_level(p_class text, p_level integer)
returns table(d_str integer, d_agi integer, d_vit integer) as $$
begin
  if p_level % 10 = 0 then
    case p_class
      when 'colosso'  then return query select 2, 1, 2;
      when 'ladino'   then return query select 1, 3, 1;
      when 'guardiao' then return query select 2, 1, 2;
      else                 return query select 2, 1, 2; 
    end case;
  else
    case p_class
      when 'colosso'  then return query select 2, 0, 1;
      when 'ladino'   then return query select 1, 2, 0;
      when 'guardiao' then return query select 1, 0, 2;
      else                 return query select 2, 0, 1; 
    end case;
  end if;
end;
$$ language plpgsql immutable;

-- ==========================================
-- 4. TRIGGERS (AUTOMATIZAÇÕES)
-- ==========================================

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, class, level, xp, str, agi, vit, free_points, rank)
  values (new.id, 'colosso', 1, 0, 0, 0, 0, 0, 'E');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.fn_apply_weight_log() returns trigger as $$
declare
  v_uid    uuid;
  v_dmg    numeric;
  v_boss   boss_raids%rowtype;
  v_profile profiles%rowtype;
  v_gain   integer;
  v_pts    record;
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

  update profiles set xp = xp + v_gain where id = v_uid;

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

  select * into v_boss from boss_raids where user_id = v_uid and status = 'active' limit 1;
  if found then
    update boss_raids set current_hp = greatest(current_hp - v_dmg, 0) where id = v_boss.id;
    update boss_raids set status = 'defeated' where id = v_boss.id and current_hp <= 0;
    insert into combat_log (user_id, boss_id, exercise_id, damage) values (v_uid, v_boss.id, new.exercise_id, v_dmg);
  else
    insert into combat_log (user_id, boss_id, exercise_id, damage) values (v_uid, null, new.exercise_id, v_dmg);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_weight_log_insert
  after insert on public.weight_logs
  for each row execute procedure public.fn_apply_weight_log();

-- ==========================================
-- 5. PERMISSÕES DE SEGURANÇA (RLS)
-- ==========================================

alter table public.profiles enable row level security;
create policy "Acesso total ao proprio perfil" on public.profiles for all to authenticated using (auth.uid() = id);

alter table public.workouts enable row level security;
create policy "Acesso total aos proprios treinos" on public.workouts for all to authenticated using (auth.uid() = user_id);

alter table public.machines enable row level security;
create policy "Acesso total as maquinas" on public.machines for all to authenticated using (true);

alter table public.exercises enable row level security;
create policy "Acesso total aos exercicios" on public.exercises for all to authenticated using (true);

alter table public.weight_logs enable row level security;
create policy "Acesso total aos logs de peso" on public.weight_logs for all to authenticated using (true);

alter table public.daily_missions enable row level security;
create policy "Acesso total as proprias missoes" on public.daily_missions for all to authenticated using (auth.uid() = user_id);

alter table public.boss_raids enable row level security;
create policy "Acesso total aos proprios bosses" on public.boss_raids for all to authenticated using (auth.uid() = user_id);

-- ==========================================
-- 6. RECARREGAMENTO DE CACHE (CRÍTICO)
-- ==========================================
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- 007 — Expansão: Guildas, Boss Global, Mini-Monstros e Boss de 15 Dias
-- Rode no SQL Editor do Supabase (Idempotente)
-- =====================================================================

-- 1. Contador de Frequência para o Mini Boss (15 dias)
alter table public.profiles add column if not exists total_checkins integer default 0;
alter table public.profiles add column if not exists last_checkin_date date;

-- 2. Sistema de Guildas (Grupos)
create table if not exists public.guilds (
    id uuid default uuid_generate_v4() primary key,
    name text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.guild_members (
    guild_id uuid references public.guilds(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (guild_id, user_id)
);

-- 3. Boss Global (Compartilhado pela Guilda)
create table if not exists public.global_boss_raids (
    id uuid default uuid_generate_v4() primary key,
    guild_id uuid references public.guilds(id) on delete cascade not null,
    name text not null,
    max_hp numeric not null,
    current_hp numeric not null,
    status text not null default 'active', -- 'active', 'defeated', 'expired'
    deadline timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Monstro Diário (Foge meia-noite)
create table if not exists public.daily_monsters (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    monster_date date not null default current_date,
    name text not null,
    max_hp numeric not null,
    current_hp numeric not null,
    status text not null default 'active', -- 'active', 'defeated'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (user_id, monster_date) -- Só um monstro por dia por usuário
);

-- 5. Atualizar o Trigger Principal de Combate (O Coração do Jogo)
-- Agora o dano bate no monstro do dia, no boss ativo e no boss da guilda simultaneamente.
create or replace function public.fn_apply_weight_log() returns trigger as $$
declare
  v_uid         uuid;
  v_dmg         numeric;
  v_gain        integer;
  v_pts         record;
  v_profile     profiles%rowtype;
  v_daily       daily_monsters%rowtype;
  v_solo_boss   boss_raids%rowtype;
  v_guild_boss  global_boss_raids%rowtype;
  v_guild_id    uuid;
begin
  -- Identifica o usuário dono do treino
  select w.user_id into v_uid
  from exercises e
  join machines m on m.id = e.machine_id
  join workouts w on w.id = m.workout_id
  where e.id = new.exercise_id;

  if v_uid is null then return new; end if;

  -- Cálculo de Dano (Cardio vs Musculação)
  if new.duration_min is not null then
    v_dmg := new.duration_min * 25;
  else
    v_dmg := coalesce(new.weight,0) * greatest(coalesce(new.reps,1),1);
  end if;
  
  v_gain := greatest(round(v_dmg / 40), 5);

  -- Atualiza XP e Check-in Diário (para o Boss de 15 dias)
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

  -- Loop de Level Up (Níveis Múltiplos)
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

  -- Combate 1: Monstro Diário
  select * into v_daily from daily_monsters where user_id = v_uid and monster_date = current_date and status = 'active' limit 1;
  if found then
    update daily_monsters set current_hp = greatest(current_hp - v_dmg, 0) where id = v_daily.id;
    update daily_monsters set status = 'defeated' where id = v_daily.id and current_hp <= 0;
  end if;

  -- Combate 2: Boss Solo
  select * into v_solo_boss from boss_raids where user_id = v_uid and status = 'active' limit 1;
  if found then
    update boss_raids set current_hp = greatest(current_hp - v_dmg, 0) where id = v_solo_boss.id;
    update boss_raids set status = 'defeated' where id = v_solo_boss.id and current_hp <= 0;
    insert into combat_log (user_id, boss_id, exercise_id, damage) values (v_uid, v_solo_boss.id, new.exercise_id, v_dmg);
  else
    insert into combat_log (user_id, boss_id, exercise_id, damage) values (v_uid, null, new.exercise_id, v_dmg);
  end if;

  -- Combate 3: Boss Global (Guilda)
  select guild_id into v_guild_id from guild_members where user_id = v_uid limit 1;
  if v_guild_id is not null then
    select * into v_guild_boss from global_boss_raids where guild_id = v_guild_id and status = 'active' limit 1;
    if found then
      update global_boss_raids set current_hp = greatest(current_hp - v_dmg, 0) where id = v_guild_boss.id;
      update global_boss_raids set status = 'defeated' where id = v_guild_boss.id and current_hp <= 0;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 6. Políticas de Segurança (RLS) para o modo Cooperativo
alter table public.guilds enable row level security;
create policy "Ver todas as guildas" on public.guilds for select to authenticated using (true);
create policy "Criar guilda" on public.guilds for insert to authenticated with check (true);

alter table public.guild_members enable row level security;
create policy "Ver membros da guilda" on public.guild_members for select to authenticated using (true);
create policy "Entrar/Sair da guilda" on public.guild_members for all to authenticated using (auth.uid() = user_id);

alter table public.global_boss_raids enable row level security;
-- Magia do RLS: Você só pode ver/atacar o Boss Global se fizer parte da guilda dona dele
create policy "Acesso ao boss da própria guilda" on public.global_boss_raids 
  for all to authenticated 
  using (exists (select 1 from public.guild_members where guild_members.guild_id = global_boss_raids.guild_id and guild_members.user_id = auth.uid()));

alter table public.daily_monsters enable row level security;
create policy "Acesso total aos proprios monstros diários" on public.daily_monsters for all to authenticated using (auth.uid() = user_id);

-- 7. Limpa o Cache da API para o frontend React
NOTIFY pgrst, 'reload schema';