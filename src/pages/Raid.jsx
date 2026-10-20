import { useMemo, useState, useEffect } from 'react'
import { ChevronRight, Skull, Trophy, Users } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useNow, useQuery, must } from '../lib/useQuery'
import { supabase } from '../lib/supabase'
import { getBoss, getGlobalBoss, summonInvokableBoss, getBiweeklyBoss, getCampaign90Boss, getRaidDamageByMember } from '../lib/data'
import { fmt, startOfToday, INVOKABLE_BOSSES } from '../lib/rpg'
import { Btn, Chip, ErrorNote, Loading, Panel, SegBar, SysHead } from '../components/ui'

export default function Raid({ go, params }) {
  const { user, notify } = useSession()
  const now = useNow(60000)
  const [busy, setBusy] = useState(false)
  const boss = useQuery(() => getBoss(user.id), [user.id])
  const [globalBoss, setGlobalBoss] = useState(null)
  const [biweekly, setBiweekly] = useState(null)
  const [campaign90, setCampaign90] = useState(null)
  // o Boss de 90 dias nasce escondido atrás do portão (mesma arte da tela inicial);
  // o caçador precisa clicar pra revelar quem está por trás
  const [gate90Open, setGate90Open] = useState(false)

  // veio de "Convidar p/ raid" no Perfil: esse amigo entra como parceiro
  // assim que uma raid for invocada
  const invitePartnerId = params?.invitePartnerId || null
  const [invitePartner, setInvitePartner] = useState(null)
  useEffect(() => {
    if (!invitePartnerId) { setInvitePartner(null); return }
    supabase.from('profiles').select('id, hunter_name, name, tag, avatar_url').eq('id', invitePartnerId).maybeSingle()
      .then(({ data }) => setInvitePartner(data))
      .catch(() => {})
  }, [invitePartnerId])

  // raid em dupla ativa: dano de cada membro (eu + convidado) contra o chefe atual
  const [raidMembers, setRaidMembers] = useState(null)
  useEffect(() => {
    const b = boss.data
    if (!b || b.status !== 'active') { setRaidMembers(null); return }
    let cancelled = false
    getRaidDamageByMember(b.id)
      .then((rows) => { if (!cancelled) setRaidMembers(rows.length > 1 ? rows : null) })
      .catch(() => { if (!cancelled) setRaidMembers(null) })
    return () => { cancelled = true }
  }, [boss.data?.id, boss.data?.status, boss.data?.current_hp])

  useEffect(() => {
    getGlobalBoss().then(setGlobalBoss).catch(() => {})
    getBiweeklyBoss().then(setBiweekly).catch(() => {})
    getCampaign90Boss().then(setCampaign90).catch(() => {})
  }, [])

  const today = useQuery(async () => {
    const rows = must(
      await supabase
        .from('combat_log')
        .select('damage, created_at, exercise:exercises(name)')
        .gte('created_at', startOfToday().toISOString())
        .order('created_at', { ascending: false })
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

  const summon = async (bossKey) => {
    setBusy(true)
    try {
      await summonInvokableBoss(user.id, bossKey, invitePartnerId || null)
      notify(
        invitePartnerId
          ? `PORTAL VERMELHO ABERTO. RAID EM DUPLA COM ${invitePartner?.hunter_name || invitePartner?.name || 'SEU AMIGO'} COMEÇOU.`
          : 'PORTAL VERMELHO ABERTO. A RAID COMEÇOU.',
        'red'
      )
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
  const gbPct = globalBoss ? Number(globalBoss.current_hp) / Number(globalBoss.max_hp) : 0

  return (
    <div className="stack">
      {invitePartnerId && closed && (
        <Panel tone="cyan" brackets>
          <div className="row between">
            <Chip tone="cyan"><Users size={12} style={{ verticalAlign: '-2px' }} /> CONVITE DE RAID</Chip>
          </div>
          <p className="muted">
            Escolha um chefe abaixo para invocar a raid com{' '}
            <b>{invitePartner ? `${invitePartner.hunter_name || invitePartner.name}#${invitePartner.tag}` : 'seu amigo'}</b>.
            Os dois entram juntos e cada série de treino conta como dano individual.
          </p>
        </Panel>
      )}

      {/* Evento global — somente leitura, nasce automaticamente a cada 30 dias */}
      {globalBoss && globalBoss.status === 'active' && (
        <Panel tone="gold" brackets>
          <div className="row between">
            <Chip tone="gold">EVENTO GLOBAL · TODOS OS CAÇADORES</Chip>
            <span className="mono tiny dim">{Math.round(gbPct * 100)}% HP</span>
          </div>
          <h2 className="h-lg">{globalBoss.name}</h2>
          <SegBar value={Number(globalBoss.current_hp)} max={Number(globalBoss.max_hp)} tone="gold" segments={10} label="HP do Igris" />
          <p className="mono tiny dim">Seu dano de treino também é somado a este evento automaticamente.</p>
        </Panel>
      )}

      {biweekly && biweekly.status === 'active' && (
        <Panel tone="violet" brackets>
          <div className="row between">
            <Chip tone="violet">BOSS QUINZENAL · AMEAÇA DE SERVIDOR</Chip>
            <span className="mono tiny dim">{Math.round((Number(biweekly.current_hp) / Number(biweekly.max_hp)) * 100)}% HP</span>
          </div>
          <h2 className="h-lg">{biweekly.name}</h2>
          <SegBar value={Number(biweekly.current_hp)} max={Number(biweekly.max_hp)} tone="violet" segments={10} label="HP do boss quinzenal" />
          <p className="mono tiny dim">Cooperativo: todo treino de todo caçador soma dano. +{fmt(biweekly.reward_xp)} XP ao derrotar.</p>
          <p className="mono tiny dim">Evento de servidor · sem opção de sair até o fim do ciclo.</p>
        </Panel>
      )}

      {campaign90 && campaign90.status === 'active' && (
        gate90Open ? (
          <Panel tone="red" brackets>
            <div className="row between">
              <Chip tone="red">BOSS DE CAMPANHA · 90 DIAS</Chip>
              <span className="mono tiny dim">{Math.round((Number(campaign90.current_hp) / Number(campaign90.max_hp)) * 100)}% HP</span>
            </div>
            <h2 className="h-lg">{campaign90.name}</h2>
            <SegBar value={Number(campaign90.current_hp)} max={Number(campaign90.max_hp)} tone="red" segments={10} label="HP do boss de campanha" />
            <p className="mono tiny dim">Cooperativo: todo treino de todo caçador soma dano. +{fmt(campaign90.reward_xp)} XP ao derrotar.</p>
            <p className="mono tiny dim">Evento de servidor · sem opção de sair até o fim do ciclo.</p>
          </Panel>
        ) : (
          <button className="panel pick gate90" onClick={() => setGate90Open(true)}>
            <img src="/assets/portal.png" alt="" className="gate90-img" />
            <div className="gate90-overlay">
              <Chip tone="red">PORTÃO DE 90 DIAS · AMEAÇA DE SERVIDOR</Chip>
              <b className="h-md">Um portão vermelho se abriu no servidor</b>
              <span className="mono tiny">TOQUE PARA REVELAR O GUARDIÃO</span>
            </div>
          </button>
        )
      )}

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
            <span className={`boss-icon big ${b.name?.startsWith('SENTINELA DO MARCO') ? 'danger' : ''}`}>
              <Skull size={34} />
            </span>
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
          {raidMembers && (
            <>
              <SysHead right={<Chip tone="cyan"><Users size={12} style={{ verticalAlign: '-2px' }} /> DUPLA</Chip>}>[DANO POR CAÇADOR]</SysHead>
              <div className="row gap wrap">
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
            </>
          )}
        </Panel>
      ) : (
        <Panel className="empty">
          <h3 className="h-md">Nenhuma raid ativa</h3>
          <p className="muted">Invoque um boss e cada série do treino vira dano real.</p>
        </Panel>
      )}

      {closed && (
        <>
          <SysHead>[ESCOLHA SEU DESAFIO]</SysHead>
          <div className="stack">
            {Object.entries(INVOKABLE_BOSSES).map(([key, def]) => (
              <button key={key} className="panel pick" disabled={busy} onClick={() => summon(key)}>
                <span className="boss-icon"><Skull size={22} /></span>
                <span className="grow left">
                  <b className="h-md">{def.name}</b>
                  <span className="mono tiny dim">{def.subtitle} · {fmt(def.max_hp)} HP</span>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </>
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