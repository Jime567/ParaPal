import { useEffect, useMemo, useRef, useState } from 'react'
import * as handlers from './handlers'
import { extractTextFromPdf } from './pdf'
import logo from './assets/parapal.png'
import './App.css'
import standardsDataSource from './standards-data.json'

import AuthPanel from './components/AuthPanel'
import { getCurrentCognitoUser, logoutUser } from './auth'

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
  content?: string  // Extracted text from uploaded PDF
  criteria?: string[]
}

type StandardRow = {
  grade: string
  strand: string
  code: string
  description: string
}

type StrandWithSelection = {
  strand: string
  checked: boolean
  standards: (StandardRow & { checked: boolean })[]
}

type GradeOption = { value: string; label: string; dataGrade: string }

const strandLabels: Record<string, string> = {
  SL: 'Speaking & Listening',
  W: 'Writing',
  R: 'Reading',
}

const gradeOptions: GradeOption[] = [
  { value: 'K', label: 'Kindergarten', dataGrade: 'Kindergarten' },
  { value: '1', label: 'Grade 1', dataGrade: 'Grade 1' },
  { value: '2', label: 'Grade 2', dataGrade: 'Grade 2' },
  { value: '3', label: 'Grade 3', dataGrade: 'Grade 3' },
  { value: '4', label: 'Grade 4', dataGrade: 'Grade 4' },
  { value: '5', label: 'Grade 5', dataGrade: 'Grade 5' },
  { value: '6', label: 'Grade 6', dataGrade: 'Grade 6' },
  { value: '7', label: 'Grade 7', dataGrade: 'Grades 7–8' },
  { value: '8', label: 'Grade 8', dataGrade: 'Grades 7–8' },
  { value: '9', label: 'Grade 9', dataGrade: 'Grades 9–10' },
  { value: '10', label: 'Grade 10', dataGrade: 'Grades 9–10' },
  { value: '11', label: 'Grade 11', dataGrade: 'Grades 11–12' },
  { value: '12', label: 'Grade 12', dataGrade: 'Grades 11–12' },
]

const standardsData = standardsDataSource as StandardRow[]

const makeStrandKey = (grade: string, strand: string) => `${grade}__${strand}`
const makeStandardKey = (grade: string, strand: string, code: string) =>
  `${grade}__${strand}__${code}`

const starterRubrics: Rubric[] = [
  {
    id: 'r1',
    name: 'Narrative Writing (Grade 4)',
    description: 'Checks sequence, detail, and a satisfying ending.',
    content: 'Write narrative pieces to develop real or imagined experiences or events using effective technique, descriptive details, clear event sequences, and provide a resolution. a. Orient the reader by establishing a situation and introducing a narrator and/or characters; organize an event sequence that unfolds naturally. b. Use dialogue and description to develop experiences and events or show the responses of characters to situations. c. Use a variety of transitional words and phrases to manage the sequence of events. d. Use concrete words, phrases, complex sentences, and sensory details to convey experiences and events precisely. e. Use appropriate conventions when writing including text cohesion, sentence structure, and phrasing.',
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
  const [selectedGrade, setSelectedGrade] = useState<GradeOption['value']>(() =>
    gradeOptions.find((g) => g.value === '4') ? '4' : gradeOptions[0].value,
  )
  const [selectedStrands, setSelectedStrands] = useState<Record<string, boolean>>({})
  const [selectedStandardsMap, setSelectedStandardsMap] = useState<Record<string, boolean>>({})

  // 👇 NEW: authenticated user email/username (null if logged out)
  const [authedUser, setAuthedUser] = useState<string | null>(null)
  
  // 👇 Temporary rubric content from file upload (before saving)
  const [uploadedRubricContent, setUploadedRubricContent] = useState<string>('')

  const selectedRubric = useMemo(
    () => rubrics.find((r) => r.id === selectedRubricId) || rubrics[0],
    [rubrics, selectedRubricId],
  )

  const standardsByGrade = useMemo(() => {
    const grouped: Record<string, Record<string, StandardRow[]>> = {}
    standardsData.forEach((row) => {
      const gradeKey = row.grade
      const strandKey = row.strand
      if (!grouped[gradeKey]) {
        grouped[gradeKey] = {}
      }
      if (!grouped[gradeKey][strandKey]) {
        grouped[gradeKey][strandKey] = []
      }
      grouped[gradeKey][strandKey].push(row)
    })
    return grouped
  }, [])

  const selectedDataGrade = useMemo(
    () => gradeOptions.find((g) => g.value === selectedGrade)?.dataGrade ?? gradeOptions[0].dataGrade,
    [selectedGrade],
  )

  const strandOptions = useMemo<StrandWithSelection[]>(() => {
    const gradeStrands = standardsByGrade[selectedDataGrade] ?? {}
    return Object.entries(gradeStrands).map(([strand, items]) => {
      const strandChecked = !!selectedStrands[makeStrandKey(selectedDataGrade, strand)]
      return {
        strand,
        checked: strandChecked,
        standards: items.map((item) => ({
          ...item,
          checked: !!selectedStandardsMap[makeStandardKey(selectedDataGrade, strand, item.code)],
        })),
      }
    })
  }, [selectedDataGrade, standardsByGrade, selectedStandardsMap, selectedStrands])

  const selectedStandardsList = useMemo(
    () =>
      Object.entries(standardsByGrade[selectedDataGrade] ?? {}).flatMap(([strand, items]) => {
        const strandActive = !!selectedStrands[makeStrandKey(selectedDataGrade, strand)]
        if (!strandActive) return []
        return items
          .filter((item) =>
            selectedStandardsMap[makeStandardKey(selectedDataGrade, strand, item.code)],
          )
          .map((item) => ({
            code: item.code,
            description: item.description,
            strand,
            grade: selectedDataGrade,
          }))
      }),
    [selectedDataGrade, selectedStandardsMap, selectedStrands, standardsByGrade],
  )

  const selectedStandardsCount = selectedStandardsList.length

  // 👇 NEW: on initial load, check if Cognito already has a session
  useEffect(() => {
    ;(async () => {
      const user = await getCurrentCognitoUser()
      if (user) {
        setAuthedUser(user.email)
      }
    })()
  }, [])

  // 👇 NEW: this is called by AuthPanel when user logs in/out
  const handleAuthChange = (email: string | null) => {
    setAuthedUser(email)
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
      setAuthedUser(null)
      setNavOpen(false)
    } catch (err) {
      console.error('Logout failed:', err)
    }
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
    setStatus('Extracting rubric...')
    
    let rubricContent = ''
    
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const text = await extractTextFromPdf(file)
        rubricContent = text || ''
        setStatus(text ? 'Rubric text extracted. Fill in the fields below and click "Save rubric".' : 'No text found in PDF')
      } catch (err) {
        console.error(err)
        setStatus('Could not read PDF. Please try another file.')
        setTimeout(() => setStatus(''), 1800)
        return
      }
    } else {
      rubricContent = await file.text()
      setStatus('Rubric content loaded. Fill in the fields below and click "Save rubric".')
    }
    
    // Store content temporarily until user clicks "Save rubric"
    setUploadedRubricContent(rubricContent)
    await handlers.uploadRubricFile(file)
    
    setTimeout(() => setStatus(''), 3000)
  }

  const handleToggleStrand = (strand: string) => {
    const gradeKey = selectedDataGrade
    const strandKey = makeStrandKey(gradeKey, strand)
    const nextChecked = !selectedStrands[strandKey]
    setSelectedStrands((prev) => ({ ...prev, [strandKey]: nextChecked }))

    const strandStandards = standardsByGrade[gradeKey]?.[strand] ?? []
    if (!strandStandards.length || !nextChecked) return

    const hasAnySelection = strandStandards.some((item) =>
      selectedStandardsMap[makeStandardKey(gradeKey, strand, item.code)],
    )

    if (!hasAnySelection) {
      setSelectedStandardsMap((prev) => {
        const next = { ...prev }
        strandStandards.forEach((item) => {
          const key = makeStandardKey(gradeKey, strand, item.code)
          next[key] = true
        })
        return next
      })
    }
  }

  const handleToggleStandard = (strand: string, code: string) => {
    const gradeKey = selectedDataGrade
    const standardKey = makeStandardKey(gradeKey, strand, code)
    setSelectedStandardsMap((prev) => {
      const next = { ...prev }
      if (next[standardKey]) {
        delete next[standardKey]
      } else {
        next[standardKey] = true
      }
      return next
    })
    const strandKey = makeStrandKey(gradeKey, strand)
    setSelectedStrands((prev) => ({ ...prev, [strandKey]: true }))
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
    const standardsSummary =
      selectedStandardsList.length > 0
        ? `\nStandards: ${selectedStandardsList.map((s) => s.code).join(', ')}`
        : '\nStandards: None selected'
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      meta: 'Teacher',
      text: [
        essayText ? `Essay:\n${essayText.slice(0, 1200)}${essayText.length > 1200 ? '...' : ''}` : '',
        essayFile ? `\nAttached file: ${essayFile.name}` : '',
        `\nRubric: ${selectedRubric?.name ?? 'Custom rubric'}`,
        standardsSummary,
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
        standards: selectedStandardsList,
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
        <div className="header-content">
          <div className="header-title-section">
            <p className="eyebrow">ParaPal</p>
            <h1 className="top-title">Essay Grader</h1>
            {authedUser && <p className="muted">Signed in as {authedUser}</p>}
          </div>
          {authedUser ? (
            <div className="header-actions">
              <nav className="header-tabs">
                <button
                  className={`tab-btn ${activeScreen === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveScreen('chat')}
                >
                  Chat & Grade
                </button>
                <button
                  className={`tab-btn ${activeScreen === 'rubrics' ? 'active' : ''}`}
                  onClick={() => setActiveScreen('rubrics')}
                >
                  Standards & Rubrics
                </button>
              </nav>
              <button className="logout-btn" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          ) : (
            <button className="signin-btn" onClick={() => setNavOpen(true)}>
              Log In or Sign Up
            </button>
          )}
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
              uploadedContent={uploadedRubricContent}
              onClearUploadedContent={() => setUploadedRubricContent('')}
            />
          ) : (
            <ChatWorkspace
              rubrics={rubrics}
              messages={messages}
              selectedRubricId={selectedRubricId}
              onRubricChange={setSelectedRubricId}
              gradeOptions={gradeOptions}
              selectedGrade={selectedGrade}
              onGradeChange={setSelectedGrade}
              strandOptions={strandOptions}
              onToggleStrand={handleToggleStrand}
              onToggleStandard={handleToggleStandard}
              selectedStandardsCount={selectedStandardsCount}
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
            <AuthPanel onAuthChange={handleAuthChange} isLoggedIn={authedUser !== null} />
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
  uploadedContent,
  onClearUploadedContent,
}: {
  rubrics: Rubric[]
  onAddRubric: (rubric: Rubric) => void
  onDelete: (id: string) => void
  onUploadFile: (file: File | undefined | null) => void
  status: string
  uploadedContent: string
  onClearUploadedContent: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleCreate = () => {
    // Validate all required fields
    if (!name.trim() || !description.trim() || !uploadedContent.trim()) {
      const missingFields = []
      if (!name.trim()) missingFields.push('name')
      if (!description.trim()) missingFields.push('description')
      if (!uploadedContent.trim()) missingFields.push('content')
      
      setValidationError(`Please provide: ${missingFields.join(', ')}`)
      setTimeout(() => setValidationError(''), 3000)
      return
    }
    
    const newRubric: Rubric = {
      id: `rubric-${crypto.randomUUID()}`,
      name,
      description,
      content: uploadedContent,
      criteria: [],
    }
    onAddRubric(newRubric)
    setName('')
    setDescription('')
    onClearUploadedContent()
    setValidationError('')
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
        <p className="status">
          {validationError || 'Stored locally until backend wiring is ready.'}
        </p>
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
  gradeOptions,
  selectedGrade,
  onGradeChange,
  strandOptions,
  onToggleStrand,
  onToggleStandard,
  selectedStandardsCount,
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
  gradeOptions: GradeOption[]
  selectedGrade: string
  onGradeChange: (value: string) => void
  strandOptions: StrandWithSelection[]
  onToggleStrand: (strand: string) => void
  onToggleStandard: (strand: string, code: string) => void
  selectedStandardsCount: number
  essayFile: File | null
  onEssayUpload: (file: File | undefined | null) => void
  onSend: () => void
  isSending: boolean
  essayText: string
  essayStatus: string
}) {
  const selectedRubric = rubrics.find((r) => r.id === selectedRubricId) || rubrics[0]
  const [standardsOpen, setStandardsOpen] = useState(true)
  const [rubricOpen, setRubricOpen] = useState(true)

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>Chat & Grade</h2>
      </div>
      <div className="chat-grid">
        <div className="chat-shell">
          <MessageList messages={messages} />
        </div>

        <div className="panel side-panel">
          <div className="panel-header collapsible-header">
            <button
              className="collapse-toggle"
              type="button"
              aria-expanded={standardsOpen}
              onClick={() => setStandardsOpen((open) => !open)}
            >
              <div className="collapse-left">
                <span className="title">Standards</span>
                <div className="badge">
                  {selectedStandardsCount}{' '}
                  {selectedStandardsCount === 1 ? 'standard selected' : 'standards selected'}
                </div>
              </div>
              <span className={`chevron ${standardsOpen ? 'open' : ''}`} aria-hidden="true">
                ▾
              </span>
            </button>
          </div>
          {standardsOpen && (
            <div className="collapse-body">
              <div className="input-group">
                <label>Grade (K-12)</label>
                <select
                  className="input"
                  value={selectedGrade}
                  onChange={(e) => onGradeChange(e.target.value)}
                >
                  {gradeOptions.map((grade) => (
                    <option key={grade.value} value={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
                <div className="status">Pick a grade to load its strands and standards.</div>
              </div>
              <div className="standards-box">
                {strandOptions.length ? (
                  strandOptions.map((strand) => (
                    <div key={strand.strand} className="strand-card">
                      <div className="strand-header">
                        <label className="strand-toggle">
                          <input
                            type="checkbox"
                            checked={strand.checked}
                            onChange={() => onToggleStrand(strand.strand)}
                          />
                          <div>
                            <div className="strand-name">
                              {strandLabels[strand.strand] ?? strand.strand}
                              <span className="strand-code">{strand.strand}</span>
                            </div>
                            <div className="status">
                              {strand.checked
                                ? 'All checked standards below will be sent.'
                                : 'Check to include this strand, then deselect any standards you do not need.'}
                            </div>
                          </div>
                        </label>
                        <span className="pill secondary">{strand.standards.length} standards</span>
                      </div>
                      <div className="standard-list">
                        {strand.standards.map((std) => (
                          <label
                            key={std.code}
                            className={`standard-item ${strand.checked ? '' : 'disabled'}`}
                          >
                            <input
                              type="checkbox"
                              disabled={!strand.checked}
                              checked={strand.checked && std.checked}
                              onChange={() => onToggleStandard(strand.strand, std.code)}
                            />
                            <div>
                              <div className="standard-code">{std.code}</div>
                              <div className="standard-description">{std.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No standards available for this grade.</p>
                )}
              </div>
            </div>
          )}

          <div className="panel-header section-divider collapsible-header">
            <button
              className="collapse-toggle"
              type="button"
              aria-expanded={rubricOpen}
              onClick={() => setRubricOpen((open) => !open)}
            >
              <div className="collapse-left">
                <span className="title">Rubric</span>
                <div className="badge">Rubrics {rubrics.length}</div>
              </div>
              <span className={`chevron ${rubricOpen ? 'open' : ''}`} aria-hidden="true">
                ▾
              </span>
            </button>
          </div>
          {rubricOpen && (
            <div className="collapse-body">
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
                  Tip: switch rubrics without losing your chat history. The selected rubric will be
                  sent with the essay to the AI grader.
                </div>
              </div>
            </div>
          )}
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
