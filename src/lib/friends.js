import { supabase } from './supabase'

// busca por "nome#0054" ou só "nome" (retorna vários)
export async function searchProfiles(query) {
  const q = query.trim()
  if (!q) return []
  const [namePart, tagPart] = q.split('#')
  let req = supabase.from('profiles').select('id, hunter_name, name, tag, avatar_url, level, last_seen')
  if (tagPart) {
    req = req.ilike('hunter_name', namePart).eq('tag', tagPart)
  } else {
    req = req.or(`hunter_name.ilike.%${namePart}%,name.ilike.%${namePart}%`)
  }
  const { data, error } = await req.limit(10)
  if (error) throw error
  return data
}

export async function sendFriendRequest(myId, theirId) {
  const { error } = await supabase.from('friendships').insert({ requester_id: myId, addressee_id: theirId })
  if (error) throw error
}

export async function acceptFriendRequest(id) {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
  if (error) throw error
}

export async function getFriends(uid) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester:profiles!friendships_requester_id_fkey(id,hunter_name,name,tag,avatar_url,level,last_seen), addressee:profiles!friendships_addressee_id_fkey(id,hunter_name,name,tag,avatar_url,level,last_seen)')
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
  if (error) throw error
  return data.map((f) => ({
    friendshipId: f.id,
    status: f.status,
    profile: f.requester.id === uid ? f.addressee : f.requester,
    incoming: f.status === 'pending' && f.addressee.id === uid,
  }))
}

export const isOnline = (last_seen) => last_seen && Date.now() - new Date(last_seen).getTime() < 2 * 60 * 1000

// heartbeat: chame a cada ~60s enquanto o app está aberto (ex. no SessionContext)
export async function heartbeat(uid) {
  await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid)
}