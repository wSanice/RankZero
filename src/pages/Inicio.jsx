import { useEffect, useState } from 'react'
import { ChevronRight, Skull, Swords, Timer } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useNow, useQuery } from '../lib/useQuery'
import { getBoss, getGlobalBoss, getMissions } from '../lib/data'
import { ATTRS, CLASSES, clock, endOfToday, fmt, xpToNext } from '../lib/rpg'
import { BigStat, Btn, Check, Chip, ErrorNote, Loading, Panel, SegBar, SysHead } from '../components/ui'
import { INVOKABLE_BOSSES } from '../lib/rpg'
import { summonInvokableBoss } from '../lib/data'

export default function Inicio({ go }) {
  const { profile: p, user } = useSession()
  const now = useNow()
  const missions = useQuery(() => getMissions(user.id), [user.id])
  const boss = useQuery(() => getBoss(user.id), [user.id])
  const globalBoss = useQuery(() => getGlobalBoss(), [])
  const gb = globalBoss.data

  const welcomeKey = `abibas_welcomed_${user.id}`
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(welcomeKey))

  const dismissWelcome = () => {
    localStorage.setItem(welcomeKey, '1')
    setShowWelcome(false)
  }

  const need = xpToNext(p.level)
  const cls = CLASSES[p.class] || CLASSES.colosso
  const list = missions.data || []
  const done = list.filter((m) => m.completed).length
  const overall = list.length ? list.reduce((s, m) => s + Math.min(m.current / m.target, 1), 0) / list.length : 0
  const b = boss.data
  const hpPct = b ? Number(b.current_hp) / Number(b.max_hp) : 0

  return (
    <div className="stack">
      {showWelcome && (
        <Panel brackets>
          <SysHead right="AUTORIZADO">[MENSAGEM DO SISTEMA]</SysHead>
          <h2 className="h-lg glow">Bem-vindo ao sistema de ascensão</h2>
          <p className="muted">
            Caçador {p.hunter_name || p.name}, cada série registrada vira dano e experiência. Cumpra as missões diárias para evitar a Zona de Punição.
          </p>
          <button className="link mono tiny" onClick={dismissWelcome}>FECHAR</button>
        </Panel>
      )}

      <Panel>
        <SysHead right={<Chip tone="violet">CLASSE ATIVA</Chip>}>[NÍVEL E EXPERIÊNCIA]</SysHead>
        <div className="row between end">
          <div>
            <h3 className="h-md">{cls.label}</h3>
            <p className="muted">Foco: {cls.focus}</p>
            <div className="row gap wrap">
              {p.second_class ? <Chip tone="violet">2ª: {CLASSES[p.second_class]?.short}</Chip> : p.level < 50 ? <Chip tone="slate">2ª CLASSE NO NV.50</Chip> : <Chip tone="cyan">ESCOLHA A 2ª CLASSE</Chip>}
              {p.title ? <Chip tone="gold">{p.title}</Chip> : <Chip tone="slate">TÍTULO NO NV.100</Chip>}
            </div>
          </div>
          <BigStat value={p.level} unit="LVL" />
        </div>
        <SegBar value={p.xp} max={need} segments={20} label="Experiência" />
        <div className="row between mono tiny">
          <span>{fmt(p.xp)} / {fmt(need)} EXP</span>
          <span className="cyan">Faltam {fmt(need - p.xp)} EXP</span>
        </div>
      </Panel>

      <Panel>
        <SysHead>[ATRIBUTOS PRIMÁRIOS]</SysHead>
        <div className="attr-grid">
          {ATTRS.map((a) => (
            <button key={a.key} className={`attr-mini ${a.key === cls.attr ? 'main' : ''}`} onClick={() => go('perfil')}>
              <span className="mono tiny">{a.code}</span>
              <b>{p[a.key]}</b>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <SysHead right={list.length ? `${done}/${list.length}` : null}>[MISSÃO DIÁRIA: PREPARAÇÃO PARA SOBREVIVÊNCIA]</SysHead>
        {missions.loading ? (
          <Loading />
        ) : missions.error ? (
          <ErrorNote error={missions.error} />
        ) : (
          <>
            <div className="punish mono">
              <Timer size={14} /> PUNIÇÃO EM: {clock(endOfToday() - now)}
            </div>
            <ul className="quest-list">
              {list.map((m) => (
                <li key={m.id} className={m.completed ? 'done' : ''}>
                  <Check done={m.completed} />
                  <div className="grow">
                    <b className="upper">{m.title}</b>
                    <span className="mono tiny dim">{fmt(m.current)} / {fmt(m.target)} {m.unit.toUpperCase()}</span>
                  </div>
                  <span className="mono tiny gold">+{m.xp_reward} XP</span>
                </li>
              ))}
            </ul>
            <SegBar value={overall} max={1} label="Progresso da quest" />
            <div className="row between mono tiny">
              <span>PROGRESSO TOTAL: {Math.round(overall * 100)}%</span>
              <button className="link" onClick={() => go('missoes')}>ABRIR MISSÕES</button>
            </div>
          </>
        )}
      </Panel>

      {gb && gb.status === 'active' && (
        <Panel tone="gold">
          <div className="row between">
            <Chip tone="gold">EVENTO GLOBAL</Chip>
            <span className="mono tiny dim">
              {Math.round((Number(gb.current_hp) / Number(gb.max_hp)) * 100)}% HP
            </span>
          </div>
          <h3 className="h-md">{gb.name}</h3>
          <SegBar value={Number(gb.current_hp)} max={Number(gb.max_hp)} tone="gold" label="HP do Igris" />
        </Panel>
      )}

      <Panel tone={b && b.status === 'active' ? 'red' : undefined} brackets>
        <SysHead right={b ? <Chip tone={b.status === 'defeated' ? 'gold' : 'red'}>{b.status === 'active' ? 'ATIVO' : b.status === 'defeated' ? 'DERROTADO' : 'EXPIRADO'}</Chip> : null}>
          [RAID BOSS]
        </SysHead>
        {boss.loading ? (
          <Loading />
        ) : b ? (
          <>
            <div className="row gap">
              <span className="boss-icon"><Skull size={26} /></span>
              <div>
                <h3 className="h-lg">{b.name}</h3>
                <p className="mono tiny dim">{b.subtitle}</p>
              </div>
            </div>
            <SegBar value={Number(b.current_hp)} max={Number(b.max_hp)} tone="gold" segments={10} label="HP do chefe" />
            <div className="row between mono tiny">
              <span>HP: {fmt(b.current_hp)} / {fmt(b.max_hp)}</span>
              <span>{Math.round(hpPct * 100)}%</span>
            </div>
            <button className="link mono tiny" onClick={() => go('raid')}>VER DETALHES DA RAID <ChevronRight size={12} /></button>
          </>
        ) : (
          <>
            <p className="muted">Nenhum boss ativo. Invoque uma raid para transformar o peso levantado em dano.</p>
            <Btn variant="ghost" onClick={() => go('raid')}>Abrir raid</Btn>
          </>
        )}
      </Panel>

      <Btn icon={Swords} className="cta" onClick={() => go('treinar')}>Entrar na dungeon / iniciar treino</Btn>
    </div>
  )
}