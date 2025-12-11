import { useEffect, useMemo, useRef, useState } from 'react'
import * as handlers from './handlers'
import { extractTextFromPdf } from './pdf'
import logo from './assets/parapal.png'
import './App.css'

import AuthPanel from './components/AuthPanel'
import { getCurrentCognitoUser } from './auth'

type Role = 'user' | 'agent'

type Message = {
  id: string
  role: Role
  text: string
  meta: string
  loading?: boolean
}

type Rubric = {
  id: string
  name: string
  description: string
  criteria?: string[]
}

const starterRubrics: Rubric[] = [
  {
    id: 'r1',
    name: 'Narrative Writing (Grade 4)',
    description: 'Checks sequence, detail, and a satisfying ending.',
    criteria: [],
  },
  {
    id: 'r2',
    name: 'Opinion Writing (Grade 5)',
    description: 'Focuses on stance, reasons, and evidence.',
    criteria: [],
  },
]

function App() {
  const [activeScreen, setActiveScreen] = useState<'chat' | 'rubrics'>('chat')
  const [navOpen, setNavOpen] = useState(false)
  const [rubrics, setRubrics] = useState<Rubric[]>(starterRubrics)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm0',
      role: 'agent',
      meta: 'ParaPal grader',
      text: 'Hi! Upload an essay, pick the rubric criteria, and I will draft feedback and a score.',
    },
  ])
  const [essayFile, setEssayFile] = useState<File | null>(null)
  const [essayText, setEssayText] = useState('')
  const [selectedRubricId, setSelectedRubricId] = useState(rubrics[0].id)
  const [status, setStatus] = useState('')
  const [essayStatus, setEssayStatus] = useState('')
  const [isSending, setIsSending] = useState(false)

  // authenticated user email/username (null if logged out)
  const [authedUser, setAuthedUser] = useState<string | null>(null)

  const selectedRubric = useMemo(
    () => rubrics.find((r) => r.id === selectedRubricId) || rubrics[0],
    [rubrics, selectedRubricId],
  )

  // on initial load, check if Cognito already has a session
  useEffect(() => {
    ;(async () => {
      const user = await getCurrentCognitoUser()
      if (user) {
        setAuthedUser(user.email)
      }
    })()
  }, [])

  // this is called by AuthPanel when user logs in/out
  const handleAuthChange = (email: string | null) => {
    setAuthedUser(email)
  }

  const handleAddRubric = async (newRubric: Rubric) => {
    setRubrics((prev) => [...prev, newRubric])
    setStatus('Saving rubric...')
    await handlers.saveRubric(newRubric)
    setStatus('Rubric saved')
    setTimeout(() => setStatus(''), 1200)
  }

  const handleDeleteRubric = (id: string) => {
    setRubrics((prev) => prev.filter((r) => r.id !== id))
    if (selectedRubricId === id && rubrics.length > 1) {
      setSelectedRubricId(rubrics[0].id)
    }
  }

  const handleRubricUpload = async (file: File | undefined | null) => {
    if (!file) return
    setStatus('Uploading...')
    await handlers.uploadRubricFile(file)
    setStatus(`Uploaded ${file.name}`)
    setTimeout(() => setStatus(''), 1200)
  }

  const handleEssayUpload = async (file: File | undefined | null) => {
    if (!file) return
    setEssayFile(file)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        setEssayStatus('Extracting text from PDF...')
        const text = await extractTextFromPdf(file)
        setEssayText(text || '(No text extracted from PDF)')
        setEssayStatus(text ? 'PDF text extracted' : 'No text found in PDF')
      } catch (err) {
        console.error(err)
        setEssayText('')
        setEssayStatus('Could not read PDF. Please paste text or try another file.')
      } finally {
        setTimeout(() => setEssayStatus(''), 1800)
      }
    } else {
      const text = await file.text()
      setEssayText(text)
      setEssayStatus('')
    }
  }

  const handleSend = async () => {
    if (!essayText && !essayFile) return
    setIsSending(true)
    const loaderId = crypto.randomUUID()
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      meta: 'Teacher',
      text: [
        essayText ? `Essay:\n${essayText.slice(0, 1200)}${essayText.length > 1200 ? '...' : ''}` : '',
        essayFile ? `\nAttached file: ${essayFile.name}` : '',
        `\nRubric: ${selectedRubric?.name ?? 'Custom rubric'}`,
      ]
        .join('')
        .trim(),
    }

    const rubricLabel = selectedRubric?.name ?? 'Custom rubric'
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: loaderId, role: 'agent', meta: `Grading with ${rubricLabel}`, text: '', loading: true },
    ])

    try {
      const response = await handlers.sendMessage({
        prompt: '',
        essayText: essayText || `(file) ${essayFile?.name ?? 'Essay'}`,
        rubric: selectedRubric,
        selectedCriteria: [],
      })

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== loaderId),
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: response.reply,
          meta: `Using ${response.rubricUsed}`,
        },
      ])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== loaderId),
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: err?.message || 'Failed to grade essay.',
          meta: 'Error',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleNavSelect = (screen: 'chat' | 'rubrics') => {
    setActiveScreen(screen)
    setNavOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="logo-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <img src={logo} alt="ParaPal logo" className="logo-img" />
        </button>
        <div>
          <p className="eyebrow">ParaPal</p>
          <h1 className="top-title">Essay Grader</h1>
          {authedUser && <p className="muted">Signed in as {authedUser}</p>}
        </div>
      </header>

      <main>
        {authedUser ? (
          activeScreen === 'rubrics' ? (
            <RubricManager
              rubrics={rubrics}
              onAddRubric={handleAddRubric}
              onDelete={handleDeleteRubric}
              onUploadFile={handleRubricUpload}
              status={status}
            />
          ) : (
            <ChatWorkspace
              rubrics={rubrics}
              messages={messages}
              selectedRubricId={selectedRubricId}
              onRubricChange={setSelectedRubricId}
              essayFile={essayFile}
              onEssayUpload={handleEssayUpload}
              onSend={handleSend}
              isSending={isSending}
              essayText={essayText}
              essayStatus={essayStatus}
            />
          )
        ) : (
          <section className="panel chat-panel">
            <div className="panel-header">
              <h2>Welcome to ParaPal</h2>
              <div className="badge">Sign in required</div>
            </div>
            <p className="muted">
              Please sign up or log in from the menu (top-left) to grade essays with ParaPal.
            </p>
          </section>
        )}
      </main>

      <div
        className={`nav-overlay ${navOpen ? 'open' : ''}`}
        onClick={() => setNavOpen(false)}
        role="presentation"
      >
        <aside className="nav drawer" onClick={(e) => e.stopPropagation()}>
          <div className="nav-header-row">
            <div className="nav-logo">
              <img src={logo} alt="ParaPal logo" className="logo-img" />
            </div>
            <div className="nav-title">
              <p className="eyebrow">ParaPal</p>
              <h1>Essay Grader</h1>
            </div>
            <button className="nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu">
              ×
            </button>
          </div>
          <p className="muted">Upload rubrics, send essays, and get quick feedback for students.</p>
          <div className="nav-buttons">
            <button
              className={activeScreen === 'chat' ? 'active' : ''}
              onClick={() => handleNavSelect('chat')}
            >
              <span>Chat & Grade</span>
              <small>Send essays to the agent</small>
            </button>
            <button
              className={activeScreen === 'rubrics' ? 'active' : ''}
              onClick={() => handleNavSelect('rubrics')}
            >
              <span>Standards & Rubrics</span>
              <small>Upload and curate grading criteria</small>
            </button>
          </div>

          {/* Auth UI lives in the drawer and keeps App in sync */}
          <div style={{ marginTop: '1.5rem' }}>
            <AuthPanel onAuthChange={handleAuthChange} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function RubricManager({
  rubrics,
  onAddRubric,
  onDelete,
  onUploadFile,
  status,
}: {
  rubrics: Rubric[]
  onAddRubric: (rubric: Rubric) => void
  onDelete: (id: string) => void
  onUploadFile: (file: File | undefined | null) => void
  status: string
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return
    const newRubric: Rubric = {
      id: `rubric-${crypto.randomUUID()}`,
      name,
      description,
      criteria: [],
    }
    onAddRubric(newRubric)
    setName('')
    setDescription('')
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>Standards & Rubrics</h2>
        <div className="badge">{rubrics.length} saved</div>
      </div>
      <div className="upload-box">
        <label className="muted">Upload rubric / standards file</label>
        <input
          className="input"
          type="file"
          accept=".pdf,.doc,.docx,.csv,.txt"
          onChange={(e) => onUploadFile(e.target.files?.[0])}
        />
        <p className="status">{status || 'Share district standards or rubric files here.'}</p>
      </div>

      <div className="grid-2">
        <div className="input-group">
          <label>Rubric name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Argument Writing (Grade 4)"
          />
        </div>
        <div className="input-group">
          <label>Description</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this rubric emphasize?"
          />
        </div>
      </div>

      <div className="controls-row">
        <button className="button" onClick={handleCreate}>
          Save rubric
        </button>
        <p className="status">Stored locally until backend wiring is ready.</p>
      </div>

      <div className="rubric-list">
        {rubrics.map((rubric) => (
          <div className="rubric-card" key={rubric.id}>
            <header>
              <div>
                <p className="rubric-name">{rubric.name}</p>
                <p className="status">{rubric.description || 'No description'}</p>
              </div>
              <button className="ghost" onClick={() => onDelete(rubric.id)}>
                Remove
              </button>
            </header>
            <p className="status">Rubric stored locally.</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChatWorkspace({
  rubrics,
  messages,
  selectedRubricId,
  onRubricChange,
  essayFile,
  onEssayUpload,
  onSend,
  isSending,
  essayText,
  essayStatus,
}: {
  rubrics: Rubric[]
  messages: Message[]
  selectedRubricId: string
  onRubricChange: (id: string) => void
  essayFile: File | null
  onEssayUpload: (file: File | undefined | null) => void
  onSend: () => void
  isSending: boolean
  essayText: string
  essayStatus: string
}) {
  const selectedRubric = rubrics.find((r) => r.id === selectedRubricId) || rubrics[0]

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>Chat & Grade</h2>
        <div className="badge">Ready</div>
      </div>
      <div className="chat-grid">
        <div className="chat-shell">
          <MessageList messages={messages} />
        </div>

        <div className="panel side-panel">
          <div className="panel-header">
            <h3>Rubric</h3>
            <div className="badge">Rubrics {rubrics.length}</div>
          </div>
          <div className="input-group">
            <label>Pick a rubric</label>
            <select
              className="input"
              value={selectedRubricId}
              onChange={(e) => onRubricChange(e.target.value)}
            >
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="status">{selectedRubric?.description}</div>
          </div>
          <div className="upload-box">
            <div className="muted">
              Tip: switch rubrics without losing your chat history. The selected rubric will be sent
              with the essay to the AI grader.
            </div>
          </div>
        </div>
      </div>

      <div className="chat-input">
        <div className="controls-row">
          <input
            className="input"
            type="file"
            accept=".txt,.doc,.docx,.pdf"
            onChange={(e) => onEssayUpload(e.target.files?.[0])}
          />
          {essayFile ? (
            <span className="file-chip">Essay loaded: {essayFile.name}</span>
          ) : (
            <span className="status">Attach an essay file above.</span>
          )}
        </div>
        {essayText && (
          <div className="upload-box">
            <div className="status">Preview</div>
            <div className="muted">
              {essayText.slice(0, 360)}
              {essayText.length > 360 ? '...' : ''}
            </div>
          </div>
        )}
        <div className="controls-row">
          <button className="button" onClick={onSend} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send to grader'}
          </button>
          <div className="status">
            {essayStatus || 'The AI grader will analyze the essay with the selected rubric.'}
          </div>
        </div>
      </div>
    </section>
  )
}

function MessageList({ messages }: { messages: Message[] }) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = listRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [messages])

  return (
    <div className="messages" ref={listRef}>
      {messages.map((m) => (
        <div
          key={m.id}
          className={`message ${m.role === 'user' ? 'user' : 'agent'} ${
            m.loading ? 'loading' : ''
          }`}
        >
          <div className="meta">
            <span>{m.role === 'user' ? 'Teacher' : 'ParaPal'}</span>
            <span>•</span>
            <span>{m.meta}</span>
          </div>
          <div className="body">
            {m.loading ? <span className="spinner" aria-label="Loading" /> : renderMessageContent(m)}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderMessageContent(message: Message) {
  if (message.loading) return <span className="spinner" aria-label="Loading" />
  if (!message.text) return null

  if (message.role === 'agent') {
    const lines = message.text.split('\n')
    const headerLine = lines[0] || ''
    const remainder = lines.slice(1)

    const tokenMatches = headerLine.match(/\[([^\]]+)\]/g) || []
    const scores = tokenMatches
      .map((token) => token.replace(/\[|\]/g, ''))
      .map((pair) => {
        const [label, score] = pair.split(':').map((s) => s.trim())
        return { label, score }
      })
      .filter((s) => s.label)

    const evidenceStart = remainder.findIndex((l) => !l.trim())
    const feedbackLines = evidenceStart === -1 ? remainder : remainder.slice(0, evidenceStart)
    const feedbackText = feedbackLines.join('\n').trim()
    const evidenceLines =
      evidenceStart === -1 ? [] : remainder.slice(evidenceStart + 1).filter((l) => l.trim())

    if (!scores.length && !feedbackText.trim() && !evidenceLines.length) {
      return <pre className="plain-text">{message.text}</pre>
    }

    return (
      <>
        {scores.length ? (
          <div className="score-grid">
            {scores.map((s, idx) => (
              <div key={`${s.label}-${idx}`} className="score-card">
                <div className="score-label">{s.label}</div>
                <div className="score-value">{s.score}</div>
              </div>
            ))}
          </div>
        ) : null}
        {feedbackText && <p className="feedback-text">{feedbackText}</p>}
        {evidenceLines.length ? (
          <ul className="evidence-list">
            {evidenceLines.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        ) : null}
      </>
    )
  }

  return <pre className="plain-text">{message.text}</pre>
}

export default App