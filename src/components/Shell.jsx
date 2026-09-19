import { ChevronLeft, ClipboardList, LayoutGrid, Swords, User } from 'lucide-react'
import { RankBadge } from './ui'
import { useSession } from '../context/SessionContext'

const TABS = [
  { key: 'inicio', label: 'Início', icon: LayoutGrid },
  { key: 'treinar', label: 'Treinar', icon: Swords },
  { key: 'ficha', label: 'Ficha', icon: ClipboardList },
  { key: 'perfil', label: 'Perfil', icon: User },
]

const SUB = { raid: 'Raid boss', missoes: 'Missões diárias' }

export default function Shell({ route, go, children }) {
  const { profile } = useSession()
  const active = SUB[route.name] ? 'inicio' : route.name
  const name = profile?.hunter_name || profile?.name || 'Caçador'

  return (
    <div className="app">
      <header className="topbar">
        {SUB[route.name] ? (
          <button className="icon-btn" onClick={() => go('inicio')} aria-label="Voltar ao início">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <RankBadge rank={profile?.rank} />
        )}
        <div className="topbar-title">
          <span className="mono tiny">{SUB[route.name] ? SUB[route.name] : 'SISTEMA ATIVO'}</span>
          <h1 className="h-lg glow">[STATUS: {name}]</h1>
        </div>
        <span className="chip chip-cyan mono">LVL.{profile?.level ?? 1}</span>
      </header>

      <main className="content">{children}</main>

      <nav className="nav" aria-label="Navegação principal">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-item ${active === key ? 'on' : ''}`} onClick={() => go(key)} aria-current={active === key ? 'page' : undefined}>
            <Icon size={20} />
            <span className="mono">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
