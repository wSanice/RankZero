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

export const INVOKABLE_BOSSES = {
  colosso: {
    name: 'GRENDEL, O TITÃ DE FERRO',
    subtitle: 'FRACO CONTRA COLOSSO · BÔNUS +20% DANO',
    max_hp: 8000,
    reward_xp: 800,
    weak_vs: 'colosso',
    bonus_mult: 1.2,
  },
  ladino: {
    name: 'NIGHTSHADE, A LÂMINA SILENCIOSA',
    subtitle: 'FRACO CONTRA LADINO · BÔNUS +20% DANO',
    max_hp: 6000,
    reward_xp: 700,
    weak_vs: 'ladino',
    bonus_mult: 1.2,
  },
  guardiao: {
    name: 'BASTION, O MURO VIVO',
    subtitle: 'FRACO CONTRA GUARDIÃO · BÔNUS +20% DANO',
    max_hp: 10000,
    reward_xp: 900,
    weak_vs: 'guardiao',
    bonus_mult: 1.2,
  },
}

export const DAILY_BOSSES = [
  {
    id: 'goblin_king',
    name: 'REZAK, O REI GOBLIN',
    subtitle: 'NÍVEL 5 · FRACO CONTRA LADINO (+20% DANO)',
    max_hp: 1000,
    reward_xp: 150,
    weak_vs: 'ladino',
    bonus_mult: 1.2,
    difficulty: 'Fácil'
  },
  {
    id: 'stone_golem',
    name: 'GOLEM DE QUARTZO',
    subtitle: 'NÍVEL 8 · FRACO CONTRA COLOSSO (+20% DANO)',
    max_hp: 1100,
    reward_xp: 165,
    weak_vs: 'colosso',
    bonus_mult: 1.2,
    difficulty: 'Fácil'
  },
  {
    id: 'marsh_drake',
    name: 'SERPENTE DOS PÂNTANOS',
    subtitle: 'NÍVEL 10 · FRACO CONTRA GUARDIÃO (+20% DANO)',
    max_hp: 1200,
    reward_xp: 180,
    weak_vs: 'guardiao',
    bonus_mult: 1.2,
    difficulty: 'Fácil'
  },
  {
    id: 'iron_orc',
    name: 'KARGATH, O CHEFE ORC',
    subtitle: 'NÍVEL 15 · FRACO CONTRA COLOSSO (+20% DANO)',
    max_hp: 1400,
    reward_xp: 220,
    weak_vs: 'colosso',
    bonus_mult: 1.2,
    difficulty: 'Médio'
  },
  {
    id: 'shadow_assassin',
    name: 'VERMIN, A LÂMINA DAS SOMBRAS',
    subtitle: 'NÍVEL 18 · FRACO CONTRA LADINO (+20% DANO)',
    max_hp: 1500,
    reward_xp: 240,
    weak_vs: 'ladino',
    bonus_mult: 1.2,
    difficulty: 'Médio'
  },
  {
    id: 'shield_gargoyle',
    name: 'GÁRGOULA DE OBSIDIANA',
    subtitle: 'NÍVEL 20 · FRACO CONTRA GUARDIÃO (+20% DANO)',
    max_hp: 1600,
    reward_xp: 260,
    weak_vs: 'guardiao',
    bonus_mult: 1.2,
    difficulty: 'Médio'
  },
  {
    id: 'frost_wyrm',
    name: 'WYRM DAS NEVES',
    subtitle: 'NÍVEL 25 · FRACO CONTRA LADINO (+20% DANO)',
    max_hp: 1800,
    reward_xp: 300,
    weak_vs: 'ladino',
    bonus_mult: 1.2,
    difficulty: 'Difícil'
  },
  {
    id: 'infernal_behemoth',
    name: 'BEHEMOTH INFERNAL',
    subtitle: 'NÍVEL 28 · FRACO CONTRA COLOSSO (+20% DANO)',
    max_hp: 1900,
    reward_xp: 320,
    weak_vs: 'colosso',
    bonus_mult: 1.2,
    difficulty: 'Difícil'
  },
  {
    id: 'dread_knight',
    name: 'CAVALEIRO DA ALVORADA NEGRA',
    subtitle: 'NÍVEL 30 · FRACO CONTRA GUARDIÃO (+20% DANO)',
    max_hp: 2000,
    reward_xp: 350,
    weak_vs: 'guardiao',
    bonus_mult: 1.2,
    difficulty: 'Difícil'
  }
]

export function getDailyBoss(dateStr = localDate()) {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % DAILY_BOSSES.length
  return DAILY_BOSSES[index]
}

// Mesma fórmula do trigger: dano = peso × reps ; xp = max(round(dano/40), 5)
export const damageOf = (weight, reps) => Number(weight || 0) * Math.max(Number(reps || 1), 1)
export const xpOf = (damage) => Math.max(Math.round(damage / 40), 5)

// ---------- pontos de atributo: fixos por classe (não são mais livres) ----------
// Espelha fn_points_for_level() no banco (003_pontos_por_classe.sql).
// Nível básico (1,2,3...): 3 pontos | nível decimal (10,20,30...): 5 pontos
export const POINTS_BY_CLASS = {
  colosso:  { basic: { str: 2, agi: 0, vit: 1 }, decimal: { str: 2, agi: 1, vit: 2 } },
  ladino:   { basic: { str: 1, agi: 2, vit: 0 }, decimal: { str: 1, agi: 3, vit: 1 } },
  guardiao: { basic: { str: 1, agi: 0, vit: 2 }, decimal: { str: 2, agi: 1, vit: 2 } },
}

export const pointsForLevel = (cls, level) => {
  const table = POINTS_BY_CLASS[cls] || POINTS_BY_CLASS.colosso
  return level % 10 === 0 ? table.decimal : table.basic
}

// Aplica XP com o mesmo loop de level-up do banco.
// Os pontos de atributo agora são creditados automaticamente por classe
// (não existe mais alocação livre — free_points fica só para compatibilidade
// com telas antigas, mas não é mais incrementado).
export function applyXp(profile, gain) {
  let xp = (profile.xp || 0) + gain
  let level = profile.level || 1
  let str = profile.str || 0
  let agi = profile.agi || 0
  let vit = profile.vit || 0
  let leveled = 0
  const gains = [] // histórico de pontos ganhos por nível, útil pra toast/log
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
    const pts = pointsForLevel(profile.class, level)
    str += pts.str
    agi += pts.agi
    vit += pts.vit
    gains.push({ level, ...pts })
    leveled += 1
  }
  return { xp, level, str, agi, vit, leveled, gains }
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