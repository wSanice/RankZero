import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { applyXp, levelUnlocks, rankFromLevel } from '../lib/rpg'
import { checkAndSpawnMiniBoss } from '../lib/data'

const Ctx = createContext(null)
export const useSession = () => useContext(Ctx)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [booting, setBooting] = useState(true)
  const [toasts, setToasts] = useState([])
  const profileRef = useRef(null)
  profileRef.current = profile

  const notify = useCallback((text, tone = 'cyan') => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const loadProfile = useCallback(
    async (uid) => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (error) {
        notify(`Falha ao carregar o perfil: ${error.message}`, 'red')
        return null
      }
      let row = data
      if (!row) {
        // usuário antigo, criado antes do trigger existir
        const created = await supabase.from('profiles').insert({ id: uid, name: 'Atleta' }).select().single()
        row = created.data
      }
      if (row) {
        const rank = rankFromLevel(row.level)
        if (rank !== row.rank) {
          row = { ...row, rank }
          supabase.from('profiles').update({ rank }).eq('id', uid).then(() => { })
        }
        setProfile(row)

        // Mini-boss de 15 dias: dispara em background, não trava o load do profile
        checkAndSpawnMiniBoss(row)
          .then((spawned) => {
            if (spawned) notify(`⚠ ${spawned.name} APARECEU! (marco de ${row.total_checkins} dias)`, 'red')
          })
          .catch((e) => console.error('mini-boss spawn falhou:', e))
      }
      return row
    },
    [notify]
  )

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (alive) setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) setProfile(null)
      else setTimeout(() => loadProfile(s.user.id), 0)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    const uid = profileRef.current?.id
    return uid ? loadProfile(uid) : null
  }, [loadProfile])

  const updateProfile = useCallback(
    async (patch) => {
      const prev = profileRef.current
      if (!prev) return false
      setProfile({ ...prev, ...patch })
      const { error } = await supabase.from('profiles').update(patch).eq('id', prev.id)
      if (error) {
        setProfile(prev)
        notify(`Não foi possível salvar: ${error.message}`, 'red')
        return false
      }
      return true
    },
    [notify]
  )
  useEffect(() => {
    if (!session?.user) return
    heartbeat(session.user.id)
    const id = setInterval(() => heartbeat(session.user.id), 60000)
    return () => clearInterval(id)
  }, [session?.user?.id])

  // Concede XP fora do trigger (missões, recompensa de raid) com a mesma curva do banco
  const awardXp = useCallback(
    async (gain) => {
      const p = profileRef.current
      if (!p || !gain) return null
      const next = applyXp(p, gain)
      const patch = { xp: next.xp, level: next.level, free_points: next.free_points, rank: rankFromLevel(next.level) }
      const ok = await updateProfile(patch)
      if (ok) {
        notify(`+${gain} XP`, 'gold')
        if (next.leveled) notify(`NÍVEL ${next.level} ALCANÇADO · +${next.leveled * 3} PONTOS`, 'gold')
        levelUnlocks(p.level, next.level).forEach((m) => notify(m, 'gold'))
      }
      return next
    },
    [updateProfile, notify]
  )

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const value = useMemo(
    () => ({ session, user: session?.user, profile, booting, notify, refreshProfile, updateProfile, awardXp, signOut }),
    [session, profile, booting, notify, refreshProfile, updateProfile, awardXp, signOut]
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span className="mono">[SISTEMA]</span> {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
