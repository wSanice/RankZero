import { useCallback, useEffect, useRef, useState } from 'react'

// Lança o erro do Supabase para o useQuery capturar
export const must = ({ data, error }) => {
  if (error) throw error
  return data
}

export function useQuery(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (silent) => {
    if (!silent) setState((s) => ({ ...s, loading: true }))
    try {
      const data = await fnRef.current()
      setState({ data, loading: false, error: null })
    } catch (error) {
      setState({ data: null, loading: false, error })
    }
  }, [])

  useEffect(() => {
    run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ...state, reload: () => run(true) }
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}
