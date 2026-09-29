import { supabase } from './supabase'
import { DEFAULT_BOSS, DEFAULT_MISSIONS, INVOKABLE_BOSSES, localDate } from './rpg'

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

  const maxHp = Math.round(400 * Math.max(level || 1, 1)) // escala com nível
  const { data, error: insErr } = await supabase
    .from('daily_monsters')
    .insert({
      user_id: uid,
      monster_date: today,
      name: `MONSTRO DO DIA · NV.${level || 1}`,
      max_hp: maxHp,
      current_hp: maxHp,
      status: 'active',
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