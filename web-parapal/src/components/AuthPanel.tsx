// src/components/AuthPanel.tsx
import { useEffect, useState } from 'react'
import {
  registerUser,
  confirmUser,
  loginUser,
  logoutUser,
  getCurrentCognitoUser,
} from '../auth'

type AuthMode = 'login' | 'signup'

type AuthPanelProps = {
  // App can listen when login/logout happens
  onAuthChange?: (email: string | null) => void
}

export default function AuthPanel({ onAuthChange }: AuthPanelProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // after sign-up, Cognito may require a confirmation code
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  // On mount, check if we already have a session
  useEffect(() => {
    ;(async () => {
      const user = await getCurrentCognitoUser()
      if (user) {
        setCurrentUserEmail(user.email)
        onAuthChange?.(user.email)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetMessages = () => {
    setMessage(null)
    setError(null)
  }

  const handleModeChange = (mode: AuthMode) => {
    resetMessages()
    setAuthMode(mode)
    setNeedsConfirmation(false)
    setCode('')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const res = await registerUser(email, password)
      // Most setups require a confirmation code
      if (res.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setNeedsConfirmation(true)
        setMessage('Check your email for the verification code.')
      } else {
        setMessage('Account created. You can now log in.')
        setNeedsConfirmation(false)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      await confirmUser(email, code)
      setMessage('Account confirmed. You can now log in.')
      setNeedsConfirmation(false)
      setAuthMode('login')
      setCode('')
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Confirmation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      await loginUser(email, password)
      const user = await getCurrentCognitoUser()
      if (user) {
        setCurrentUserEmail(user.email)
        onAuthChange?.(user.email)
        setMessage('Logged in successfully.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    resetMessages()
    setLoading(true)
    try {
      await logoutUser()
      setCurrentUserEmail(null)
      onAuthChange?.(null)
      setMessage('Logged out.')
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Logout failed')
    } finally {
      setLoading(false)
    }
  }

  // ---------- RENDER ----------

  return (
    <div className="auth-panel">
      <h3>Account</h3>

      {currentUserEmail ? (
        // Logged-in view
        <>
          <p className="muted">
            You&apos;re signed in as <strong>{currentUserEmail}</strong>
          </p>
          <button className="button" onClick={handleLogout} disabled={loading}>
            {loading ? 'Signing out...' : 'Log out'}
          </button>
        </>
      ) : (
        // Logged-out view
        <>
          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => handleModeChange('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => handleModeChange('signup')}
            >
              Sign up
            </button>
          </div>

          {/* Email + password are shared between both modes */}
          <form
            onSubmit={
              authMode === 'login'
                ? handleLogin
                : needsConfirmation
                ? handleConfirm
                : handleSignup
            }
          >
            <div className="input-group">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {authMode === 'signup' && needsConfirmation && (
              <div className="input-group">
                <label>Verification code</label>
                <input
                  className="input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
            )}

            <button className="button" type="submit" disabled={loading}>
              {loading
                ? 'Working...'
                : authMode === 'login'
                ? 'Log in'
                : needsConfirmation
                ? 'Confirm code'
                : 'Create account'}
            </button>
          </form>
        </>
      )}

      {message && <p className="status" style={{ color: 'var(--accent, #0a7)' }}>{message}</p>}
      {error && <p className="status" style={{ color: 'var(--error, #c00)' }}>{error}</p>}
    </div>
  )
}
