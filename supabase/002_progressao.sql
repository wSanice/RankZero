-- =====================================================================
-- 002 — metas por exercício, cardio por tempo, segunda classe e título
-- Rode no SQL Editor do Supabase (idempotente).
-- =====================================================================

-- Metas de cada exercício na ficha (cardio usa só target_minutes)
alter table exercises add column if not exists target_sets    integer not null default 3;
alter table exercises add column if not exists target_reps    integer not null default 10;
alter table exercises add column if not exists target_weight  numeric not null default 0;
alter table exercises add column if not exists target_minutes integer not null default 20;

-- Registro de cardio: minutos (peso e reps ficam 0)
alter table weight_logs add column if not exists duration_min numeric;

-- Progressão do caçador
alter table profiles add column if not exists second_class text; -- liberada no nível 50
alter table profiles add column if not exists title        text; -- liberado no nível 100

-- Trigger atualizado: cardio causa 25 de dano por minuto; musculação continua peso × reps
create or replace function fn_apply_weight_log() returns trigger as $$
declare
  v_uid     uuid;
  v_dmg     numeric;
  v_boss    boss_raids%rowtype;
  v_profile profiles%rowtype;
  v_gain    integer;
begin
  select w.user_id into v_uid
  from exercises e
  join machines m on m.id = e.machine_id
  join workouts w on w.id = m.workout_id
  where e.id = new.exercise_id;

  if v_uid is null then
    return new;
  end if;

  if new.duration_min is not null then
    v_dmg := new.duration_min * 25;
  else
    v_dmg := coalesce(new.weight,0) * greatest(coalesce(new.reps,1),1);
  end if;
  v_gain := greatest(round(v_dmg / 40), 5);

  update profiles
    set xp = xp + v_gain,
        str = str + case when v_dmg > 0 then 1 else 0 end
    where id = v_uid;

  loop
    select * into v_profile from profiles where id = v_uid;
    exit when v_profile.xp < fn_xp_to_next(v_profile.level);
    update profiles set
      xp = xp - fn_xp_to_next(level),
      level = level + 1,
      free_points = free_points + 3
    where id = v_uid;
  end loop;

  select * into v_boss from boss_raids where user_id = v_uid and status = 'active' limit 1;
  if found then
    update boss_raids
      set current_hp = greatest(current_hp - v_dmg, 0)
      where id = v_boss.id;

    update boss_raids set status = 'defeated'
      where id = v_boss.id and current_hp <= 0;

    insert into combat_log (user_id, boss_id, exercise_id, damage)
      values (v_uid, v_boss.id, new.exercise_id, v_dmg);
  else
    insert into combat_log (user_id, boss_id, exercise_id, damage)
      values (v_uid, null, new.exercise_id, v_dmg);
  end if;

  return new;
end;
$$ language plpgsql security definer;
