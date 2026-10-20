import { useCallback, useState } from 'react'
import { useSession } from './context/SessionContext'
import Shell from './components/Shell'
import { Loading } from './components/ui'
import Gate from './pages/Gate'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Treinar from './pages/Treinar'
import Ficha from './pages/Ficha'
import Perfil from './pages/Perfil'
import Missoes from './pages/Missoes'
import Raid from './pages/Raid'

export default function App() {
  const { session, profile, booting } = useSession()
  const [route, setRoute] = useState({ name: 'inicio', params: {} })
  // a fenda aparece toda vez que a página carrega sem sessão ativa;
  // some assim que o usuário confirma (e nunca reaparece depois de logado)
  const [gateOpen, setGateOpen] = useState(true)

  const go = useCallback((name, params = {}) => {
    setRoute({ name, params })
    window.scrollTo({ top: 0 })
  }, [])

  const dismissGate = useCallback(() => {
    setGateOpen(false)
  }, [])

  if (booting) {
    return (
      <div className="boot">
        <Loading text="INICIALIZANDO O SISTEMA" />
      </div>
    )
  }

  if (!session) {
    if (gateOpen) return <Gate onContinue={dismissGate} bgImage="/assets/portal.png" />
    return <Login />
  }

  if (!profile) {
    return (
      <div className="boot">
        <Loading text="DESPERTANDO SEU PERFIL" />
      </div>
    )
  }

  // key força remontar a tela ao trocar de rota
  const pages = {
    inicio: <Inicio go={go} />,
    treinar: <Treinar go={go} params={route.params} />,
    ficha: <Ficha go={go} />,
    perfil: <Perfil go={go} />,
    missoes: <Missoes go={go} />,
    raid: <Raid go={go} params={route.params} />,
  }

  return (
    <Shell route={route} go={go}>
      <div key={route.name + JSON.stringify(route.params)}>{pages[route.name]}</div>
    </Shell>
  )
}