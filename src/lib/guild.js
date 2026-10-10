import { supabase } from './supabase'

// ---------- Guildas: criar, convidar (enviar/aceitar/recusar) ----------
// Espelha as tabelas/RPCs de supabase/003_boss_fixes_and_guild_invites.sql:
// guilds, guild_members, guild_invites, accept_guild_invite().

export async function getMyGuild(uid) {
  const { data: membership, error } = await supabase
    .from('guild_members')
    .select('guild_id, joined_at, guild:guilds(id, name, created_at)')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!membership) return null

  const { data: members, error: mErr } = await supabase
    .from('guild_members')
    .select('user_id, joined_at, profile:profiles(hunter_name, name, tag, avatar_url, level, last_seen)')
    .eq('guild_id', membership.guild_id)
    .order('joined_at', { ascending: true })
  if (mErr) throw mErr

  return { ...membership.guild, members }
}

export async function createGuild(name) {
  const clean = (name || '').trim()
  if (clean.length < 3 || clean.length > 30) throw new Error('Nome da guilda precisa ter 3–30 caracteres.')
  const { data, error } = await supabase.from('guilds').insert({ name: clean }).select().single()
  if (error) {
    if (error.code === '23505') throw new Error('Já existe uma guilda com esse nome.')
    throw error
  }
  const { error: joinErr } = await supabase.from('guild_members').insert({ guild_id: data.id, user_id: (await supabase.auth.getUser()).data.user.id })
  if (joinErr) throw joinErr
  return data
}

// Envia convite de guilda para outro caçador (ex: um amigo). O caçador precisa
// ser membro da guilda para convidar (política RLS "Enviar convite").
export async function sendGuildInvite(guildId, inviterId, inviteeId) {
  const { error } = await supabase
    .from('guild_invites')
    .insert({ guild_id: guildId, inviter_id: inviterId, invitee_id: inviteeId })
  if (error) {
    if (error.code === '23505') throw new Error('Este caçador já tem um convite pendente para esta guilda.')
    throw error
  }
}

// Convites recebidos pendentes, com dados da guilda e de quem convidou
export async function getIncomingGuildInvites(uid) {
  const { data, error } = await supabase
    .from('guild_invites')
    .select('id, status, created_at, guild:guilds(id,name), inviter:profiles!guild_invites_inviter_id_fkey(hunter_name,name,tag)')
    .eq('invitee_id', uid)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Aceitar = grava em guild_members + marca convite como aceito (transação atômica no banco)
export async function acceptGuildInvite(inviteId) {
  const { error } = await supabase.rpc('accept_guild_invite', { p_invite_id: inviteId })
  if (error) throw error
}

export async function declineGuildInvite(inviteId) {
  const { error } = await supabase
    .from('guild_invites')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', inviteId)
  if (error) throw error
}

export async function leaveGuild(guildId, uid) {
  const { error } = await supabase.from('guild_members').delete().eq('guild_id', guildId).eq('user_id', uid)
  if (error) throw error
}
