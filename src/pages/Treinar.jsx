import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, SkipForward, Swords, Timer, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSession } from '../context/SessionContext'
import { useNow, useQuery, must } from '../lib/useQuery'
import { flatExercises, getWorkouts } from '../lib/workouts'
import { clock, damageOf, damageOfMinutes, fmt, fmt1, levelUnlocks, localDate, xpOf } from '../lib/rpg'
import { Btn, Chip, Empty, ErrorNote, Loading, Panel, SegBar, SysHead } from '../components/ui'
import { getBoss, getDailyMonster } from '../lib/data'

const REST_KEY = 'abibas_rest_seconds'
export const getRestSeconds = () => Number(localStorage.getItem(REST_KEY)) || 90

export default function Treinar({ go, params }) {
  const [workoutId, setWorkoutId] = useState(params?.workoutId || null)
  const q = useQuery(getWorkouts, [])

  if (q.loading) return <Loading />
  if (q.error) return <ErrorNote error={q.error} />
  const list = q.data || []

  if (!list.length) {
    return (
      <Empty title="Nenhuma ficha de treino" action={<Btn onClick={() => go('ficha')}>Criar minha primeira ficha</Btn>}>
        Monte uma ficha com as máquinas e exercícios que você usa. Depois volte aqui para atacar.
      </Empty>
    )
  }

  const workout = list.find((w) => w.id === workoutId)
  if (!workout) {
    return (
      <div className="stack">
        <Panel brackets>
          <SysHead>[ESCOLHA SUA DUNGEON]</SysHead>
          <p className="muted">Selecione a ficha de hoje para iniciar a sessão de combate.</p>
        </Panel>
        {list.map((w) => {
          const n = flatExercises(w).length
          return (
            <button key={w.id} className="panel pick" onClick={() => setWorkoutId(w.id)} disabled={!n}>
              <span className="letter">{w.letter}</span>
              <span className="grow left">
                <b className="h-md">{w.title || `Ficha ${w.letter}`}</b>
                <span className="mono tiny dim">{n} EXERCÍCIOS</span>
              </span>
              <ChevronRight size={18} />
            </button>
          )
        })}
      </div>
    )
  }

  return <SessionView key={workout.id} workout={workout} onExit={() => setWorkoutId(null)} go={go} />
}

function SessionView({ workout, onExit, go }) {
  const { user, profile, refreshProfile, awardXp, notify } = useSession()
  const now = useNow(500)
  const exercises = useMemo(() => flatExercises(workout), [workout])
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState({}) // exerciseId -> [{weight, reps, dmg}]
  const [saving, setSaving] = useState(false)
  const [restEnd, setRestEnd] = useState(0)
  const [finished, setFinished] = useState(false)
  const startedAt = useRef(Date.now())
  const [boss, setBoss] = useState(null)

  const ex = exercises[idx]
  const sets = done[ex?.id] || []
  const isCardio = ex?.kind === 'cardio'

  // boss ativo para mostrar HP e detectar vitória
  useEffect(() => {
    getBoss(user.id).then(setBoss).catch(() => {})
  }, [user.id])

  const [daily, setDaily] = useState(null)

  // se o boss ativo hoje É o mini-boss do marco de 15 dias, ele substitui o monstro diário
  const isMiniBossDay = boss && boss.status === 'active' && boss.name?.startsWith('SENTINELA DO MARCO')

  useEffect(() => {
    if (boss === null) return // ainda não sabemos se tem mini-boss hoje, espera
    if (isMiniBossDay) {
      setDaily(null)
      return
    }
    getDailyMonster(user.id, profile.level).then(setDaily).catch(() => {})
  }, [user.id, isMiniBossDay, boss])

  // histórico: último dia anterior em que este exercício foi feito (apenas exibição)
  const hist = useQuery(async () => {
    if (!ex) return []
    const rows = must(
      await supabase
        .from('weight_logs')
        .select('weight, reps, duration_min, logged_at')
        .eq('exercise_id', ex.id)
        .order('logged_at', { ascending: false })
        .limit(40)
    )
    const today = localDate()
    const past = rows.filter((r) => localDate(new Date(r.logged_at)) !== today)
    if (!past.length) return []
    const day = localDate(new Date(past[0].logged_at))
    return past.filter((r) => localDate(new Date(r.logged_at)) === day).reverse()
  }, [ex?.id])
  const prev = hist.data || []

  // meta cadastrada na Ficha — é o que sempre será registrado, sem edição aqui
  const targetMinutes = Number(ex?.target_minutes) > 0 ? Number(ex.target_minutes) : 20
  const targetWeight = Number(ex?.target_weight) > 0 ? Number(ex.target_weight) : 0
  const targetReps = Number(ex?.target_reps) > 0 ? Number(ex.target_reps) : 10

  const sessionDmg = Object.values(done).flat().reduce((s, r) => s + r.dmg, 0)
  const sessionSets = Object.values(done).flat().length
  const sessionXp = Object.values(done).flat().reduce((s, r) => s + xpOf(r.dmg), 0)
  const restLeft = Math.max(0, restEnd - now)
  const rows = isCardio ? Math.max(prev.length, sets.length + 1, 1) : Math.max(prev.length, sets.length + 1, ex?.target_sets || 3)
  const previewDmg = isCardio ? damageOfMinutes(targetMinutes) : damageOf(targetWeight, targetReps)
  const setsComplete = !isCardio && sets.length >= (ex?.target_sets || 3)

  const complete = async () => {
    let row
    let dmg
    let entry
    if (isCardio) {
      row = { exercise_id: ex.id, weight: 0, reps: 0, duration_min: targetMinutes }
      dmg = damageOfMinutes(targetMinutes)
      entry = { minutes: targetMinutes, dmg }
    } else {
      row = { exercise_id: ex.id, weight: targetWeight, reps: targetReps }
      dmg = damageOf(targetWeight, targetReps)
      entry = { weight: targetWeight, reps: targetReps, dmg }
    }
    setSaving(true)
    const levelBefore = profile.level
    const { data: log, error } = await supabase.from('weight_logs').insert(row).select().single()
    if (error) {
      setSaving(false)
      return notify(`Não foi possível registrar: ${error.message}`, 'red')
    }
    setDone((d) => ({ ...d, [ex.id]: [...(d[ex.id] || []), { id: log.id, ...entry }] }))
    setRestEnd(Date.now() + getRestSeconds() * 1000)

    // o trigger do banco já aplicou XP/dano; sincroniza o estado local
    const fresh = await refreshProfile()
    if (fresh && fresh.level > levelBefore) {
      notify(`NÍVEL ${fresh.level} ALCANÇADO · +${(fresh.level - levelBefore) * 3} PONTOS`, 'gold')
      levelUnlocks(levelBefore, fresh.level).forEach((m) => notify(m, 'gold'))
    }
        if (boss && boss.status === 'active') {
      const after = await getBoss(user.id)
      setBoss(after)
      if (after && after.id === boss.id && after.status === 'defeated') {
        notify(`${after.name} FOI DERROTADO!`, 'gold')
        await awardXp(after.reward_xp)
      }
    }
    if (daily && daily.status === 'active') {
      const { data: freshDaily } = await supabase
        .from('daily_monsters')
        .select('*')
        .eq('id', daily.id)
        .maybeSingle()
      if (freshDaily) {
        setDaily(freshDaily)
        if (freshDaily.status === 'defeated' && daily.status !== 'defeated') {
          notify(`${freshDaily.name} DERROTADO! +50 XP`, 'gold')
          await awardXp(50)
        }
      }
    
    }
    setSaving(false)
  }

  if (finished) {
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
    return (
      <div className="stack">
        <Panel brackets tone="gold">
          <SysHead right="MISSÃO CUMPRIDA">[RELATÓRIO DA SESSÃO]</SysHead>
          <h2 className="h-xl glow">{workout.title || `Ficha ${workout.letter}`} concluída</h2>
          <div className="grid3">
            <div className="reward"><b>{fmt(sessionDmg)}</b><span className="mono tiny dim">DANO (KG)</span></div>
            <div className="reward"><b>{sessionSets}</b><span className="mono tiny dim">SÉRIES</span></div>
            <div className="reward"><b>{mins} min</b><span className="mono tiny dim">DURAÇÃO</span></div>
          </div>
          <p className="mono gold">+{fmt(sessionXp)} XP GRAVADO</p>
        </Panel>
        <Btn onClick={() => go('inicio')}>Voltar ao início</Btn>
        <Btn variant="ghost" onClick={onExit}>Treinar outra ficha</Btn>
      </div>
    )
  }

  if (!ex) return <Empty title="Ficha vazia" action={<Btn onClick={() => go('ficha')}>Adicionar exercícios</Btn>}>Esta ficha ainda não tem exercícios.</Empty>

  const next = exercises[idx + 1]
  const bossPct = boss ? Number(boss.current_hp) / Number(boss.max_hp) : 0
  const restActive = restLeft > 0

  return (
    <div className="stack">
      <div className="row between">
        <button className="link mono tiny" onClick={onExit}><ChevronLeft size={12} /> TROCAR FICHA</button>
        <span className="mono tiny dim">EXERCÍCIO {idx + 1} / {exercises.length}</span>
      </div>

      {boss && boss.status === 'active' && (
        <Panel tone="red">
          <div className="row between">
            <Chip tone="red">RAID ATIVA</Chip>
            <span className="mono tiny dim">{Math.round(bossPct * 100)}% HP</span>
          </div>
          <h3 className="h-md">{boss.name}</h3>
          <SegBar value={Number(boss.current_hp)} max={Number(boss.max_hp)} tone="gold" label="HP do chefe" />
        </Panel>
      )}
      {daily && daily.status === 'active' && (
        <Panel tone="cyan">
          <div className="row between">
            <Chip tone="cyan">MONSTRO DO DIA</Chip>
            <span className="mono tiny dim">
              {Math.round((Number(daily.current_hp) / Number(daily.max_hp)) * 100)}% HP
            </span>
          </div>
          <h3 className="h-md">{daily.name}</h3>
          <SegBar value={Number(daily.current_hp)} max={Number(daily.max_hp)} tone="cyan" label="HP do monstro diário" />
        </Panel>
      )}

      <Panel brackets>
        <p className="mono tiny cyan">[{ex.machine}]</p>
        <h2 className="h-xl">{ex.name}</h2>

        <div className="info-row">
          <Flame size={20} className="cyan" />
          <div>
            <p className="mono tiny dim">IMPACTO NA SESSÃO</p>
            <p>Dano acumulado: <b className="cyan">+{fmt(sessionDmg)} DMG</b></p>
          </div>
        </div>

        <div className="info-row timer">
          <Timer size={20} className="gold" />
          <div className="grow">
            <p className="mono tiny dim">INTERVALO {restActive ? 'ATIVO' : 'LIVRE'}</p>
            <p className="timer-num">{restActive ? clock(restLeft).slice(3) : '00:00'}</p>
          </div>
          {restActive && (
            <>
              <button className="chip chip-slate mono" onClick={() => setRestEnd((e) => e + 30000)}>+30s</button>
              <button className="icon-btn" onClick={() => setRestEnd(0)} aria-label="Pular descanso"><SkipForward size={16} /></button>
            </>
          )}
        </div>

        <p className="mono tiny cyan">
          META: {isCardio ? `${targetMinutes} MIN` : `${ex.target_sets || 3} × ${targetReps}${targetWeight > 0 ? ` · ${fmt1(targetWeight)} KG` : ''}`}
        </p>
        <p className="mono tiny dim">{isCardio ? 'SESSÃO' : 'SÉRIE'} {Math.min(sets.length + 1, ex.target_sets || 3)} · {fmt(sets.length)} CONCLUÍDA{sets.length === 1 ? '' : 'S'}</p>

        <div className="sets" role="table" aria-label="Séries">
          <div className="sets-head mono tiny" role="row">
            <span>{isCardio ? 'SESSÃO' : 'SÉRIE'}</span><span>ANTERIOR</span><span>HOJE</span>
          </div>
          {Array.from({ length: rows }, (_, i) => {
            const isDone = sets[i]
            const isActive = i === sets.length && !setsComplete
            const p = prev[i]
            return (
              <div key={i} className={`set-row ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} role="row">
                <span className="n">{i + 1}</span>
                <span className="mono tiny dim">{p ? (p.duration_min != null ? `${fmt1(p.duration_min)} min` : `${fmt1(p.weight)} kg × ${p.reps}`) : '—'}</span>
                {isDone ? (
                  <b>{isDone.minutes != null ? `${fmt1(isDone.minutes)} min` : `${fmt1(isDone.weight)} kg × ${isDone.reps}`}</b>
                ) : isActive ? (
                  <span className="mono">
                    {isCardio ? `${fmt1(targetMinutes)} min` : `${fmt1(targetWeight)} kg × ${targetReps}`}
                  </span>
                ) : (
                  <span className="dim">—</span>
                )}
              </div>
            )
          })}
        </div>

        <p className="mono tiny gold"><Zap size={12} style={{ verticalAlign: '-2px' }} /> Esta {isCardio ? 'sessão' : 'série'} vale +{xpOf(previewDmg)} XP · {fmt(previewDmg)} dano</p>

        <Btn icon={Swords} className="cta" disabled={saving || restActive || setsComplete} onClick={complete}>
          {saving
            ? 'Gravando...'
            : restActive
              ? 'Aguarde o intervalo...'
              : setsComplete
                ? 'Séries concluídas'
                : isCardio
                  ? 'Concluir cardio & acumular atributos'
                  : 'Concluir série & acumular atributos'}
        </Btn>
      </Panel>

      <div className="row gap">
        <Btn variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} icon={ChevronLeft}>Anterior</Btn>
        {next ? (
          <Btn variant="ghost" onClick={() => setIdx((i) => i + 1)}>Próximo</Btn>
        ) : (
          <Btn variant="ghost" onClick={() => setFinished(true)}>Encerrar treino</Btn>
        )}
      </div>

      {next && (
        <Panel>
          <p className="mono tiny dim">PRÓXIMO COMBO</p>
          <p><b>{next.name}</b> <span className="mono tiny cyan">[{idx + 2}/{exercises.length}]</span></p>
          <button className="link mono tiny" onClick={() => setFinished(true)}>ENCERRAR TREINO AGORA</button>
        </Panel>
      )}
    </div>
  )
}