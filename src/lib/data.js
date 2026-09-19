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
