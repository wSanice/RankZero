import { Loader2 } from 'lucide-react'
import { RANK_TONE } from '../lib/rpg'

export function Panel({ tone, brackets, className = '', children, ...rest }) {
  const cls = ['panel', brackets && 'brackets', tone && `tone-${tone}`, className].filter(Boolean).join(' ')
  return (
    <section className={cls} {...rest}>
      {children}
    </section>
  )
}

// Cabeçalho de janela de sistema: [TÍTULO] ── ◆ ──
export function SysHead({ children, right }) {
  return (
    <div className="sys-head">
      <span className="mono">{children}</span>
      {right && <span className="mono sys-right">{right}</span>}
    </div>
  )
}

// Barra segmentada em pips (10 por padrão), com preenchimento parcial no pip atual
export function SegBar({ value, max, segments = 10, tone = 'cyan', label }) {
  const pct = max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0
  return (
    <div className={`seg seg-${tone}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: segments }, (_, i) => {
        const fill = Math.max(0, Math.min(pct * segments - i, 1))
        return (
          <span key={i} className="seg-pip">
            <span style={{ width: `${fill * 100}%` }} />
          </span>
        )
      })}
    </div>
  )
}

export function Btn({ variant = 'primary', icon: Icon, children, className = '', ...p }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...p}>
      {Icon && <Icon size={18} />}
      <span>{children}</span>
    </button>
  )
}

export function Chip({ tone = 'cyan', children }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

export function RankBadge({ rank = 'E', size = 'md' }) {
  return <span className={`rank rank-${RANK_TONE[rank] || 'slate'} rank-${size}`}>{rank}</span>
}

export function Check({ done, active }) {
  return (
    <span className={`check ${done ? 'on' : ''} ${active ? 'active' : ''}`} aria-hidden>
      {(done || active) && <span className="diamond" />}
    </span>
  )
}

export function Loading({ text = 'SINCRONIZANDO COM O SISTEMA' }) {
  return (
    <div className="loading mono">
      <Loader2 size={16} className="spin" /> {text}
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <Panel className="empty">
      <h3 className="h-md">{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </Panel>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  return (
    <Panel tone="red" className="error-note">
      <span className="mono">[ERRO]</span> {error.message || String(error)}
    </Panel>
  )
}

export function BigStat({ value, unit, small }) {
  return (
    <span className={`bigstat ${small ? 'small' : ''}`}>
      <b>{value}</b>
      {unit && <em>{unit}</em>}
    </span>
  )
}