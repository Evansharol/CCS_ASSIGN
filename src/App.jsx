import { useState } from 'react'
import './App.css'

const API = 'http://localhost:4000/api'

function App() {
  const [page, setPage] = useState('register') // register | login | platform
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pwScore, setPwScore] = useState(0)
  const [pwFeedback, setPwFeedback] = useState('')
  const [status, setStatus] = useState('')
  const [otpPreview, setOtpPreview] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [crackResult, setCrackResult] = useState(null)
  const [useFastMode, setUseFastMode] = useState(true)

  async function doRegister(e) {
    e && e.preventDefault()
    // client-side validation
    const emailOk = validateEmail(email)
    if (!emailOk) { setStatus('Invalid email format'); return }
    if (pwScore < 2) { setStatus('Password too weak — choose a stronger password'); return }
    setStatus('Registering...')
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'register failed')
      setStatus(`Registered ${j.email}. You can now request an OTP via Login page.`)
      setPage('login')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  async function requestOtp(e) {
    e && e.preventDefault()
    setStatus('Requesting OTP...')
    setOtpPreview(null)
    try {
      const res = await fetch(`${API}/request-login-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'request failed')
      setOtpPreview(j.previewUrl || null)
      setStatus('OTP sent (preview url shown for dev). Enter the code to verify.')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  async function verifyOtp(e) {
    e && e.preventDefault()
    setStatus('Verifying OTP...')
    try {
      const res = await fetch(`${API}/verify-login-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'verify failed')
      setIsAuthenticated(true)
      setStatus('Login successful — you can now access the platform')
      setPage('platform')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  // password strength estimation (very lightweight)
  function scorePassword(pw) {
    if (!pw) return { score: 0, feedback: 'Empty' }
    let score = 0
    const length = pw.length
    if (length >= 8) score += 1
    if (length >= 12) score += 1

    const variations = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
    let variety = 0
    variations.forEach(rx => { if (rx.test(pw)) variety++ })
    if (variety >= 2) score += 1
    if (variety >= 3) score += 1

    // blacklist simple/common passwords
    const common = ['123456','password','qwerty','letmein','abc123','password1','admin','welcome']
    if (common.includes(pw.toLowerCase())) return { score: 0, feedback: 'Very common password — choose another' }

    let feedback = 'Weak'
    if (score >= 3) feedback = 'Strong'
    else if (score >= 2) feedback = 'Medium'
    return { score, feedback }
  }

  function onPasswordChange(val) {
    setPassword(val)
    const { score, feedback } = scorePassword(val)
    setPwScore(score)
    setPwFeedback(feedback)
  }

  function validateEmail(e) {
    if (!e) return false
    // simple email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  async function runCracker() {
    setCrackResult(null)
    setStatus('Running cracking simulation...')
    try {
      const res = await fetch(`${API}/simulate-crack`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, useFast: useFastMode })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'simulate failed')
      setCrackResult(j.result)
      setStatus(`Simulation complete (mode: ${j.mode || 'unknown'})`)
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  function logout() {
    setIsAuthenticated(false)
    setPage('login')
    setStatus('Logged out')
    setCrackResult(null)
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Authentication demo</h1>
        <div>
          <div className="intro">Email OTP flow for login — then access the platform which runs a safe cracking simulation for demo purposes.</div>
          <div style={{marginTop:8}}>
            <button onClick={() => setPage('register')} className={page==='register'?''+'':''+' secondary'} type="button">Register</button>
            <button onClick={() => setPage('login')} style={{marginLeft:8}} className={page==='login'?''+'':''+' secondary'} type="button">Login</button>
            <button onClick={() => setPage('platform')} style={{marginLeft:8}} className="secondary" type="button" disabled={!isAuthenticated}>Platform</button>
            {isAuthenticated && <button onClick={logout} style={{marginLeft:8}} type="button">Logout</button>}
          </div>
        </div>
      </div>

      <div className="grid">
        <div>
          {page === 'register' && (
            <section className="box">
              <h2>Register</h2>
              <div className="form-panel">
                <h3>Enter your details</h3>
                <form onSubmit={doRegister}>
                  <div className="input-row">
                    <div className="input-icon">👤</div>
                    <div className="input-field floating">
                      <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder=" " />
                      <label>Full name</label>
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-icon">✉️</div>
                    <div className="input-field floating">
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder=" " />
                      <label>Email address</label>
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-icon">🔒</div>
                    <div className="input-field floating">
                      <input type="password" value={password} onChange={e=>onPasswordChange(e.target.value)} placeholder=" " />
                      <label>Create password</label>
                    </div>
                  </div>

                  <div className="pw-meter">
                    <div className="bar">
                      <div className={`fill ${pwScore>=3? 'pw-strong' : pwScore>=2 ? 'pw-medium' : 'pw-weak'}`} style={{width: `${Math.min(100, pwScore*33)}%`}}></div>
                    </div>
                    <div className="pw-label">Strength: <strong>{pwFeedback}</strong></div>
                  </div>

                  <div className="actions-row">
                    <button type="submit">Create account</button>
                    <button type="button" className="secondary" onClick={()=>{ setName(''); setEmail(''); setPassword(''); setPwScore(0); setPwFeedback('') }}>Clear</button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {page === 'login' && (
            <section className="box">
              <h2>Login — request OTP</h2>
              <div className="form-panel">
                <h3>Enter your registered email</h3>
                <form onSubmit={requestOtp}>
                  <div className="input-row">
                    <div className="input-icon">✉️</div>
                    <div className="input-field floating">
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder=" " />
                      <label>Registered email</label>
                    </div>
                  </div>
                  <div className="actions-row">
                    <button type="submit">Send OTP</button>
                    <button type="button" className="secondary" onClick={()=>{ setEmail('') }}>Clear</button>
                  </div>
                </form>

                {otpPreview && (
                  <div style={{marginTop:12}}>
                    <p style={{margin:0,color:'var(--muted)'}}>DEV preview URL (use when testing locally):</p>
                    <a href={otpPreview} target="_blank" rel="noreferrer">Open email preview</a>
                  </div>
                )}

                <form onSubmit={verifyOtp} style={{marginTop:12}}>
                  <h3>Enter OTP</h3>
                  <div className="input-row">
                    <div className="input-icon">🔢</div>
                    <div className="input-field floating">
                      <input type="text" value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder=" " />
                      <label>OTP code</label>
                    </div>
                  </div>
                  <div className="actions-row">
                    <button type="submit">Verify OTP</button>
                    <button type="button" className="secondary" onClick={()=>setOtpCode('')}>Clear</button>
                  </div>
                </form>
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="box">
            <h2>Platform — Cracking Simulation</h2>
            <p style={{color:'var(--muted)'}}>Available after successful OTP verification.</p>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <label style={{color:'var(--muted)'}}>
                <input type="checkbox" checked={useFastMode} onChange={e=>setUseFastMode(e.target.checked)} /> Use fast demo mode (SHA-256) for cracking
              </label>
            </div>
            <button onClick={runCracker} disabled={!isAuthenticated} style={{marginTop:10}}>Run cracker against {email || 'your account'}</button>
            {crackResult && (
              <div className="result" style={{marginTop:12}}>
                <div className="pill">Found: <strong style={{marginLeft:8}}>{String(crackResult.found)}</strong></div>
                <div className="pill">Guess: <strong style={{marginLeft:8}}>{crackResult.guess || '—'}</strong></div>
                <div className="pill">Attempts: <strong style={{marginLeft:8}}>{crackResult.attempts}</strong></div>
                <div className="pill">Duration: <strong style={{marginLeft:8}}>{crackResult.durationMs} ms</strong></div>
              </div>
            )}

            <div style={{marginTop:18}}>
              <h3>Status</h3>
              <pre style={{marginTop:8}}>{status}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
