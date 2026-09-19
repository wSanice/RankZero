import { supabase } from './supabase'

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0)

export async function getWorkouts() {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, letter, title, created_at, machines(id, name, kind, position, exercises(id, name, position, target_sets, target_reps, target_weight, target_minutes))')
    .order('letter', { ascending: true })
  if (error) throw error
  return data.map((w) => ({
    ...w,
    machines: [...(w.machines || [])]
      .sort(byPos)
      .map((m) => ({ ...m, exercises: [...(m.exercises || [])].sort(byPos) })),
  }))
}

// Lista plana de exercícios na ordem da ficha
export const flatExercises = (w) =>
  w.machines.flatMap((m) => m.exercises.map((e) => ({ ...e, machine: m.name, kind: m.kind })))

// Último registro (peso × reps) de cada exercício
export async function getLastLogs(exerciseIds) {
  if (!exerciseIds.length) return {}
  const { data, error } = await supabase
    .from('weight_logs')
    .select('exercise_id, weight, reps, duration_min, logged_at')
    .in('exercise_id', exerciseIds)
    .order('logged_at', { ascending: false })
    .limit(600)
  if (error) throw error
  const map = {}
  for (const r of data) if (!map[r.exercise_id]) map[r.exercise_id] = r
  return map
}
