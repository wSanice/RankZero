import { useMemo, useState } from 'react'
import { ChevronLeft, Minus, Plus, Save, Search, Swords, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CATALOGO } from '../lib/catalogo'
import { useSession } from '../context/SessionContext'
import { useQuery } from '../lib/useQuery'
import { flatExercises, getLastLogs, getWorkouts } from '../lib/workouts'
import { fmt1, nextLetter } from '../lib/rpg'
import { Btn, Chip, Empty, ErrorNote, Loading, Panel, SysHead } from '../components/ui'

const CARDIO = ['ESTEIRA', 'BICICLETA', 'ELÍPTICO', 'REMO ERGÔMETRO', 'ESCADA (STAIRMASTER)']
const ISOMETRIA = ['PRANCHA']
const LIVRE = ['HALTERES', 'BARRA / ANILHAS']
const kindOf = (name) => (CARDIO.includes(name) ? 'cardio' : ISOMETRIA.includes(name) ? 'isometria' : LIVRE.includes(name) ? 'livre' : 'maquina')
const REST_KEY = 'abibas_rest_seconds'

export default function Ficha({ go }) {
  const { user, notify } = useSession()
  const q = useQuery(getWorkouts, [])
  const [openId, setOpenId] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const list = q.data || []
  const open = list.find((w) => w.id === openId)

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    const letter = nextLetter(list.map((w) => w.letter))
    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, letter, title: newTitle.trim() || `Ficha ${letter}` })
      .select()
      .single()
    setBusy(false)
    if (error) return notify(`Não foi possível criar a ficha: ${error.message}`, 'red')
    setNewTitle('')
    await q.reload()
    setOpenId(data.id)
    notify(`FICHA ${letter} CRIADA`)
  }

  if (q.loading) return <Loading />
  if (q.error) return <ErrorNote error={q.error} />
  if (open) return <Editor workout={open} reload={q.reload} onBack={() => setOpenId(null)} onDeleted={() => { setOpenId(null); q.reload() }} go={go} />

  return (
    <div className="stack">
      <Panel brackets>
        <SysHead>[SISTEMA: ARQUÉTIPO & ESTRUTURA]</SysHead>
        <h2 className="h-xl glow">Forje sua matriz de treino</h2>
        <p className="muted">Cada exercício adicionado canaliza energia dimensional para o seu arquétipo. Crie uma ficha por dia de treino.</p>
      </Panel>

      {list.length === 0 && <Empty title="Nenhuma ficha ainda">Dê um nome à sua primeira ficha abaixo, por exemplo "Peito e tríceps".</Empty>}

      {list.map((w) => {
        const n = flatExercises(w).length
        return (
          <button key={w.id} className="panel pick" onClick={() => setOpenId(w.id)}>
            <span className="letter">{w.letter}</span>
            <span className="grow left">
              <b className="h-md">{w.title || `Ficha ${w.letter}`}</b>
              <span className="mono tiny dim">{w.machines.length} MÁQUINAS · {n} EXERCÍCIOS</span>
            </span>
            <Chip tone="cyan">EDITAR</Chip>
          </button>
        )
      })}

      <form className="panel" onSubmit={create}>
        <SysHead>[NOVA FICHA: {nextLetter(list.map((w) => w.letter))}]</SysHead>
        <label className="field">
          <span className="mono tiny">TÍTULO DA ROTINA DE COMBATE</span>
          <div className="field-box">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Divisão pesada de peito e tríceps" maxLength={60} />
          </div>
        </label>
        <Btn type="submit" icon={Plus} disabled={busy}>Criar ficha</Btn>
      </form>
    </div>
  )
}

function Editor({ workout, reload, onBack, onDeleted, go }) {
  const { notify } = useSession()
  const [title, setTitle] = useState(workout.title || '')
  const [picker, setPicker] = useState(false)
  const [rest, setRest] = useState(() => Number(localStorage.getItem(REST_KEY)) || 90)
  const ids = flatExercises(workout).map((e) => e.id)
  const last = useQuery(() => getLastLogs(ids), [ids.join(',')])

  const setRestSec = (v) => {
    const n = Math.min(300, Math.max(15, v))
    setRest(n)
    localStorage.setItem(REST_KEY, String(n))
  }

  const saveTitle = async () => {
    const t = title.trim() || `Ficha ${workout.letter}`
    if (t === workout.title) return
    const { error } = await supabase.from('workouts').update({ title: t }).eq('id', workout.id)
    if (error) return notify(`Não foi possível salvar: ${error.message}`, 'red')
    notify('TÍTULO SALVO')
    reload()
  }

  const saveTarget = async (id, patch) => {
    const { error } = await supabase.from('exercises').update(patch).eq('id', id)
    if (error) return notify(`Não foi possível salvar a meta: ${error.message}`, 'red')
    reload()
  }

  const removeExercise = async (id) => {
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error) return notify(error.message, 'red')
    reload()
  }
  const removeMachine = async (m) => {
    if (!window.confirm(`Remover ${m.name} e seus exercícios da ficha?`)) return
    const { error } = await supabase.from('machines').delete().eq('id', m.id)
    if (error) return notify(error.message, 'red')
    reload()
  }
  const removeWorkout = async () => {
    if (!window.confirm(`Excluir a ficha ${workout.letter}? O histórico de cargas dela também será apagado.`)) return
    const { error } = await supabase.from('workouts').delete().eq('id', workout.id)
    if (error) return notify(error.message, 'red')
    onDeleted()
  }

  const addFromCatalog = async (entry, chosen) => {
    let machine = workout.machines.find((m) => m.name === entry.name)
    if (!machine) {
      const { data, error } = await supabase
        .from('machines')
        .insert({ workout_id: workout.id, name: entry.name, kind: kindOf(entry.name), position: workout.machines.length })
        .select()
        .single()
      if (error) return notify(error.message, 'red')
      machine = { ...data, exercises: [] }
    }
    const start = machine.exercises.length
    const { error } = await supabase
      .from('exercises')
      .insert(chosen.map((name, i) => ({ machine_id: machine.id, name, position: start + i })))
    if (error) return notify(error.message, 'red')
    setPicker(false)
    notify(`${chosen.length} EXERCÍCIO(S) ADICIONADO(S)`)
    reload()
  }

  return (
    <div className="stack">
      <div className="row between">
        <button className="link mono tiny" onClick={onBack}><ChevronLeft size={12} /> TODAS AS FICHAS</button>
        <button className="link mono tiny red" onClick={removeWorkout}><Trash2 size={12} /> EXCLUIR FICHA</button>
      </div>

      <Panel brackets>
        <SysHead right={`FICHA ${workout.letter}`}>[REGISTRO DA MATRIZ]</SysHead>
        <label className="field">
          <span className="mono tiny">TÍTULO DA ROTINA DE COMBATE</span>
          <div className="field-box">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} maxLength={60} />
            <button className="icon-btn plain" onClick={saveTitle} aria-label="Salvar título"><Save size={16} /></button>
          </div>
        </label>
        <Btn icon={Swords} variant="ghost" onClick={() => go('treinar', { workoutId: workout.id })} disabled={!ids.length}>Treinar esta ficha</Btn>
      </Panel>

      <h3 className="mono tiny dim">MATRIZ DE COMBATE: {ids.length} EXERCÍCIOS</h3>

      {workout.machines.length === 0 && <Empty title="Ficha vazia">Adicione máquinas e exercícios do catálogo.</Empty>}

      {workout.machines.map((m) => (
        <Panel key={m.id}>
          <div className="row between">
            <div>
              <h3 className="h-md">{m.name}</h3>
              <Chip tone={m.kind === 'cardio' ? 'violet' : 'cyan'}>{(m.kind || 'maquina').toUpperCase()}</Chip>
            </div>
            <button className="icon-btn" onClick={() => removeMachine(m)} aria-label={`Remover ${m.name}`}><Trash2 size={16} /></button>
          </div>
          <ul className="ex-list">
            {m.exercises.map((e) => {
              const l = last.data?.[e.id]
              const cardio = m.kind === 'cardio'
              const isometria = m.kind === 'isometria'
              return (
                <li key={e.id}>
                  <div className="row between">
                    <b>{e.name}</b>
                    <button className="icon-btn plain" onClick={() => removeExercise(e.id)} aria-label={`Remover ${e.name}`}><X size={16} /></button>
                  </div>
                  <div className="targets">
                    {cardio ? (
                      <Target label="TEMPO" unit="MIN" min={1} value={e.target_minutes} onSave={(v) => saveTarget(e.id, { target_minutes: v })} />
                    ) : isometria ? (
                      <>
                        <Target label="TEMPO" unit="SEG" min={5} value={e.target_minutes} onSave={(v) => saveTarget(e.id, { target_minutes: v })} />
                        <Target label="REPS" min={1} value={e.target_reps} onSave={(v) => saveTarget(e.id, { target_reps: v })} />
                      </>
                    ) : (
                      <>
                        <Target label="SÉRIES" min={1} value={e.target_sets} onSave={(v) => saveTarget(e.id, { target_sets: v })} />
                        <Target label="REPS" min={1} value={e.target_reps} onSave={(v) => saveTarget(e.id, { target_reps: v })} />
                        <Target label="CARGA" unit="KG" step="0.25" value={e.target_weight} onSave={(v) => saveTarget(e.id, { target_weight: v })} />
                      </>
                    )}
                  </div>
                  <span className="mono tiny dim">
                    {l ? `ÚLTIMO REGISTRO: ${l.duration_min != null ? `${fmt1(l.duration_min)} min` : `${fmt1(l.weight)} kg × ${l.reps}`}` : 'SEM REGISTRO AINDA'}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      ))}

      <Btn variant="ghost" icon={Plus} onClick={() => setPicker(true)}>Adicionar exercício à ficha</Btn>

      <Panel>
        <SysHead>[CRONÔMETRO DE DESCANSO PADRÃO]</SysHead>
        <p className="muted">Intervalo automático entre séries.</p>
        <div className="stepper">
          <button className="chip chip-slate mono" onClick={() => setRestSec(rest - 15)}><Minus size={12} /> 15s</button>
          <b className="h-xl">{rest} <span className="mono tiny">SEG</span></b>
          <button className="chip chip-slate mono" onClick={() => setRestSec(rest + 15)}><Plus size={12} /> 15s</button>
        </div>
        <div className="quick">
          {[[45, 'Agilidade'], [90, 'Hipertrofia'], [120, 'Força pura']].map(([s, l]) => (
            <button key={s} className={`chip mono ${rest === s ? 'chip-cyan' : 'chip-slate'}`} onClick={() => setRestSec(s)}>{s}s ({l})</button>
          ))}
        </div>
      </Panel>

      {picker && <Picker onClose={() => setPicker(false)} onAdd={addFromCatalog} />}
    </div>
  )
}

function Picker({ onClose, onAdd }) {
  const [term, setTerm] = useState('')
  const [entry, setEntry] = useState(null)
  const [chosen, setChosen] = useState([])

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (!t) return CATALOGO
    return CATALOGO.filter((c) => c.name.toLowerCase().includes(t) || c.exercises.some((e) => e.toLowerCase().includes(t)))
  }, [term])

  const toggle = (name) => setChosen((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]))

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Catálogo de exercícios">
      <div className="sheet-body panel brackets">
        <div className="row between">
          <h3 className="h-lg">{entry ? entry.name : 'Catálogo de máquinas'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        {!entry ? (
          <>
            <label className="field-box search-sticky">
              <Search size={16} />
              <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar máquina ou exercício" />
            </label>
            <ul className="cat-list">
              {filtered.map((c) => (
                <li key={c.name}>
                  <button onClick={() => { setEntry(c); setChosen([]) }}>
                    <b>{c.name}</b>
                    <span className="mono tiny dim">{c.exercises.length} EXERCÍCIOS</span>
                  </button>
                </li>
              ))}
              {!filtered.length && <li className="muted pad">Nada encontrado para "{term}".</li>}
            </ul>
          </>
        ) : (
          <>
            <p className="muted">Escolha os exercícios desta máquina.</p>
            <ul className="cat-list">
              {entry.exercises.map((name) => (
                <li key={name}>
                  <label className={`opt ${chosen.includes(name) ? 'on' : ''}`}>
                    <input type="checkbox" checked={chosen.includes(name)} onChange={() => toggle(name)} />
                    <span>{name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="row gap">
              <Btn variant="ghost" onClick={() => setEntry(null)}>Voltar</Btn>
              <Btn disabled={!chosen.length} onClick={() => onAdd(entry, chosen)}>Adicionar ({chosen.length})</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Campo numérico que salva ao sair do campo
function Target({ label, value, unit, step = '1', min = 0, onSave }) {
  const commit = (ev) => {
    const v = Number(ev.target.value)
    if (ev.target.value !== '' && Number.isFinite(v) && v >= min) {
      if (v !== Number(value)) onSave(v)
    } else {
      ev.target.value = value
    }
  }
  return (
    <label className="target">
      <span className="mono tiny dim">{label}</span>
      <span className="target-box">
        <input className="num" type="number" inputMode="decimal" min={min} step={step} defaultValue={value} key={value} onBlur={commit} />
        {unit && <span className="mono tiny dim">{unit}</span>}
      </span>
    </label>
  )
}
