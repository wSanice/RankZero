import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, User, Zap, Swords } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Btn } from '../components/ui'

const traduz = (msg = '') => {
  if (/invalid login/i.test(msg)) return 'ID ou chave de acesso incorretos.'
  if (/already registered/i.test(msg)) return 'Este e-mail já possui vínculo com o Sistema. Use "Entrar".'
  if (/password should be/i.test(msg)) return 'A chave de acesso precisa ter pelo menos 6 caracteres.'
  if (/email not confirmed/i.test(msg)) return 'Vínculo pendente de confirmação. Verifique seu e-mail para ativar o registro.'
  if (/rate limit/i.test(msg)) return 'Excesso de tentativas de conexão. Aguarde um instante.'
  return msg
}

// Copy de cada estado — pensada como mensagens do Sistema, não como um formulário genérico
const CONTENT = {
  entrar: {
    tag: 'CONEXÃO NEURAL // AGUARDANDO SINCRONIZAÇÃO',
    eyebrow: 'RECONEXÃO DE CAÇADOR',
    title: 'O Sistema reconheceu sua presença',
    subtitle: 'Insira suas credenciais para restaurar o vínculo e sincronizar seus atributos.',
    cta: 'Sincronizar',
    ctaBusy: 'Sincronizando...',
  },
  cadastrar: {
    tag: 'SISTEMA DETECTADO // NOVO CANDIDATO',
    eyebrow: 'RITUAL DE DESPERTAR',
    title: 'Você foi selecionado.',
    subtitle: 'Um vínculo com o Sistema está prestes a ser criado. A partir de agora, cada treino gera dano, XP e ascensão de rank.',
    cta: 'Aceitar despertar',
    ctaBusy: 'Vinculando...',
  },
  recuperar: {
    tag: 'PROTOCOLO DE EMERGÊNCIA // ACESSO PERDIDO',
    eyebrow: 'RECUPERAÇÃO DE ACESSO',
    title: 'Vínculo interrompido',
    subtitle: 'Informe o e-mail cadastrado. Um link de restauração será enviado para redefinir sua chave de acesso.',
    cta: 'Enviar link de restauração',
    ctaBusy: 'Enviando...',
  },
}

export default function Login() {
  const [mode, setMode] = useState('entrar') // entrar | cadastrar | recuperar
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // {tone, text}

  const c = CONTENT[mode]

  const switchMode = (next) => {
    setMode(next)
    setMsg(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'cadastrar') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() || 'Caçador' } } })
        if (error) throw error
        if (!data.session) setMsg({ tone: 'cyan', text: 'Registro iniciado. Confirme o vínculo pelo link enviado ao seu e-mail.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ tone: 'cyan', text: 'Se o e-mail estiver registrado, o link de restauração já foi enviado.' })
      }
    } catch (err) {
      setMsg({ tone: 'red', text: traduz(err.message) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app login">
      <div className="login-status mono">
        <span className="dot" /> [SISTEMA] <span className="dim">{c.tag}</span>
      </div>

      <form className="panel brackets login-card" onSubmit={submit}>
        <div className="login-emblem">
          <Swords size={30} />
        </div>

        <p className="mono tiny center cyan">{c.eyebrow}</p>
        <h2 className="h-lg center glow">{c.title}</h2>
        <p className="center muted">{c.subtitle}</p>

        {mode === 'cadastrar' && (
          <label className="field">
            <span className="mono tiny">NOME DO ARQUÉTIPO</span>
            <div className="field-box">
              <User size={16} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como o Sistema vai te chamar" autoComplete="nickname" />
            </div>
          </label>
        )}

        <label className="field">
          <span className="mono tiny">ID DE CAÇADOR (E-MAIL)</span>
          <div className="field-box">
            <Mail size={16} />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
          </div>
        </label>

        {mode !== 'recuperar' && (
          <label className="field">
            <span className="mono tiny">CHAVE DE ACESSO</span>
            <div className="field-box">
              <Lock size={16} />
              <input
                type={show ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
              />
              <button type="button" className="icon-btn plain" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar chave' : 'Mostrar chave'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        )}

        {mode === 'entrar' && (
          <button type="button" className="link mono tiny" onClick={() => switchMode('recuperar')}>
            Perdeu a chave de acesso?
          </button>
        )}

        {msg && <p className={`notice notice-${msg.tone} mono`}>{msg.text}</p>}

        <Btn type="submit" icon={Zap} disabled={busy}>
          {busy ? c.ctaBusy : c.cta}
        </Btn>
      </form>

      <div className="panel login-switch center">
        {mode === 'entrar' && (
          <>
            <p className="muted">Ainda não tem vínculo com o Sistema?</p>
            <button className="link mono tiny" onClick={() => switchMode('cadastrar')}>
              INICIAR RITUAL DE DESPERTAR
            </button>
          </>
        )}
        {mode === 'cadastrar' && (
          <button className="link mono tiny" onClick={() => switchMode('entrar')}>
            JÁ POSSUI VÍNCULO? RECONECTAR
          </button>
        )}
        {mode === 'recuperar' && (
          <button className="link mono tiny" onClick={() => switchMode('entrar')}>
            VOLTAR À AUTENTICAÇÃO
          </button>
        )}
      </div>
    </div>
  )
}