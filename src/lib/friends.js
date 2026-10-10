import { supabase } from './supabase'

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

// aceita null/undefined (perfil sem hunter_name, por exemplo) sem quebrar —
// o parâmetro default só funciona pra 'undefined', não pra 'null', por isso
// o '|| ""' extra
const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '')

export async function searchProfiles(query) {
  const q = query.trim()
  if (!q) return []
  const [namePart, tagPart] = q.split('#')
  const name = namePart.trim()
  const normName = normalize(name)

  // busca ampla: usa só os primeiros caracteres pra não perder resultados
  // por causa de espaço em lugar diferente
  const loosePart = name.slice(0, 3) || name
  let req = supabase.from('profiles').select('id, hunter_name, name, tag, avatar_url, level, last_seen')
  req = req.or(`hunter_name.ilike.%${loosePart}%,name.ilike.%${loosePart}%`)
  if (tagPart) req = req.eq('tag', tagPart.trim())

  const { data, error } = await req.limit(30)
  if (error) throw error

  // filtro fino no JS, ignorando espaços e maiúsculas/minúsculas
  return data
    .filter((p) => {
      const h = normalize(p.hunter_name)
      const n = normalize(p.name)
      return h.includes(normName) || n.includes(normName)
    })
    .slice(0, 10)
}

export const isOnline = (last_seen) => last_seen && Date.now() - new Date(last_seen).getTime() < 2 * 60 * 1000

// heartbeat: chame a cada ~60s enquanto o app está aberto (ex. no SessionContext)
export async function heartbeat(uid) {
  await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid)
}