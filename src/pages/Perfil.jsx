import { useMemo, useRef, useState, useEffect } from 'react'
import { Camera, Copy, Lock, LogOut, Save, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSession } from '../context/SessionContext'
import { useQuery, must } from '../lib/useQuery'
import { ATTRS, CLASSES, SECOND_CLASS_LEVEL, TITLE_LEVEL, fmt, fmt1, localDate, titleFor, xpToNext, validateUsername } from '../lib/rpg'
import { BigStat, Btn, Chip, ErrorNote, Loading, Panel, RankBadge, SegBar, SysHead } from '../components/ui'
import { searchProfiles, sendFriendRequest, getFriends, acceptFriendRequest, isOnline } from '../lib/friends'
import { getMyGuild, createGuild, sendGuildInvite, getIncomingGuildInvites, acceptGuildInvite, declineGuildInvite, leaveGuild } from '../lib/guild'

export default function Perfil({ go }) {
  const { profile: p, user, updateProfile, notify, signOut } = useSession()
  const [hunter, setHunter] = useState(p.hunter_name || '')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const need = xpToNext(p.level)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [friends, setFriends] = useState([])
  const [guild, setGuild] = useState(null)
  const [guildInvites, setGuildInvites] = useState([])
  const [guildName, setGuildName] = useState('')
  const [guildBusy, setGuildBusy] = useState(false)
  const [changingClass, setChangingClass] = useState(false)

  useEffect(() => {
    getFriends(user.id).then(setFriends).catch(() => { })
    reloadGuild()
  }, [user.id])

  const reloadGuild = () => {
    getMyGuild(user.id).then(setGuild).catch(() => { })
    getIncomingGuildInvites(user.id).then(setGuildInvites).catch(() => { })
  }

  const makeGuild = async () => {
    setGuildBusy(true)
    try {
      await createGuild(guildName)
      setGuildName('')
      notify('GUILDA FUNDADA')
      reloadGuild()
    } catch (e) {
      notify(e.message, 'red')
    } finally {
      setGuildBusy(false)
    }
  }

  const inviteToGuild = async (friendId) => {
    if (!guild) return
    try {
      await sendGuildInvite(guild.id, user.id, friendId)
      notify('CONVITE DE GUILDA ENVIADO')
    } catch (e) {
      notify(e.message, 'red')
    }
  }

  const respondGuildInvite = async (inviteId, accept) => {
    try {
      if (accept) {
        await acceptGuildInvite(inviteId)
        notify('VOCÊ ENTROU NA GUILDA', 'gold')
      } else {
        await declineGuildInvite(inviteId)
        notify('CONVITE RECUSADO')
      }
      reloadGuild()
    } catch (e) {
      notify(e.message, 'red')
    }
  }

  const exitGuild = async () => {
    if (!guild) return
    try {
      await leaveGuild(guild.id, user.id)
      notify('VOCÊ SAIU DA GUILDA')
      reloadGuild()
    } catch (e) {
      notify(e.message, 'red')
    }
  }

  const search = async () => {
    if (!term.includes('#')) return notify('Busque como nome#0000', 'red')
    try {
      const r = await searchProfiles(term)
      setResults(r.filter((x) => x.id !== user.id))
    } catch (e) {
      notify(`Busca falhou: ${e.message}`, 'red')
    }
  }

  const addFriend = async (id) => {
    try {
      await sendFriendRequest(user.id, id)
      notify('PEDIDO DE AMIZADE ENVIADO')
      setResults([])
      setTerm('')
    } catch (e) {
      notify(`Não foi possível enviar: ${e.message}`, 'red')
    }
  }

  const accept = async (friendshipId) => {
    await acceptFriendRequest(friendshipId)
    notify('AMIZADE CONFIRMADA')
    getFriends(user.id).then(setFriends)
  }

  const logs = useQuery(async () =>
    must(
      await supabase
        .from('weight_logs')
        .select('weight, reps, logged_at, exercise:exercises(name)')
        .order('logged_at', { ascending: false })
        .limit(1000)
    ), [user.id])

  const stats = useMemo(() => {
    const rows = logs.data || []
    const days = new Set(rows.map((r) => localDate(new Date(r.logged_at))))
    const volume = rows.reduce((s, r) => s + Number(r.weight) * Math.max(r.reps || 1, 1), 0)
    const best = {}
    for (const r of rows) {
      const n = r.exercise?.name
      if (!n || !(Number(r.weight) > 0)) continue
      if (!best[n] || Number(r.weight) > Number(best[n].weight)) best[n] = r
    }
    const prs = Object.entries(best).sort((a, b) => Number(b[1].weight) - Number(a[1].weight)).slice(0, 5)
    return { sets: rows.length, days: days.size, volume, prs }
  }, [logs.data])

  const setClasses = async ({ primary = p.class, second = p.second_class }) => {
    const patch = { class: primary, second_class: second === primary ? null : second }
    if (p.title) patch.title = titleFor(patch.class, patch.second_class)
    await updateProfile(patch)
  }

  // "Mudar de treino": evolui a formação (classe primária) do caçador. Diferente
  // da segunda classe (nível 50, que SOMA uma classe) e do título (nível 100, que
  // COMBINA as duas) — isto troca a formação em si, sem desbloquear título. Os
  // atributos já conquistados continuam, só os PRÓXIMOS pontos de nível passam a
  // seguir a tabela da nova classe (pointsForLevel em rpg.js).
  const changeTraining = async (key) => {
    if (key === p.class) return setChangingClass(false)
    await setClasses({ primary: key })
    notify(`FORMAÇÃO EVOLUÍDA: ${CLASSES[key]?.short?.toUpperCase()}`, 'gold')
    setChangingClass(false)
  }

  const claimTitle = async () => {
    const t = titleFor(p.class, p.second_class)
    if (t && (await updateProfile({ title: t }))) notify(`TÍTULO CONQUISTADO: ${t.toUpperCase()}`, 'gold')
  }

  const saveName = async () => {
    const v = hunter.trim()
    if (v === (p.hunter_name || '')) return
    if (!v) {
      if (await updateProfile({ hunter_name: null })) notify('NOME DE CAÇADOR ATUALIZADO')
      return
    }
    const check = validateUsername(v)
    if (!check.ok) return notify(check.reason, 'red')
    if (await updateProfile({ hunter_name: check.value })) {
      setHunter(check.value)
      notify('NOME DE CAÇADOR ATUALIZADO')
    }
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return notify('A imagem precisa ter no máximo 3 MB.', 'red')
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      setUploading(false)
      return notify(`Falha no upload: ${error.message}`, 'red')
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateProfile({ avatar_url: data.publicUrl })
    setUploading(false)
    notify('FOTO ATUALIZADA')
  }

  return (
    <div className="stack">
      <Panel brackets>
        <div className="row gap">
          <button className="avatar" onClick={() => fileRef.current?.click()} aria-label="Trocar foto de perfil" disabled={uploading}>
            {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.hunter_name || p.name || '?')[0].toUpperCase()}</span>}
            <span className="avatar-cam"><Camera size={14} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
          <div className="grow">
            <div className="row gap wrap">
              <Chip tone="violet">{CLASSES[p.class]?.short || 'Colosso'}</Chip>
              {p.second_class && <Chip tone="violet">{CLASSES[p.second_class]?.short}</Chip>}
              {p.title && <Chip tone="gold">{p.title}</Chip>}
              <Chip tone="slate">RANK {p.rank}</Chip>
            </div>
            <h2 className="h-xl">{p.hunter_name || p.name}</h2>
            <p className="mono tiny cyan row gap">
              CÓDIGO: {p.hunter_name || p.name}#{p.tag}
              <button
                className="icon-btn plain"
                onClick={() => {
                  navigator.clipboard.writeText(`${p.hunter_name || p.name}#${p.tag}`)
                  notify('CÓDIGO COPIADO')
                }}
                aria-label="Copiar código"
              >
                <Copy size={14} />
              </button>
            </p>
            <p className="mono tiny dim">{user.email}</p>
          </div>
          <RankBadge rank={p.rank} size="lg" />
        </div>

        <label className="field">
          <span className="mono tiny">NOME DE CAÇADOR</span>
          <div className="field-box">
            <input
              value={hunter}
              onChange={(e) => setHunter(e.target.value.replace(/\s/g, '_'))}
              onBlur={saveName}
              placeholder={p.name || 'Como o sistema chama você'}
              maxLength={20}
            />
            <button className="icon-btn plain" onClick={saveName} aria-label="Salvar nome"><Save size={16} /></button>
          </div>
          <span className="mono tiny dim">Sem espaço · 3–20 caracteres · letras, números e "_"</span>
        </label>

        <div className="row between end">
          <BigStat value={p.level} unit="LVL" />
          <span className="mono tiny cyan">{fmt(p.xp)} / {fmt(need)} EXP</span>
        </div>
        <SegBar value={p.xp} max={need} segments={20} label="Experiência" />
      </Panel>

      <Panel brackets>
        <SysHead>[BUSCAR CAÇADOR]</SysHead>
        <div className="field-box">
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="nome#0000" onKeyDown={(e) => e.key === 'Enter' && search()} />
          <button className="icon-btn plain" onClick={search} aria-label="Buscar"><Search size={16} /></button>
        </div>
        {results.map((r) => (
          <div key={r.id} className="row between">
            <span>{r.hunter_name || r.name}#{r.tag} · Nv.{r.level}</span>
            <Btn variant="ghost" onClick={() => addFriend(r.id)}>Adicionar</Btn>
          </div>
        ))}
      </Panel>

      <Panel>
        <SysHead right={<Chip tone="slate">{friends.filter((f) => f.status === 'accepted').length}</Chip>}>[AMIGOS]</SysHead>
        {!friends.length && <p className="muted">Nenhum amigo ainda. Busque pelo nome#tag acima.</p>}
        {friends.map((f) => (
          <div key={f.friendshipId} className="row between">
            <span className="row gap">
              <span className={`dot ${isOnline(f.profile.last_seen) ? '' : 'off'}`} />
              {f.profile.hunter_name || f.profile.name}#{f.profile.tag}
            </span>
            {f.incoming ? (
              <Btn variant="ghost" onClick={() => accept(f.friendshipId)}>Aceitar</Btn>
            ) : f.status === 'pending' ? (
              <Chip tone="slate">PENDENTE</Chip>
            ) : (
              <Btn variant="ghost" onClick={() => go('raid', { invitePartnerId: f.profile.id })}>Convidar p/ raid</Btn>
            )}
          </div>
        ))}
      </Panel>

      {!!guildInvites.length && (
        <Panel tone="violet" brackets>
          <SysHead right={<Chip tone="violet">{guildInvites.length}</Chip>}>[CONVITES DE GUILDA]</SysHead>
          {guildInvites.map((inv) => (
            <div key={inv.id} className="row between">
              <span>
                <b>{inv.guild?.name}</b>
                <span className="mono tiny dim"> · convidado por {inv.inviter?.hunter_name || inv.inviter?.name}#{inv.inviter?.tag}</span>
              </span>
              <span className="row gap">
                <Btn variant="ghost" onClick={() => respondGuildInvite(inv.id, true)}>Aceitar</Btn>
                <Btn variant="danger" onClick={() => respondGuildInvite(inv.id, false)}>Recusar</Btn>
              </span>
            </div>
          ))}
        </Panel>
      )}

      <Panel>
        <SysHead right={guild && <Chip tone="slate">{guild.members?.length || 0} MEMBROS</Chip>}>[GUILDA]</SysHead>
        {guild ? (
          <>
            <h3 className="h-md">{guild.name}</h3>
            <ul className="log-list">
              {guild.members?.map((m) => (
                <li key={m.user_id}>
                  <span className="row gap">
                    <span className={`dot ${isOnline(m.profile?.last_seen) ? '' : 'off'}`} />
                    {m.profile?.hunter_name || m.profile?.name}#{m.profile?.tag}
                  </span>
                  <span className="mono tiny dim">Nv.{m.profile?.level}</span>
                </li>
              ))}
            </ul>
            {!!friends.filter((f) => f.status === 'accepted').length && (
              <>
                <p className="mono tiny dim">CONVIDAR AMIGO</p>
                {friends.filter((f) => f.status === 'accepted' && !guild.members?.some((m) => m.user_id === f.profile.id)).map((f) => (
                  <div key={f.friendshipId} className="row between">
                    <span>{f.profile.hunter_name || f.profile.name}#{f.profile.tag}</span>
                    <Btn variant="ghost" onClick={() => inviteToGuild(f.profile.id)}>Convidar</Btn>
                  </div>
                ))}
              </>
            )}
            <Btn variant="danger" onClick={exitGuild}>Sair da guilda</Btn>
          </>
        ) : (
          <>
            <p className="muted">Você ainda não tem guilda. Funde uma para convidar amigos e enfrentar o Boss Global juntos.</p>
            <div className="field-box">
              <input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="Nome da guilda" maxLength={30} />
              <Btn disabled={guildBusy || guildName.trim().length < 3} onClick={makeGuild}>Fundar</Btn>
            </div>
          </>
        )}
      </Panel>

      <Panel>
        <SysHead right={<Chip tone="slate">PONTOS AUTOMÁTICOS</Chip>}>[CLASSES E TÍTULO]</SysHead>

        <p className="mono tiny dim">FORMAÇÃO · SEM TÍTULO</p>
        {!changingClass ? (
          <>
            <div className="class-opt on" style={{ maxWidth: 220 }} aria-current="true">
              <b className="h-md">{CLASSES[p.class]?.short}</b>
              <span className="mono tiny dim">+ {CLASSES[p.class]?.attrLabel?.toUpperCase()}</span>
            </div>
            <p className="muted">{CLASSES[p.class]?.label}: {CLASSES[p.class]?.focus}.</p>
            <Btn variant="ghost" onClick={() => setChangingClass(true)}>Mudar de treino</Btn>
          </>
        ) : (
          <>
            <p className="muted">Escolha a nova formação. Seus atributos já conquistados continuam com você — só os próximos pontos de nível passam a seguir a nova classe.</p>
            <div className="class-row">
              {Object.values(CLASSES).map((c) => (
                <button key={c.key} className={`class-opt ${p.class === c.key ? 'on' : ''}`} onClick={() => changeTraining(c.key)} aria-pressed={p.class === c.key}>
                  <b className="h-md">{c.short}</b>
                  <span className="mono tiny dim">+ {c.attrLabel.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <Btn variant="ghost" onClick={() => setChangingClass(false)}>Cancelar</Btn>
          </>
        )}

        <p className="mono tiny dim">SEGUNDA CLASSE · NÍVEL {SECOND_CLASS_LEVEL}</p>
        {p.level >= SECOND_CLASS_LEVEL ? (
          <div className="class-row">
            {Object.values(CLASSES).filter((c) => c.key !== p.class).map((c) => (
              <button key={c.key} className={`class-opt ${p.second_class === c.key ? 'on' : ''}`} onClick={() => setClasses({ second: c.key })} aria-pressed={p.second_class === c.key}>
                <b className="h-md">{c.short}</b>
                <span className="mono tiny dim">+ {c.attrLabel.toUpperCase()}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="locked mono"><Lock size={14} /> Bloqueada. Faltam {SECOND_CLASS_LEVEL - p.level} níveis.</div>
        )}

        <p className="mono tiny dim">TÍTULO · NÍVEL {TITLE_LEVEL}</p>
        {p.level < TITLE_LEVEL ? (
          <div className="locked mono"><Lock size={14} /> Bloqueado. Faltam {TITLE_LEVEL - p.level} níveis.</div>
        ) : p.title ? (
          <div className="title-badge"><span className="mono tiny">TÍTULO ATIVO</span><b className="h-lg">{p.title}</b></div>
        ) : p.second_class ? (
          <Btn variant="ghost" onClick={claimTitle}>Conquistar título: {titleFor(p.class, p.second_class)}</Btn>
        ) : (
          <div className="locked mono"><Lock size={14} /> Escolha sua segunda classe para revelar o título.</div>
        )}
      </Panel>

      {ATTRS.map((a) => (
        <Panel key={a.key} className={`attr attr-${a.tone}`}>
          <div className="row between">
            <div>
              <p className="mono tiny dim">{a.code}</p>
              <h3 className="h-lg">{a.label}</h3>
              <p className="muted">{a.desc}</p>
            </div>
            <BigStat value={p[a.key]} />
          </div>
        </Panel>
      ))}

      <Panel>
        <SysHead>[REGISTRO DE COMBATE: HISTÓRICO]</SysHead>
        {logs.loading ? (
          <Loading />
        ) : logs.error ? (
          <ErrorNote error={logs.error} />
        ) : (
          <>
            <div className="grid3">
              <div className="reward"><b>{fmt(stats.days)}</b><span className="mono tiny dim">DIAS TREINADOS</span></div>
              <div className="reward"><b>{fmt(stats.sets)}</b><span className="mono tiny dim">SÉRIES</span></div>
              <div className="reward"><b>{fmt(stats.volume / 1000)} t</b><span className="mono tiny dim">VOLUME TOTAL</span></div>
            </div>
            <h4 className="mono tiny dim">MAIORES CARGAS</h4>
            {stats.prs.length ? (
              <ul className="log-list">
                {stats.prs.map(([name, r]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span className="mono gold">{fmt1(r.weight)} kg × {r.reps}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhum recorde ainda. Registre séries no treino para preencher esta lista.</p>
            )}
          </>
        )}
      </Panel>

      <Btn variant="danger" icon={LogOut} onClick={signOut}>Sair do sistema</Btn>
    </div>
  )
}