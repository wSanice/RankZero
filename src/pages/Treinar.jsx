import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, SkipForward, Swords, Timer, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSession } from '../context/SessionContext'
import { useNow, useQuery, must } from '../lib/useQuery'
import { flatExercises, getWorkouts } from '../lib/workouts'
import { clock, damageOf, damageOfMinutes, fmt, fmt1, levelUnlocks, localDate, xpOf } from '../lib/rpg'
import { Btn, Chip, Empty, ErrorNote, Loading, Panel, SegBar, SysHead } from '../components/ui'
import { getBoss, getDailyMonster, getGlobalBoss, hitGlobalBoss, abandonDailyMonster, getRaidPartners, getRaidDamageByMember } from '../lib/data'
import { INVOKABLE_BOSSES } from '../lib/rpg'

const REST_KEY = 'abibas_rest_seconds'
export const getRestSeconds = () => Number(localStorage.getItem(REST_KEY)) || 90

// a ficha ativa (qual ficha o caçador estava treinando) sobrevive à troca de
// tela — assim, sair pro início/ficha e voltar pra "Treinar" retoma o mesmo
// treino em vez de mostrar a lista de fichas de novo
const activeWorkoutKey = (uid) => `rankzero_active_workout_${uid}`

export default function Treinar({ go, params }) {
  const { user } = useSession()
  const [workoutId, setWorkoutId] = useState(() => params?.workoutId || localStorage.getItem(activeWorkoutKey(user.id)) || null)
  const q = useQuery(getWorkouts, [])

  useEffect(() => {
    const key = activeWorkoutKey(user.id)
    if (workoutId) localStorage.setItem(key, workoutId)
    else localStorage.removeItem(key)
  }, [workoutId, user.id])

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

  // "trocar ficha" só tira a ficha ativa de vista — o progresso dela fica salvo
  // e retoma sozinho se o caçador escolhê-la de novo na lista
  return (
    <SessionView
      key={workout.id}
      workout={workout}
      onExit={() => setWorkoutId(null)}
      onFinishAll={() => setWorkoutId(null)}
      go={go}
    />
  )
}

// progresso da sessão (exercício atual, séries feitas, descanso, se já terminou)
// — salvo por caçador + ficha, pra sobreviver a navegar pra outra tela e voltar
const sessionStateKey = (uid, workoutId) => `rankzero_session_state_${uid}_${workoutId}`
const loadSessionState = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function SessionView({ workout, onExit, onFinishAll, go }) {
  const { user, profile, refreshProfile, awardXp, notify } = useSession()
  const stateKey = sessionStateKey(user.id, workout.id)
  const saved = useMemo(() => loadSessionState(stateKey), [stateKey])

  const now = useNow(500)
  const exercises = useMemo(() => flatExercises(workout), [workout])
  const [idx, setIdx] = useState(saved?.idx ?? 0)
  const [done, setDone] = useState(saved?.done ?? {}) // exerciseId -> [{weight, reps, dmg}]
  const [saving, setSaving] = useState(false)
  const [restEnd, setRestEnd] = useState(saved?.restEnd ?? 0)
  const [finished, setFinished] = useState(saved?.finished ?? false)
  const startedAt = useRef(saved?.startedAt ?? Date.now())
  const [boss, setBoss] = useState(null)

  // persiste a sessão a cada mudança relevante, pra retomar de onde parou
  // se o caçador sair da tela (tela inicial, ficha, etc.) e voltar depois
  useEffect(() => {
    localStorage.setItem(stateKey, JSON.stringify({ idx, done, restEnd, finished, startedAt: startedAt.current }))
  }, [stateKey, idx, done, restEnd, finished])

  const clearSession = () => {
    try { localStorage.removeItem(stateKey) } catch { }
  }

  const ex = exercises[idx]
  const sets = done[ex?.id] || []
  const isCardio = ex?.kind === 'cardio'
  const isCardioLivre = ex?.kind === 'cardio_livre'
  const isIsometria = ex?.kind === 'isometria'

  const timerKey = ex ? `cardio_timer_${ex.id}` : null
  const [timer, setTimer] = useState(null) // regressivo: { endAt, running, remainingMs }
  const autoCompletedRef = useRef(false)

  // cronômetro livre (caminhada/corrida ao ar livre): conta PRA CIMA a partir
  // de 0, sem meta fixa — inicia, conta e só encerra quando o caçador manda,
  // e ao parar salva o tempo decorrido como duration_min da sessão
  const stopwatchKey = ex ? `cardio_stopwatch_${ex.id}` : null
  const [stopwatch, setStopwatch] = useState(null) // { startedAt, running, elapsedMs }

  // carrega/recarrega o timer salvo sempre que troca de exercício
  useEffect(() => {
    autoCompletedRef.current = false
    if (!timerKey) { setTimer(null); setStopwatch(null); return }
    const raw = localStorage.getItem(timerKey)
    setTimer(raw ? JSON.parse(raw) : null)
    const rawSw = localStorage.getItem(stopwatchKey)
    setStopwatch(rawSw ? JSON.parse(rawSw) : null)
  }, [timerKey, stopwatchKey])

  const saveTimer = (t) => {
    setTimer(t)
    if (!timerKey) return
    if (t) localStorage.setItem(timerKey, JSON.stringify(t))
    else localStorage.removeItem(timerKey)
  }

  const saveStopwatch = (s) => {
    setStopwatch(s)
    if (!stopwatchKey) return
    if (s) localStorage.setItem(stopwatchKey, JSON.stringify(s))
    else localStorage.removeItem(stopwatchKey)
  }

  const startTimer = () => {
    saveTimer({ endAt: Date.now() + targetMinutes * 60000, running: true, remainingMs: null })
  }
  const pauseTimer = () => {
    if (!timer?.running) return
    saveTimer({ ...timer, running: false, remainingMs: Math.max(0, timer.endAt - Date.now()) })
  }
  const resumeTimer = () => {
    if (timer?.running) return
    saveTimer({ endAt: Date.now() + (timer.remainingMs || 0), running: true, remainingMs: null })
  }
  const cancelTimer = () => saveTimer(null)

  const startStopwatch = () => {
    saveStopwatch({ startedAt: Date.now(), running: true, elapsedMs: 0 })
  }
  const pauseStopwatch = () => {
    if (!stopwatch?.running) return
    saveStopwatch({ ...stopwatch, running: false, elapsedMs: Date.now() - stopwatch.startedAt })
  }
  const resumeStopwatch = () => {
    if (stopwatch?.running) return
    saveStopwatch({ startedAt: Date.now() - (stopwatch.elapsedMs || 0), running: true, elapsedMs: stopwatch.elapsedMs })
  }
  const cancelStopwatch = () => saveStopwatch(null)

  const stopwatchElapsedMs = stopwatch ? (stopwatch.running ? Date.now() - stopwatch.startedAt : stopwatch.elapsedMs) : 0

  // "Parar": encerra o cronômetro livre e grava o tempo feito como a sessão
  const stopStopwatch = () => {
    const ms = stopwatch ? (stopwatch.running ? Date.now() - stopwatch.startedAt : stopwatch.elapsedMs) : 0
    cancelStopwatch()
    complete({ minutesOverride: ms / 60000 })
  }

  const timerRemainingMs = timer ? (timer.running ? Math.max(0, timer.endAt - now) : timer.remainingMs) : 0
  const timerDone = timer && timer.running && timerRemainingMs <= 0

  useEffect(() => {
    if (timerDone && !autoCompletedRef.current && !saving) {
      autoCompletedRef.current = true
      cancelTimer()
      complete()
    }
  }, [timerDone, saving])
  // boss ativo para mostrar HP e detectar vitória
  useEffect(() => {
    getBoss(user.id).then(setBoss).catch(() => { })
  }, [user.id])

  // raid em dupla: quando a raid ativa tem um amigo convidado, mostra os dois
  // caçadores e o dano de cada um contra o chefe
  const [raidMembers, setRaidMembers] = useState(null)
  useEffect(() => {
    if (!boss || boss.status !== 'active') { setRaidMembers(null); return }
    let cancelled = false
    getRaidDamageByMember(boss.id)
      .then((rows) => { if (!cancelled) setRaidMembers(rows.length > 1 ? rows : null) })
      .catch(() => { if (!cancelled) setRaidMembers(null) })
    return () => { cancelled = true }
  }, [boss?.id, boss?.status, boss?.current_hp])

  const [daily, setDaily] = useState(null)

  // se o boss ativo hoje É o mini-boss do marco de 15 dias, ele substitui o monstro diário
  const isMiniBossDay = boss && boss.status === 'active' && boss.name?.startsWith('SENTINELA DO MARCO')

  useEffect(() => {
    if (boss === null) return // ainda não sabemos se tem mini-boss hoje, espera
    if (isMiniBossDay) {
      setDaily(null)
      return
    }
    getDailyMonster(user.id, profile.level).then(setDaily).catch(() => { })
  }, [user.id, isMiniBossDay, boss])

  // Sair da dungeon diária: desiste do monstro do dia sem derrotá-lo, ele some
  // pelo resto do dia e um novo nasce amanhã. Só o monstro diário tem essa opção —
  // o Boss Quinzenal e o de Campanha (90 dias) são cooperativos/globais, então o
  // caçador fica "preso" neles até o fim do ciclo (não há o que abandonar sozinho).
  const [leavingDaily, setLeavingDaily] = useState(false)
  const leaveDaily = async () => {
    if (!daily) return
    setLeavingDaily(true)
    try {
      await abandonDailyMonster(daily.id)
      setDaily((d) => (d ? { ...d, status: 'abandoned' } : d))
      notify('VOCÊ SAIU DA DUNGEON DIÁRIA')
    } catch (e) {
      notify(`Não foi possível sair: ${e.message}`, 'red')
    } finally {
      setLeavingDaily(false)
    }
  }

  const [globalBoss, setGlobalBoss] = useState(null)

  useEffect(() => {
    getGlobalBoss().then(setGlobalBoss).catch(() => { })
  }, [])

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
  const rows = (isCardio || isCardioLivre) ? Math.max(prev.length, sets.length + 1, 1) : Math.max(prev.length, sets.length + 1, ex?.target_sets || 3)
  const previewDmg = isCardioLivre ? damageOfMinutes(stopwatchElapsedMs / 60000) : isCardio ? damageOfMinutes(targetMinutes) : damageOf(targetWeight, targetReps)
  const setsComplete = !isCardio && !isCardioLivre && sets.length >= (ex?.target_sets || 3)

  const complete = async ({ minutesOverride } = {}) => {
    if (isCardio) cancelTimer()
    let row
    let dmg
    let entry
    if (isCardioLivre) {
      // caminhada/corrida ao ar livre: sem meta — o tempo gravado é o que o
      // cronômetro livre mediu (mínimo de 0.1 min pra evitar sessão de 0 dano)
      const mins = Math.max(0.1, Number(minutesOverride) || 0)
      row = { exercise_id: ex.id, weight: 0, reps: 0, duration_min: mins }
      dmg = damageOfMinutes(mins)
      entry = { minutes: mins, dmg }
    } else if (isCardio) {

      row = { exercise_id: ex.id, weight: 0, reps: 0, duration_min: targetMinutes }
      dmg = damageOfMinutes(targetMinutes)
      entry = { minutes: targetMinutes, dmg }
    } else if (isIsometria) {
      row = { exercise_id: ex.id, weight: 0, reps: targetReps, duration_min: targetMinutes }
      dmg = damageOfMinutes(targetMinutes) // ou uma fórmula própria
      entry = { minutes: targetMinutes, reps: targetReps, dmg }
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
    if (globalBoss && globalBoss.status === 'active') {
      await hitGlobalBoss(user.id, dmg)
      const freshGlobal = await getGlobalBoss()
      setGlobalBoss(freshGlobal)
      if (freshGlobal === null || freshGlobal.status === 'defeated') {
        notify(`${globalBoss.name} FOI DERROTADO PELA COMUNIDADE!`, 'gold')
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
        <Btn onClick={() => { clearSession(); onFinishAll ? onFinishAll() : onExit(); go('inicio') }}>Voltar ao início</Btn>
        <Btn variant="ghost" onClick={() => { clearSession(); onFinishAll ? onFinishAll() : onExit() }}>Treinar outra ficha</Btn>
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
            <Chip tone="red">{raidMembers ? 'RAID EM DUPLA ATIVA' : 'RAID ATIVA'}</Chip>
            <span className="mono tiny dim">{Math.round(bossPct * 100)}% HP</span>
          </div>
          <h3 className="h-md">{boss.name}</h3>
          <SegBar value={Number(boss.current_hp)} max={Number(boss.max_hp)} tone="gold" label="HP do chefe" />
          {raidMembers && (
            <div className="row gap wrap" style={{ marginTop: '0.5rem' }}>
              {raidMembers.map((m) => {
                const mine = m.userId === user.id
                const label = m.profile?.hunter_name || m.profile?.name || 'Caçador'
                return (
                  <div key={m.userId} className="reward" style={{ flex: '1 1 auto' }}>
                    <b className={mine ? 'cyan' : ''}>{fmt(m.damage)}</b>
                    <span className="mono tiny dim">{label}{mine ? ' (VOCÊ)' : ''} · DANO</span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      )}
      {daily && daily.status === 'active' && (
        <Panel tone="amber">
          <div className="row between">
            <Chip tone="amber">MONSTRO DO DIA</Chip>
            <span className="mono tiny dim">
              {Math.round((Number(daily.current_hp) / Number(daily.max_hp)) * 100)}% HP
            </span>
          </div>
          <h3 className="h-md">{daily.name}</h3>
          <p className="mono tiny dim">
            NÍVEL {daily.boss_level || 1}
            {daily.weak_vs && ` · FRACO CONTRA ${daily.weak_vs.toUpperCase()} (+${Math.round((Number(daily.bonus_mult || 1.2) - 1) * 100)}% DANO)`}
          </p>
          {daily.weak_vs && (
            <p className="mono tiny gold">
              {daily.weak_vs === profile.class
                ? `Sua classe explora a fraqueza: dano x${daily.bonus_mult || 1.2}`
                : 'Sua classe não é a fraqueza deste monstro: dano normal'}
            </p>
          )}
          <SegBar value={Number(daily.current_hp)} max={Number(daily.max_hp)} tone="amber" label="HP do monstro diário" />
          <button className="link mono tiny" disabled={leavingDaily} onClick={leaveDaily}>
            {leavingDaily ? 'SAINDO...' : 'SAIR DA DUNGEON DIÁRIA'}
          </button>
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
          META: {isCardioLivre ? 'LIVRE · SEM TEMPO FIXO' : isCardio ? `${targetMinutes} MIN` : `${ex.target_sets || 3} × ${targetReps}${targetWeight > 0 ? ` · ${fmt1(targetWeight)} KG` : ''}`}
        </p>
        <p className="mono tiny dim">{(isCardio || isCardioLivre) ? 'SESSÃO' : 'SÉRIE'} {Math.min(sets.length + 1, ex.target_sets || 3)} · {fmt(sets.length)} CONCLUÍDA{sets.length === 1 ? '' : 'S'}</p>

        <div className="sets" role="table" aria-label="Séries">
          <div className="sets-head mono tiny" role="row">
            <span>{(isCardio || isCardioLivre) ? 'SESSÃO' : 'SÉRIE'}</span><span>ANTERIOR</span><span>HOJE</span>
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
                    {isCardioLivre ? 'cronômetro livre' : isCardio ? `${fmt1(targetMinutes)} min` : `${fmt1(targetWeight)} kg × ${targetReps}`}
                  </span>
                ) : (
                  <span className="dim">—</span>
                )}
              </div>
            )
          })}
        </div>

        <p className="mono tiny gold"><Zap size={12} style={{ verticalAlign: '-2px' }} /> Esta sessão vale +{xpOf(previewDmg)} XP · {fmt(previewDmg)} dano</p>

        {isCardioLivre ? (
          <>
            <div className="info-row timer">
              <Timer size={20} className="cyan" />
              <div className="grow">
                <p className="mono tiny dim">{stopwatch ? (stopwatch.running ? 'CRONÔMETRO ATIVO' : 'PAUSADO') : 'PARADO'}</p>
                <p className="timer-num">{clock(stopwatchElapsedMs)}</p>
              </div>
            </div>
            {!stopwatch && (
              <Btn icon={Swords} className="cta" disabled={saving || restActive} onClick={startStopwatch}>
                Iniciar
              </Btn>
            )}
            {stopwatch && stopwatch.running && (
              <div className="row gap">
                <Btn variant="ghost" onClick={pauseStopwatch}>Pausar</Btn>
                <Btn variant="danger" onClick={stopStopwatch} disabled={saving}>{saving ? 'Gravando...' : 'Parar & registrar'}</Btn>
              </div>
            )}
            {stopwatch && !stopwatch.running && (
              <div className="row gap">
                <Btn onClick={resumeStopwatch}>Retomar</Btn>
                <Btn variant="danger" onClick={stopStopwatch} disabled={saving}>{saving ? 'Gravando...' : 'Parar & registrar'}</Btn>
              </div>
            )}
          </>
        ) : isCardio ? (
          <>
            {timer && (
              <div className="info-row timer">
                <Timer size={20} className="cyan" />
                <div className="grow">
                  <p className="mono tiny dim">{timer.running ? 'CRONÔMETRO ATIVO' : 'PAUSADO'}</p>
                  <p className="timer-num">{clock(timerRemainingMs)}</p>
                </div>
              </div>
            )}
            {!timer && (
              <Btn icon={Swords} className="cta" disabled={saving || restActive} onClick={startTimer}>
                Começar cardio ({targetMinutes} min)
              </Btn>
            )}
            {timer && timer.running && (
              <div className="row gap">
                <Btn variant="ghost" onClick={pauseTimer}>Pausar</Btn>
                <Btn variant="danger" onClick={cancelTimer}>Cancelar</Btn>
              </div>
            )}
            {timer && !timer.running && (
              <div className="row gap">
                <Btn onClick={resumeTimer}>Retomar</Btn>
                <Btn variant="danger" onClick={cancelTimer}>Cancelar</Btn>
              </div>
            )}
          </>
        ) : (
          <Btn icon={Swords} className="cta" disabled={saving || restActive || setsComplete} onClick={complete}>
            {saving ? 'Gravando...' : restActive ? 'Aguarde o intervalo...' : setsComplete ? 'Séries concluídas' : 'Concluir série & acumular atributos'}
          </Btn>
        )}
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