import { supabase } from './supabase'
import { DEFAULT_BOSS, DEFAULT_MISSIONS, localDate } from './rpg'

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