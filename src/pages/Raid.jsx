import { useMemo, useState } from 'react'
import { Skull, Trophy } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useNow, useQuery, must } from '../lib/useQuery'
import { supabase } from '../lib/supabase'
import { getBoss, summonBoss } from '../lib/data'
import { fmt, startOfToday } from '../lib/rpg'
import { Btn, Chip, ErrorNote, Loading, Panel, SegBar, SysHead } from '../components/ui'

export default function Raid({ go }) {
  const { user, notify } = useSession()
  const now = useNow(60000)
  const [busy, setBusy] = useState(false)
  const boss = useQuery(() => getBoss(user.id), [user.id])
  const today = useQuery(async () => {
    const rows = must(
      await supabase
        .from('combat_log')
        .select('damage, logged_at, exercise:exercises(name)')
        .gte('logged_at', startOfToday().toISOString())
        .order('logged_at', { ascending: false })
    )
    return rows
  }, [user.id])

  const b = boss.data
  const byExercise = useMemo(() => {
    const map = {}
    for (const r of today.data || []) {
      const k = r.exercise?.name || 'Exercício removido'
      map[k] = (map[k] || 0) + Number(r.damage)
    }
    return Object.entries(map).sort((a, z) => z[1] - a[1])
  }, [today.data])
  const todayDamage = byExercise.reduce((s, [, v]) => s + v, 0)

  const summon = async () => {
    setBusy(true)
    try {
      await summonBoss(user.id)
      notify('PORTAL VERMELHO ABERTO. A RAID COMEÇOU.', 'red')
      await boss.reload()
    } catch (e) {
      notify(`Não foi possível invocar a raid: ${e.message}`, 'red')
    } finally {
      setBusy(false)
    }
  }

  if (boss.loading) return <Loading />
  if (boss.error) return <ErrorNote error={boss.error} />

  const daysLeft = b?.deadline ? Math.max(0, Math.ceil((new Date(b.deadline) - now) / 86400000)) : null
  const closed = !b || b.status !== 'active'

  return (
    <div className="stack">
      {b && (
        <Panel tone={closed ? 'gold' : 'red'}>
          <div className="row between">
            <span className="mono">{closed ? (b.status === 'defeated' ? 'PORTAL ENCERRADO' : 'PORTAL COLAPSADO') : 'PORTAL VERMELHO'}</span>
            {daysLeft !== null && !closed && <Chip tone="red">FALTAM {daysLeft} DIAS</Chip>}
          </div>
          <p className="muted">
            {closed
              ? b.status === 'defeated'
                ? 'O guardião caiu. A recompensa foi concedida.'
                : 'O prazo terminou antes da eliminação. Invoque uma nova raid.'
              : 'Dungeon dimensional em colapso. Elimine o guardião antes do prazo para impedir a invasão.'}
          </p>
        </Panel>
      )}

      {b ? (
        <Panel brackets tone={closed ? 'gold' : 'red'} className="boss">
          <p className="mono tiny cyan">CLASSIFICAÇÃO: CHEFE DE RAID</p>
          <p className="mono tiny dim">{b.subtitle}</p>
          <div className="row gap">
            <span className="boss-icon big"><Skull size={34} /></span>
            <h2 className="h-xl">{b.name}</h2>
          </div>
          <div className="row between end">
            <span className="mono tiny">HP DO CHEFE <br />{fmt(b.current_hp)} / {fmt(b.max_hp)} KG</span>
            <span className="pct">{Math.round((Number(b.current_hp) / Number(b.max_hp)) * 100)}%</span>
          </div>
          <SegBar value={Number(b.current_hp)} max={Number(b.max_hp)} tone="gold" segments={10} label="HP do chefe" />
          <div className="row between mono tiny">
            <span className="cyan">Regra: 1 kg levantado × 1 rep = 1 dano</span>
            <span>{fmt(Number(b.max_hp) - Number(b.current_hp))} dano causado</span>
          </div>
        </Panel>
      ) : (
        <Panel className="empty">
          <h3 className="h-md">Nenhuma raid ativa</h3>
          <p className="muted">Invoque um boss e cada série do treino vira dano real.</p>
        </Panel>
      )}

      {closed && (
        <Btn icon={Skull} disabled={busy} onClick={summon}>
          {busy ? 'Abrindo portal...' : 'Invocar nova raid'}
        </Btn>
      )}

      <Panel>
        <SysHead right={<Chip tone="cyan">HOJE</Chip>}>[REGISTRO DE COMBATE]</SysHead>
        {today.loading ? (
          <Loading />
        ) : (
          <>
            <p><b className="h-xl cyan">{fmt(todayDamage)}</b> <span className="mono tiny">DMG INFLIGIDO HOJE</span></p>
            {byExercise.length ? (
              <ul className="log-list">
                {byExercise.map(([name, dmg]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span className="mono">{fmt(dmg)} kg</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhuma série registrada hoje. Inicie um treino para atacar o boss.</p>
            )}
          </>
        )}
      </Panel>

      {b && (
        <Panel tone="gold">
          <SysHead right={<Chip tone="gold">RECOMPENSA</Chip>}>
            <Trophy size={13} style={{ verticalAlign: '-2px' }} /> RECOMPENSAS DA VITÓRIA
          </SysHead>
          <div className="reward-row"><b>+{fmt(b.reward_xp)} XP</b><span className="mono tiny dim">CONCEDIDO AO DERROTAR</span></div>
          {b.reward_text && <div className="reward-row"><b>{b.reward_text}</b><span className="mono tiny dim">TÍTULO / ITEM</span></div>}
        </Panel>
      )}

      {!closed && <Btn onClick={() => go('treinar')}>Lançar ataque com treino de hoje</Btn>}
    </div>
  )
}
