import { useState } from 'react'
import { Gift, Timer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSession } from '../context/SessionContext'
import { useNow, useQuery } from '../lib/useQuery'
import { getMissions } from '../lib/data'
import { clock, endOfToday, fmt, fmt1 } from '../lib/rpg'
import { Btn, Check, Chip, ErrorNote, Loading, Panel, SegBar, SysHead } from '../components/ui'

export default function Missoes() {
  const { user, awardXp, notify } = useSession()
  const now = useNow()
  const q = useQuery(() => getMissions(user.id), [user.id])
  const [amount, setAmount] = useState({})
  const [busy, setBusy] = useState(null)

  const list = q.data || []
  const overall = list.length ? list.reduce((s, m) => s + Math.min(m.current / m.target, 1), 0) / list.length : 0
  const totalXp = list.reduce((s, m) => s + (m.completed ? m.xp_reward : 0), 0)

  const log = async (m) => {
    const n = Number(amount[m.id] ?? (m.unit === 'km' ? 1 : 10))
    if (!(n > 0)) return notify('Informe um valor maior que zero.', 'red')
    setBusy(m.id)
    const current = Math.min(Number(m.current) + n, Number(m.target))
    const completed = current >= Number(m.target)
    const { error } = await supabase.from('daily_missions').update({ current, completed }).eq('id', m.id)
    setBusy(null)
    if (error) return notify(`Não foi possível registrar: ${error.message}`, 'red')
    setAmount((a) => ({ ...a, [m.id]: '' }))
    await q.reload()
    if (completed && !m.completed) {
      notify(`MISSÃO CONCLUÍDA: ${m.title}`, 'gold')
      await awardXp(m.xp_reward)
    }
  }

  return (
    <div className="stack">
      <Panel brackets>
        <SysHead right={`${Math.round(overall * 100)}% EXECUTADO`}>[MISSÃO DIÁRIA DISPONÍVEL]</SysHead>
        <h2 className="h-xl glow">Daily quest: treino de sobrevivência</h2>
        <p className="muted">Preparação para se tornar um monarca.</p>
        <SegBar value={overall} max={1} label="Taxa de conclusão" />
      </Panel>

      {q.loading ? <Loading /> : <ErrorNote error={q.error} />}

      <div className="stack">
        {list.map((m) => {
          const pct = Math.min(Number(m.current) / Number(m.target), 1)
          const state = m.completed ? 'COMPLETO' : Number(m.current) > 0 ? 'EM PROGRESSO' : 'PENDENTE'
          return (
            <Panel key={m.id} className={`quest ${m.completed ? 'done' : Number(m.current) > 0 ? 'live' : ''}`}>
              <div className="row between">
                <div className="row gap">
                  <Check done={m.completed} active={!m.completed && Number(m.current) > 0} />
                  <h3 className="h-md">{m.title}</h3>
                </div>
                <Chip tone={m.completed ? 'cyan' : 'slate'}>{state}</Chip>
              </div>
              <div className="row between end">
                <BigCount value={fmt1(m.current)} target={`${fmt(m.target)} ${m.unit}`} />
                <span className="mono tiny gold">+{m.xp_reward} XP {m.completed && '[GRAVADO]'}</span>
              </div>
              <div className="bar"><span style={{ width: `${pct * 100}%` }} /></div>
              {!m.completed && (
                <div className="row gap">
                  <input
                    className="num"
                    type="number"
                    min="0"
                    step={m.unit === 'km' ? '0.1' : '1'}
                    inputMode="decimal"
                    value={amount[m.id] ?? ''}
                    placeholder={m.unit === 'km' ? '1' : '10'}
                    onChange={(e) => setAmount((a) => ({ ...a, [m.id]: e.target.value }))}
                    aria-label={`Quantidade de ${m.unit} para ${m.title}`}
                  />
                  <span className="mono tiny dim">{m.unit.toUpperCase()}</span>
                  <Btn variant="ghost" disabled={busy === m.id} onClick={() => log(m)}>Registrar</Btn>
                </div>
              )}
            </Panel>
          )
        })}
      </div>

      <Panel tone="red">
        <SysHead right={<Chip tone="red">URGENTE</Chip>}>
          <Timer size={13} style={{ verticalAlign: '-2px' }} /> TEMPO RESTANTE
        </SysHead>
        <p className="countdown mono">{clock(endOfToday() - now)}</p>
        <p className="notice notice-red mono">[Aviso: a falha em concluir a missão resulta em Zona de Punição]</p>
      </Panel>

      <Panel tone="gold">
        <SysHead right={`${fmt(totalXp)} XP GRAVADO`}>
          <Gift size={13} style={{ verticalAlign: '-2px' }} /> RECOMPENSAS DA MISSÃO
        </SysHead>
        <div className="grid3">
          <div className="reward"><b>+25 a +50 XP</b><span className="mono tiny dim">POR MISSÃO</span></div>
          <div className="reward"><b>+3 pontos</b><span className="mono tiny dim">A CADA NÍVEL</span></div>
          <div className="reward"><b>Rank up</b><span className="mono tiny dim">NÍVEIS 10 · 20 · 30 · 45 · 60</span></div>
        </div>
      </Panel>
    </div>
  )
}

function BigCount({ value, target }) {
  return (
    <span className="bigcount">
      <b>{value}</b> <span className="mono tiny dim">/ {target}</span>
    </span>
  )
}
