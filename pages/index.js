import { useState, useEffect, useRef } from 'react'
import QUESTIONS from '../data/questions.json'
import TRANSLATIONS from '../data/translations.json'
import SHEETS from '../data/sheets.json'
import DIALOGUES from '../data/dialogues.json'

const CAT_COLORS = {
  'Principes et valeurs': '#002395',
  'Système institutionnel': '#ED2939',
  'Droits et devoirs': '#0B7A4F',
  'Histoire et culture': '#7C4A1E',
  'Vivre en société': '#4A1D8A',
  'Vie quotidienne': '#0891B2',
  'Démarches administratives': '#7C3AED',
  'Droits et société': '#0B7A4F',
  'Travail': '#B45309',
  'Santé': '#C0392B',
  'Institutions': '#ED2939',
  'Société': '#1D4ED8'
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  // Double décalage pour garantir la variété entre sessions
  const offset = Math.floor(Math.random() * a.length)
  return [...a.slice(offset), ...a.slice(0, offset)]
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem('testfr_v3_history') || '[]') }
  catch { return [] }
}

function saveHistory(entry) {
  try {
    const h = getHistory()
    h.unshift(entry)
    localStorage.setItem('testfr_v3_history', JSON.stringify(h.slice(0, 10)))
  } catch {}
}

function getOralSessions() {
  try { return parseInt(localStorage.getItem('testfr_oral_sessions') || '5') }
  catch { return 5 }
}

function useOralSession() {
  try {
    const n = Math.max(0, getOralSessions() - 1)
    localStorage.setItem('testfr_oral_sessions', String(n))
    return n
  } catch { return 0 }
}

export default function App() {
  const [lang, setLang] = useState('fr')
  const [prenom, setPrenom] = useState('')
  const [screen, setScreen] = useState('accueil')
  const [prevScreen, setPrevScreen] = useState('accueil')
  const [module, setModule] = useState('civique')
  const [level, setLevel] = useState('nat')
  const [mode, setMode] = useState('train')
  const [questions, setQuestions] = useState([])
  const [qIndex, setQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState([])
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [timerSecs, setTimerSecs] = useState(0)
  const [timerMax, setTimerMax] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showTranslate, setShowTranslate] = useState(false)
  const [oralMessages, setOralMessages] = useState([])
  const [oralTyping, setOralTyping] = useState(false)
  const [oralInput, setOralInput] = useState('')
  const [currentDialogue, setCurrentDialogue] = useState(null)
  const [activeSheet, setActiveSheet] = useState(null)
  const [showSheets, setShowSheets] = useState(false)
  const timerRef = useRef(null)
  const pausedRef = useRef(false)
  const chatRef = useRef(null)

  const T = TRANSLATIONS[lang] || TRANSLATIONS['fr']
  const t = (key) => {
    const keys = key.split('.')
    let v = T
    for (const k of keys) v = v?.[k]
    return v || TRANSLATIONS['fr'][key] || key
  }

  const tVerdict = (pct) => {
    const p = prenom || 'vous'
    let key
    if (pct < 25) key = '0-25'
    else if (pct < 50) key = '25-50'
    else if (pct < 65) key = '50-65'
    else if (pct < 80) key = '65-80'
    else key = '80-100'
    const v = T.verdicts?.[key] || ''
    return v.replace('{p}', p)
  }

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [oralMessages])

  const goTo = (s) => {
    setPrevScreen(screen)
    setScreen(s)
    if (s !== 'quiz') {
      clearInterval(timerRef.current)
    }
  }

  const goBack = () => {
    setScreen(prevScreen)
  }

  const selectModule = (mod) => {
    setModule(mod)
    setShowSheets(false)
    if (mod === 'langue') {
      setLevel('nat')
      goTo('mode')
    } else {
      goTo('niveau')
    }
  }

  const selectLevel = (lv) => {
    setLevel(lv)
    goTo('mode')
  }

  const startSession = (m) => {
    setMode(m)
    setScore(0)
    setAnswers([])
    setQIndex(0)
    setPaused(false)
    setSelected(null)
    setAnswered(false)
    setShowTranslate(false)

    let pool
    if (module === 'civique') {
      pool = shuffle([...QUESTIONS.civique[level]])
    } else {
      pool = shuffle([...QUESTIONS.langue])
    }
    const n = m === 'exam' ? Math.min(40, pool.length) : Math.min(20, pool.length)
    const qs = pool.slice(0, n)
    setQuestions(qs)

    if (m === 'exam') {
      const secs = 45 * 60
      setTimerSecs(secs)
      setTimerMax(secs)
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        if (!pausedRef.current) {
          setTimerSecs(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current)
              return 0
            }
            return prev - 1
          })
        }
      }, 1000)
    } else {
      clearInterval(timerRef.current)
      setTimerSecs(0)
    }

    goTo('quiz')
  }

  const selectOption = (i) => {
    if (answered) return
    setSelected(i)
  }

  const validateAnswer = () => {
    if (selected === null || answered) return
    const q = questions[qIndex]
    const ok = selected === q.ans
    setAnswered(true)
    if (ok) setScore(prev => prev + 1)
    setAnswers(prev => [...prev, { id: q.id, cat: q.cat, correct: ok }])
  }

  const nextQuestion = () => {
    if (qIndex + 1 >= questions.length) {
      clearInterval(timerRef.current)
      showResultsFn()
    } else {
      setQIndex(prev => prev + 1)
      setSelected(null)
      setAnswered(false)
      setShowTranslate(false)
    }
  }

  const showResultsFn = () => {
    const total = questions.length
    const finalScore = answers.filter(a => a.correct).length + (answers.length < questions.length && answered && questions[qIndex] && selected === questions[qIndex].ans ? 1 : 0)
    saveHistory({
      date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : lang),
      score: score + (answered && selected === questions[qIndex]?.ans && !answers.find(a => a.id === questions[qIndex]?.id) ? 1 : 0),
      total,
      pct: Math.round(((score) / total) * 100),
      passed: Math.round((score / total) * 100) >= 80,
      level, module, mode
    })
    goTo('results')
  }

  const startOral = () => {
    const sessions = getOralSessions()
    if (sessions <= 0) {
      alert('Vous avez utilisé toutes vos sessions de simulation orale.')
      return
    }
    const d = DIALOGUES[0]
    setCurrentDialogue(d)
    setOralMessages([{
      role: 'agent',
      text: "Bonjour ! Je suis l'agent en charge de votre dossier. Comment vous appelez-vous et quelle est la raison de votre visite aujourd'hui ?"
    }])
    useOralSession()
    goTo('oral')
  }

  const sendOralMessage = async () => {
    if (oralTyping || !oralInput.trim()) return
    const msg = oralInput.trim()
    setOralInput('')
    setOralMessages(prev => [...prev, { role: 'user', text: msg }])
    setOralTyping(true)

    try {
      const res = await fetch('/api/oral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...oralMessages, { role: 'user', text: msg }]
            .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.text })),
          systemPrompt: currentDialogue?.agent_prompt + " Réponds en 2-3 phrases maximum. Reste dans le contexte de l'entretien."
        })
      })
      const data = await res.json()
      setOralMessages(prev => [...prev, { role: 'agent', text: data.reply || "Pourriez-vous reformuler ?" }])
    } catch {
      setOralMessages(prev => [...prev, { role: 'agent', text: "Désolé, une erreur technique. Veuillez réessayer." }])
    }
    setOralTyping(false)
  }

  const shareApp = () => {
    const msg = T.share_msg || ''
    if (navigator.share) {
      navigator.share({ title: 'TestFR', text: msg }).catch(() => {
        navigator.clipboard?.writeText(msg)
      })
    } else {
      navigator.clipboard?.writeText(msg)
      alert('Message copié !')
    }
  }

  // Timer display
  const timerM = Math.floor(timerSecs / 60)
  const timerS = timerSecs % 60
  const timerDisplay = `${timerM}:${String(timerS).padStart(2, '0')}`
  const timerPct = timerMax > 0 ? (timerSecs / timerMax) * 100 : 100
  const timerClass = timerSecs > 20 * 60 ? 'ok' : timerSecs > 5 * 60 ? 'warn' : 'danger'

  const currentQ = questions[qIndex]
  const total = questions.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const passed = pct >= 80

  // Sidebar
  const Sidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-deco" />
      <div className="flag-strip">
        <span className="f1" /><span className="f2" /><span className="f3" />
      </div>
      <div className="sidebar-logo">Test<em>FR</em></div>
      <div className="sidebar-tagline">{T.tagline}</div>

      <div className="tri-blocks">
        <div
          className={`tri-block b-blue ${screen === 'accueil' || (screen === 'niveau' && module === 'civique') ? 'active' : ''}`}
          onClick={() => selectModule('civique')}
        >
          <div className="tri-icon">🏛️</div>
          <div className="tri-text">
            <div className="tri-title">{T.mod_civique}</div>
            <div className="tri-desc">{T.mod_civique_desc}</div>
          </div>
          <span className="tri-arrow">›</span>
        </div>

        <div
          className={`tri-block b-white ${screen === 'mode' && module === 'langue' ? 'active' : ''}`}
          onClick={() => selectModule('langue')}
        >
          <div className="tri-icon">🗣️</div>
          <div className="tri-text">
            <div className="tri-title">{T.mod_langue}</div>
            <div className="tri-desc">{T.mod_langue_desc}</div>
          </div>
          <span className="tri-arrow">›</span>
        </div>

        <div
          className={`tri-block b-red ${screen === 'historique' ? 'active' : ''}`}
          onClick={() => goTo('historique')}
        >
          <div className="tri-icon">📊</div>
          <div className="tri-text">
            <div className="tri-title">{T.mod_history}</div>
            <div className="tri-desc">{T.mod_history_desc}</div>
          </div>
          <span className="tri-arrow">›</span>
        </div>
      </div>

      <div className="sidebar-bottom">
        <div className="source-chip">{T.source}</div>
      </div>
    </aside>
  )

  // ACCUEIL
  if (screen === 'accueil') {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <h1 className="page-title">{T.welcome_title?.split(' ').map((w, i) => i === 0 ? <span key={i}>{w} </span> : w + ' ')}</h1>
            <p className="page-subtitle">{T.welcome_sub}</p>

            <div className="card mb-6">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{T.prenom_label}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={T.prenom_placeholder}
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{T.lang_label}</label>
                  <div className="lang-pills">
                    {['fr','ar','en','pt','es'].map(l => (
                      <button
                        key={l}
                        className={`lang-pill ${lang === l ? 'sel' : ''}`}
                        onClick={() => setLang(l)}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="alert gold">
              <span>⚠️</span>
              <span>{T.warning}</span>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // NIVEAU
  if (screen === 'niveau') {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <div className="back-bar" style={{borderRadius: 'var(--r)', marginBottom: 24, padding: '12px 16px'}}>
              <button className="back-btn" onClick={goBack}>{T.back}</button>
              <span className="back-bar-title">{T.choose_level}</span>
            </div>

            <div className="level-grid">
              <div className="level-card" onClick={() => selectLevel('csp')}>
                <div className="level-icon" style={{background:'#EEF2FF'}}>📋</div>
                <div className="level-info">
                  <div className="level-name">{T.level_csp}</div>
                  <div className="level-desc">{T.level_csp_desc}</div>
                </div>
                <div className="level-badge" style={{background:'#EEF2FF',color:'var(--blue)'}}>CSP</div>
              </div>
              <div className="level-card" onClick={() => selectLevel('cr')}>
                <div className="level-icon" style={{background:'#FEF2F2'}}>🏠</div>
                <div className="level-info">
                  <div className="level-name">{T.level_cr}</div>
                  <div className="level-desc">{T.level_cr_desc}</div>
                </div>
                <div className="level-badge" style={{background:'#FEF2F2',color:'var(--red)'}}>CR</div>
              </div>
              <div className="level-card" onClick={() => selectLevel('nat')}>
                <div className="level-icon" style={{background:'var(--gold-pale)'}}>⭐</div>
                <div className="level-info">
                  <div className="level-name">{T.level_nat}</div>
                  <div className="level-desc">{T.level_nat_desc}</div>
                </div>
                <div className="level-badge" style={{background:'var(--gold-pale)',color:'var(--gold)'}}>NAT</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // MODE
  if (screen === 'mode') {
    const sheetKeys = Object.keys(SHEETS)
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <div className="back-bar" style={{borderRadius: 'var(--r)', marginBottom: 24, padding: '12px 16px'}}>
              <button className="back-btn" onClick={goBack}>{T.back}</button>
              <span className="back-bar-title">{module === 'civique' ? T.mod_civique : T.mod_langue}</span>
            </div>

            <p className="section-label">Mode d'entraînement</p>
            <div className="mode-tricolor">
              <div className="mode-tri-card blue-t" onClick={() => startSession('train')}>
                <span className="mode-tri-icon">📖</span>
                <div className="mode-tri-title">{T.mode_train}</div>
                <div className="mode-tri-desc">{T.mode_train_desc}</div>
              </div>
              <div className="mode-tri-card white-t" onClick={() => setShowSheets(!showSheets)}>
                <span className="mode-tri-icon">📋</span>
                <div className="mode-tri-title">{T.mode_sheets}</div>
                <div className="mode-tri-desc">{T.mode_sheets_desc}</div>
              </div>
              <div className="mode-tri-card red-t" onClick={() => startSession('exam')}>
                <span className="mode-tri-icon">⏱️</span>
                <div className="mode-tri-title">{T.mode_exam}</div>
                <div className="mode-tri-desc">{T.mode_exam_desc}</div>
              </div>
            </div>

            {showSheets && (
              <>
                <p className="section-label">Fiches de révision</p>
                <div className="sheets-list">
                  {sheetKeys.map(key => (
                    <div key={key} className="sheet-item" onClick={() => { setActiveSheet(key); goTo('fiche') }}>
                      <span className="sheet-icon">{SHEETS[key].icon}</span>
                      <span className="sheet-name">{key}</span>
                      <span className="sheet-arrow">›</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {module === 'civique' && (
              <>
                <p className="section-label">{T.mode_oral}</p>
                <div className="level-card" onClick={startOral}>
                  <div className="level-icon" style={{background:'#E8F8F2'}}>🎤</div>
                  <div className="level-info">
                    <div className="level-name">{T.mode_oral}</div>
                    <div className="level-desc">{T.mode_oral_desc} — {T.oral_sessions?.replace('{n}', getOralSessions())}</div>
                  </div>
                  <span style={{color:'var(--muted)',fontSize:20}}>›</span>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  // FICHE
  if (screen === 'fiche' && activeSheet) {
    const sheet = SHEETS[activeSheet]
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <div className="back-bar" style={{borderRadius: 'var(--r)', marginBottom: 24, padding: '12px 16px'}}>
              <button className="back-btn" onClick={() => setScreen('mode')}>{T.back}</button>
              <span className="back-bar-title">{activeSheet}</span>
            </div>
            <div className="fiche-card">
              <div className="fiche-header">
                <div className="fiche-icon" style={{background: sheet.bg, fontSize: 28}}>{sheet.icon}</div>
                <h2 className="fiche-title" style={{color: sheet.color}}>{activeSheet}</h2>
              </div>
              <ul className="fiche-points">
                {sheet.points.map((p, i) => (
                  <li key={i}>
                    <span className="fiche-arrow">→</span>
                    <span dangerouslySetInnerHTML={{__html: p}} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // QUIZ
  if (screen === 'quiz' && currentQ) {
    const letters = ['A','B','C','D']
    const contextLines = currentQ.texte ? currentQ.texte.split('\n').filter(l => l.trim()) : []

    return (
      <div style={{minHeight: '100vh', background: 'var(--bg)'}}>
        {/* Topbar */}
        <div className="quiz-topbar">
          <div className="quiz-topbar-inner">
            <button className="pause-btn" onClick={() => setPaused(true)}>⏸</button>
            <div className="quiz-progress-wrap">
              <div className="quiz-meta">
                <span className="quiz-counter">
                  {T.question_of?.replace('{n}', qIndex+1).replace('{t}', total)}
                </span>
                <span className="quiz-score-live">{score} ✓</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${((qIndex+1)/total)*100}%`}} />
              </div>
            </div>
            {mode === 'exam' && (
              <div className={`timer-widget ${timerClass}`}>
                <div className="timer-top">
                  <span className="timer-icon">⏱</span>
                  <span className="timer-val">{timerDisplay}</span>
                </div>
                <div className="timer-label">{T.time_left}</div>
                <div className="timer-mini-bar">
                  <div className="timer-mini-fill" style={{width: `${timerPct}%`}} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question */}
        <div className="quiz-content">
          <span className="cat-chip" style={{background: CAT_COLORS[currentQ.cat] || '#666'}}>
            {T.cats?.[currentQ.cat] || currentQ.cat}
          </span>

          {contextLines.length > 0 && (
            <div className="q-context">
              {contextLines.map((line, i) => {
                const isTitle = line.startsWith('[')
                const colonIdx = line.indexOf(':')
                if (!isTitle && colonIdx > 0) {
                  const speaker = line.substring(0, colonIdx).trim()
                  const speech = line.substring(colonIdx+1).trim()
                  const isAgent = ['Agent','Journaliste','Intervenante','Message','Annonce'].some(s => speaker.startsWith(s))
                  return (
                    <span key={i} className="ctx-line">
                      <span className="ctx-speaker" style={{color: isAgent ? 'var(--blue)' : 'var(--text)'}}>{speaker} :</span>
                      {speech}
                    </span>
                  )
                }
                return <span key={i} className="ctx-line" style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>{line}</span>
              })}
            </div>
          )}

          <div className="q-text">{currentQ.q}</div>

          {lang !== 'fr' && (
            <div className="translate-row">
              <button className="translate-btn" onClick={() => setShowTranslate(!showTranslate)}>
                {showTranslate ? T.translate_hide : T.translate_show}
              </button>
              {showTranslate && (
                <div className="translate-box show">
                  [Traduction disponible après hébergement]
                </div>
              )}
            </div>
          )}

          <div className="options">
            {currentQ.opts.map((opt, i) => {
              let cls = ''
              if (answered) {
                if (i === currentQ.ans) cls = 'correct'
                else if (i === selected && i !== currentQ.ans) cls = 'wrong'
              } else if (i === selected) {
                cls = 'sel'
              }
              return (
                <button
                  key={i}
                  className={`opt ${cls}`}
                  onClick={() => selectOption(i)}
                  disabled={answered}
                >
                  <span className="opt-letter">{letters[i]}</span>
                  <span className="opt-text">{opt}</span>
                  {answered && i === currentQ.ans && <span className="opt-feedback-badge">✓</span>}
                  {answered && i === selected && i !== currentQ.ans && <span className="opt-feedback-badge">✗</span>}
                </button>
              )
            })}
          </div>

          {answered && (
            <div className={`feedback-line show ${selected === currentQ.ans ? 'ok' : 'ko'}`}>
              {selected === currentQ.ans
                ? T.correct
                : `${T.wrong} — ${T.good_was} ${currentQ.opts[currentQ.ans]}`
              }
            </div>
          )}

          <div style={{height: 20}} />

          <div className="action-row">
            {!answered ? (
              <button
                className="btn btn-primary"
                onClick={validateAnswer}
                disabled={selected === null}
              >
                {T.validate}
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={nextQuestion}>
                {qIndex < total - 1 ? T.next_q : T.finish}
              </button>
            )}
          </div>
        </div>

        {/* Pause overlay */}
        {paused && (
          <div className="pause-overlay show">
            <div className="pause-card">
              <div className="pause-icon">⏸</div>
              <div className="pause-title">{T.pause}</div>
              <div className="pause-sub">{T.pause_sub}</div>
              <div className="pause-actions">
                <button className="btn btn-primary" onClick={() => setPaused(false)}>{T.resume}</button>
                <button className="btn-danger" onClick={() => { clearInterval(timerRef.current); goTo('accueil') }}>{T.quit}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // RÉSULTATS
  if (screen === 'results') {
    const cats = [...new Set(answers.map(a => a.cat))]
    const nextStepsItems = T.next_steps_items || []

    return (
      <div style={{minHeight: '100vh', background: 'var(--bg)'}}>
        <div className="results-hero">
          <div className="score-ring">
            <div className="score-num">{score}</div>
            <div className="score-den">/{total}</div>
          </div>
          <div className="res-verdict">
            {passed ? `🎉 ${prenom || ''}` : `${score}/${total} — ${pct}%`}
          </div>
          <div className="res-pct">{pct}% {passed ? '✓' : `— seuil : 80%`}</div>
        </div>

        <div className="results-body">
          <div className="res-message-card">{tVerdict(pct)}</div>

          <p className="section-label">{T.by_theme}</p>
          {cats.map(cat => {
            const catA = answers.filter(a => a.cat === cat)
            const catOk = catA.filter(a => a.correct).length
            const catPct = Math.round((catOk / catA.length) * 100)
            const color = CAT_COLORS[cat] || '#666'
            return (
              <div key={cat} className="theme-row">
                <div className="theme-dot" style={{background: color}} />
                <div className="theme-name">{T.cats?.[cat] || cat}</div>
                <div className="theme-bar">
                  <div className="theme-fill" style={{
                    width: `${catPct}%`,
                    background: catPct >= 80 ? 'var(--success)' : 'var(--error)'
                  }} />
                </div>
                <div className="theme-score" style={{color: catPct >= 80 ? 'var(--success)' : 'var(--error)'}}>
                  {catOk}/{catA.length}
                </div>
              </div>
            )
          })}

          {passed && nextStepsItems.length > 0 && (
            <div className="next-steps-card mt-6">
              <div className="next-steps-title">🎯 {T.next_steps}</div>
              {nextStepsItems.map((step, i) => (
                <div key={i} className="step-item">
                  <span className="step-num">{i+1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}

          <div className="share-row">
            <button className="share-btn" onClick={shareApp}>
              <span>📨</span> {T.share}
            </button>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => startSession(mode)}>{T.retry}</button>
            <button className="btn btn-secondary" onClick={() => goTo('accueil')}>{T.home}</button>
          </div>
        </div>
      </div>
    )
  }

  // ORAL
  if (screen === 'oral') {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <div className="back-bar" style={{borderRadius:'var(--r)',marginBottom:24,padding:'12px 16px'}}>
              <button className="back-btn" onClick={() => setScreen('mode')}>{T.back}</button>
              <span className="back-bar-title">{T.mode_oral}</span>
            </div>

            {currentDialogue && (
              <div className="oral-context">
                <div className="oral-ctx-level">📍 {currentDialogue.niveau} — {currentDialogue.titre}</div>
                <div className="oral-ctx-text">{currentDialogue.contexte}</div>
              </div>
            )}

            <div className="alert blue mb-4" style={{fontSize:13}}>{T.oral_limit}</div>

            <div className="chat" ref={chatRef}>
              {oralMessages.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
              ))}
              {oralTyping && <div className="bubble agent" style={{opacity:0.6}}>...</div>}
            </div>

            <div className="oral-input-row">
              <textarea
                className="oral-textarea"
                placeholder={T.oral_placeholder}
                value={oralInput}
                onChange={e => setOralInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOralMessage() }}}
                rows={2}
              />
              <button className="oral-send" onClick={sendOralMessage} disabled={oralTyping}>→</button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // HISTORIQUE
  if (screen === 'historique') {
    const history = getHistory()
    const recent = history.slice(0, 8).reverse()
    const maxScore = recent.length > 0 ? Math.max(...recent.map(h => h.total)) : 40
    const levelNames = { nat: T.level_nat, csp: T.level_csp, cr: T.level_cr }

    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <div className="back-bar" style={{borderRadius:'var(--r)',marginBottom:24,padding:'12px 16px'}}>
              <button className="back-btn" onClick={() => goTo('accueil')}>{T.back}</button>
              <span className="back-bar-title">{T.mod_history}</span>
            </div>

            {history.length === 0 ? (
              <div className="card" style={{textAlign:'center',color:'var(--muted)',padding:40}}>
                {T.no_history}
              </div>
            ) : (
              <>
                <div className="card mb-6">
                  <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,marginBottom:16}}>
                    📈 Ma progression
                  </div>
                  <div className="chart-area">
                    {recent.map((h, i) => (
                      <div key={i} className="chart-col">
                        <div
                          className={`chart-bar ${h.passed ? 'p' : 'f'}`}
                          style={{height: `${(h.score/maxScore)*70}px`}}
                          title={`${h.score}/${h.total}`}
                        />
                        <div className="chart-lbl">{h.score}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {history.map((h, i) => (
                  <div key={i} className="hist-item">
                    <div className="hist-num">#{i+1}</div>
                    <div className="hist-info">
                      <div className="hist-score">{h.score}/{h.total} — {h.pct}%</div>
                      <div className="hist-meta">{h.date} · {levelNames[h.level] || h.level}</div>
                    </div>
                    <div className={`hist-badge ${h.passed ? 'p' : 'f'}`}>
                      {h.passed ? T.passed : T.failed}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  return null
}
