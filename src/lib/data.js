import { supabase } from './supabase'
import {
  DEFAULT_BOSS,
  DEFAULT_MISSIONS,
  INVOKABLE_BOSSES,
  localDate,
  dailyBossForLevel,
  classDamageMultiplier,
  BIWEEKLY_BOSS_POOL,
  BIWEEKLY_BOSS_MAX_HP,
  BIWEEKLY_BOSS_REWARD_XP,
  BIWEEKLY_CYCLE_DAYS,
  BIWEEKLY_DEADLINE_DAYS,
  CAMPAIGN90_BOSS_POOL,
  CAMPAIGN90_BOSS_MAX_HP,
  CAMPAIGN90_BOSS_REWARD_XP,
  CAMPAIGN90_CYCLE_DAYS,
  CAMPAIGN90_DEADLINE_DAYS,
  cycleKey,
  pickFromPool,
} from './rpg'

// Boss ativo; se o prazo já passou, marca como expirado
export async function getBoss(uid) {
  const { data, error } = await supabase
    .from('boss_raids')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data && data.status === 'active' && data.deadline && new Date(data.deadline) < new Date() && Number(data.current_hp) > 0) {
    await supabase.from('boss_raids').update({ status: 'expired' }).eq('id', data.id)
    return { ...data, status: 'expired' }
  }
  return data
}

export async function summonBoss(uid) {
  const deadline = new Date(Date.now() + 30 * 86400000).toISOString()
  const { data, error } = await supabase
    .from('boss_raids')
    .insert({ user_id: uid, ...DEFAULT_BOSS, deadline })
    .select()
    .single()
  if (error) throw error
  return data
}

// Garante as missões do dia (unique user+data+título evita duplicar)
export async function getMissions(uid) {
  const today = localDate()
  const list = async () => {
    const { data, error } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', uid)
      .eq('mission_date', today)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  }
  let rows = await list()
  if (!rows.length) {
    const { error } = await supabase
      .from('daily_missions')
      .upsert(
        DEFAULT_MISSIONS.map((m) => ({ ...m, user_id: uid, mission_date: today })),
        { onConflict: 'user_id,mission_date,title', ignoreDuplicates: true }
      )
    if (error) throw error
    rows = await list()
  }
  return rows
}

const MINI_BOSS_INTERVAL = 15

export async function checkAndSpawnMiniBoss(profile) {
  if (!profile?.total_checkins || profile.total_checkins % MINI_BOSS_INTERVAL !== 0) return null

  const { data: existing, error: exErr } = await supabase
    .from('boss_raids')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()
  if (exErr) throw exErr
  if (existing) return null

  const milestone = profile.total_checkins
  const scale = 1 + milestone / MINI_BOSS_INTERVAL
  const maxHp = Math.round(50000 * scale)

  const { data, error } = await supabase
    .from('boss_raids')
    .insert({
      user_id: profile.id,
      name: `SENTINELA DO MARCO ${milestone}`,
      subtitle: `MINI-BOSS · ${milestone} DIAS DE CHECK-IN`,
      max_hp: maxHp,
      current_hp: maxHp,
      reward_xp: Math.round(500 * scale),
      reward_text: null,
      status: 'active',
      deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDailyMonster(uid, level) {
  const today = localDate()
  const { data: existing, error } = await supabase
    .from('daily_monsters')
    .select('*')
    .eq('user_id', uid)
    .eq('monster_date', today)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing

  // Boss do dia é escolhido pelo NÍVEL do caçador (o mais forte cujo nível <= nível
  // do jogador), com variação determinística por data — mesma regra de rpg.js usada
  // pelo trigger fn_apply_weight_log para aplicar o bônus de classe (weak_vs/bonus_mult).
  const def = dailyBossForLevel(level, today)
  const { data, error: insErr } = await supabase
    .from('daily_monsters')
    .insert({
      user_id: uid,
      monster_date: today,
      name: def.name,
      max_hp: def.max_hp,
      current_hp: def.max_hp,
      status: 'active',
      weak_vs: def.weak_vs,
      bonus_mult: def.bonus_mult,
      boss_level: Number(/NÍVEL\s+(\d+)/i.exec(def.subtitle || '')?.[1]) || 1,
    })
    .select()
    .single()

  if (insErr) {
    // corrida entre abas/refreshes: alguém já criou, só busca de novo
    if (insErr.code === '23505') {
      const retry = await supabase.from('daily_monsters').select('*').eq('user_id', uid).eq('monster_date', today).maybeSingle()
      if (retry.error) throw retry.error
      return retry.data
    }
    throw insErr
  }
  return data
}

// Permite sair da dungeon do monstro do dia sem derrotá-lo (ele some pro resto do
// dia e volta renovado amanhã). Só se aplica ao monstro diário: os bosses
// periódicos (quinzenal/90 dias) são cooperativos e globais, então não têm opção
// de abandono — ficar "preso" neles é intencional, o dano de qualquer caçador
// que treina já ajuda a derrubá-los.
export async function abandonDailyMonster(id) {
  const { error } = await supabase.from('daily_monsters').update({ status: 'abandoned' }).eq('id', id)
  if (error) throw error
}

export async function getGlobalBoss() {
  const { data, error } = await supabase
    .from('global_bosses')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// Chame isso junto com o registro normal de dano no boss pessoal
export async function hitGlobalBoss(uid, damage) {
  const { error } = await supabase.rpc('apply_global_boss_damage', {
    p_user_id: uid,
    p_damage: damage,
  })
  if (error) throw error
}

// Ranking de quem mais bateu no boss global
export async function getGlobalBossLeaderboard(bossId) {
  const { data, error } = await supabase
    .from('global_boss_hits')
    .select('user_id, damage')
    .eq('boss_id', bossId)
  if (error) throw error
  const totals = {}
  for (const h of data) totals[h.user_id] = (totals[h.user_id] || 0) + Number(h.damage)
  return Object.entries(totals).sort((a, b) => b[1] - a[1])
}

export async function summonInvokableBoss(uid, bossKey, partnerId = null) {
  const def = INVOKABLE_BOSSES[bossKey]
  if (!def) throw new Error('Boss inválido')

  const maxHp = partnerId ? Math.round(def.max_hp * 1.7) : def.max_hp
  const deadline = new Date(Date.now() + 7 * 86400000).toISOString()

  const { data, error } = await supabase
    .from('boss_raids')
    .insert({
      user_id: uid,
      name: def.name,
      subtitle: def.subtitle,
      max_hp: maxHp,
      current_hp: maxHp,
      reward_xp: def.reward_xp,
      status: 'active',
      deadline,
    })
    .select()
    .single()
  if (error) throw error

  const members = [{ raid_id: data.id, user_id: uid }]
  if (partnerId) members.push({ raid_id: data.id, user_id: partnerId })
  await supabase.from('raid_members').insert(members)

  return data
}

export async function getRaidPartners(raidId, myId) {
  const { data, error } = await supabase
    .from('raid_members')
    .select('user_id, profile:profiles(hunter_name, name, tag, avatar_url, last_seen)')
    .eq('raid_id', raidId)
    .neq('user_id', myId)
  if (error) throw error
  return data
}

// Dano causado por CADA membro da raid (eu + convidado) contra o boss atual —
// usado na tela de treino pra mostrar os dois caçadores e seus danos lado a lado.
export async function getRaidDamageByMember(raidId) {
  const { data: members, error: mErr } = await supabase
    .from('raid_members')
    .select('user_id, profile:profiles(hunter_name, name, tag, avatar_url, level)')
    .eq('raid_id', raidId)
  if (mErr) throw mErr

  const { data: hits, error: hErr } = await supabase
    .from('combat_log')
    .select('user_id, damage')
    .eq('boss_id', raidId)
  if (hErr) throw hErr

  const totals = {}
  for (const h of hits) totals[h.user_id] = (totals[h.user_id] || 0) + Number(h.damage)

  return members.map((m) => ({
    userId: m.user_id,
    profile: m.profile,
    damage: totals[m.user_id] || 0,
  }))
}

// ---------- Bosses periódicos: Quinzenal e Campanha de 90 dias ----------
// Globais/cooperativos (tabela periodic_bosses, 003_boss_fixes_and_guild_invites.sql):
// qualquer caçador que treina bate neles (aplicado pelo trigger fn_apply_weight_log).
// cycle_key garante que todo mundo que abrir o app dentro da mesma janela de tempo
// cai no mesmo boss, sem depender de um cron — por isso "ensure": busca o boss do
// ciclo atual e, se ainda não existe, cria (upsert idempotente via unique(kind, cycle_key)).
const PERIODIC_CONFIG = {
  quinzenal: {
    pool: BIWEEKLY_BOSS_POOL,
    maxHp: BIWEEKLY_BOSS_MAX_HP,
    rewardXp: BIWEEKLY_BOSS_REWARD_XP,
    cycleDays: BIWEEKLY_CYCLE_DAYS,
    deadlineDays: BIWEEKLY_DEADLINE_DAYS,
  },
  campanha90: {
    pool: CAMPAIGN90_BOSS_POOL,
    maxHp: CAMPAIGN90_BOSS_MAX_HP,
    rewardXp: CAMPAIGN90_BOSS_REWARD_XP,
    cycleDays: CAMPAIGN90_CYCLE_DAYS,
    deadlineDays: CAMPAIGN90_DEADLINE_DAYS,
  },
}

export async function ensurePeriodicBoss(kind) {
  const cfg = PERIODIC_CONFIG[kind]
  if (!cfg) throw new Error(`Tipo de boss periódico inválido: ${kind}`)
  const key = cycleKey(cfg.cycleDays)

  const { data: existing, error } = await supabase
    .from('periodic_bosses')
    .select('*')
    .eq('kind', kind)
    .eq('cycle_key', key)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing

  const def = pickFromPool(cfg.pool, key)
  const deadline = new Date(Date.now() + cfg.deadlineDays * 86400000).toISOString()
  const { data, error: insErr } = await supabase
    .from('periodic_bosses')
    .insert({
      kind,
      cycle_key: key,
      name: def.name,
      subtitle: def.subtitle,
      max_hp: cfg.maxHp,
      current_hp: cfg.maxHp,
      reward_xp: cfg.rewardXp,
      status: 'active',
      deadline,
    })
    .select()
    .single()

  if (insErr) {
    // corrida entre jogadores abrindo o app ao mesmo tempo: alguém já criou o
    // boss deste ciclo, só busca de novo (unique(kind, cycle_key) garante 1 só)
    if (insErr.code === '23505') {
      const retry = await supabase.from('periodic_bosses').select('*').eq('kind', kind).eq('cycle_key', key).maybeSingle()
      if (retry.error) throw retry.error
      return retry.data
    }
    throw insErr
  }
  return data
}

export const getBiweeklyBoss = () => ensurePeriodicBoss('quinzenal')
export const getCampaign90Boss = () => ensurePeriodicBoss('campanha90')