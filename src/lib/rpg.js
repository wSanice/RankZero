// Espelha as regras do schema SQL (fn_xp_to_next e fn_apply_weight_log)
export const xpToNext = (lvl) => 1000 + lvl * 400

export const rankFromLevel = (lvl) =>
  lvl >= 60 ? 'S' : lvl >= 45 ? 'A' : lvl >= 30 ? 'B' : lvl >= 20 ? 'C' : lvl >= 10 ? 'D' : 'E'

export const RANK_TONE = { E: 'slate', D: 'slate', C: 'cyan', B: 'cyan', A: 'violet', S: 'gold' }

export const CLASSES = {
  colosso: {
    key: 'colosso',
    label: 'Colosso / Berserker',
    short: 'Colosso',
    focus: 'Hipertrofia & cargas máximas',
    attr: 'str',
    attrLabel: 'Força',
  },
  ladino: {
    key: 'ladino',
    label: 'Ladino / Sombra',
    short: 'Ladino',
    focus: 'Definição, cardio & velocidade',
    attr: 'agi',
    attrLabel: 'Agilidade',
  },
  guardiao: {
    key: 'guardiao',
    label: 'Guardião / Vanguarda',
    short: 'Guardião',
    focus: 'Resistência muscular & volume',
    attr: 'vit',
    attrLabel: 'Vitalidade',
  },
}

export const ATTRS = [
  { key: 'str', code: 'STR', label: 'Força', desc: 'Capacidade de carga & potência muscular', tone: 'cyan' },
  { key: 'agi', code: 'AGI', label: 'Agilidade', desc: 'Velocidade, reflexos & coordenação motora', tone: 'violet' },
  { key: 'vit', code: 'VIT', label: 'Vitalidade', desc: 'Volume pulmonar, HP máximo & regeneração', tone: 'cyan' },
]

export const DEFAULT_MISSIONS = [
  { title: 'Flexões de braço', target: 100, unit: 'reps', xp_reward: 25 },
  { title: 'Abdominais táticos', target: 100, unit: 'reps', xp_reward: 25 },
  { title: 'Agachamentos profundos', target: 100, unit: 'reps', xp_reward: 25 },
  { title: 'Corrida externa', target: 10, unit: 'km', xp_reward: 50 },
]

export const DEFAULT_BOSS = {
  name: 'IGRIS, O CAVALEIRO VERMELHO',
  subtitle: 'MONARCA DO FERRO - NÍVEL 50',
  max_hp: 500000,
  current_hp: 500000,
  reward_xp: 5000,
  reward_text: 'Armadura S-Rank + Rank Up',
}

// Mesma fórmula do trigger: dano = peso × reps ; xp = max(round(dano/40), 5)
export const damageOf = (weight, reps) => Number(weight || 0) * Math.max(Number(reps || 1), 1)
export const xpOf = (damage) => Math.max(Math.round(damage / 40), 5)

// Aplica XP com o mesmo loop de level-up do banco
export function applyXp(profile, gain) {
  let xp = (profile.xp || 0) + gain
  let level = profile.level || 1
  let free = profile.free_points || 0
  let leveled = 0
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
    free += 3
    leveled += 1
  }
  return { xp, level, free_points: free, leveled }
}

export const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
export const fmt1 = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export const localDate = (d = new Date()) => d.toLocaleDateString('sv-SE') // yyyy-mm-dd
export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
export const endOfToday = () => {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d
}

export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export const nextLetter = (used) => {
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.includes(c)) return c
  return '?'
}

// ---------- progressão: classes e título ----------
export const SECOND_CLASS_LEVEL = 50
export const TITLE_LEVEL = 100

// Cardio: dano por minuto (mesmo valor do trigger 002_progressao.sql)
export const CARDIO_DMG_PER_MIN = 25
export const damageOfMinutes = (min) => Math.round(Number(min || 0) * CARDIO_DMG_PER_MIN)

// O título do nível 100 nasce da combinação das duas classes
export const TITLES = {
  'colosso+ladino': 'Ceifador de Ferro',
  'colosso+guardiao': 'Muralha Berserker',
  'guardiao+ladino': 'Sombra Inabalável',
}
export const titleFor = (a, b) => (a && b && a !== b ? TITLES[[a, b].sort().join('+')] || null : null)

export function levelUnlocks(before, after) {
  const out = []
  if (before < SECOND_CLASS_LEVEL && after >= SECOND_CLASS_LEVEL) out.push('SEGUNDA CLASSE DESBLOQUEADA · ABRA O PERFIL')
  if (before < TITLE_LEVEL && after >= TITLE_LEVEL) out.push('TÍTULO DESBLOQUEADO · ABRA O PERFIL')
  return out
}
