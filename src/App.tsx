import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'

type Screen =
  | 'welcome'
  | 'signin'
  | 'otp'
  | 'loading-verify'
  | 'success'
  | 'setup'
  | 'dashboard'

interface UserData {
  email: string
  name: string
  hostelBlock: string
  room: string
}

// IIMB email addresses come in two forms: "firstname.lastname26@iimb.ac.in"
// (dotted) or "firstnamel26@iimb.ac.in" (first name + last initial + batch
// year, no separator). We can reliably recover the first name from the
// dotted form; for the undotted form we can only strip the trailing batch
// digits, which leaves the last initial stuck on (e.g. "anjalik26" ->
// "Anjalik"). That's an approximation, not a real name -- good enough for a
// greeting, not for anything that needs the actual full name.
function deriveDisplayName(email: string): string {
  const local = email.split('@')[0] ?? ''
  const base = local.includes('.') ? local.split('.')[0] : local.replace(/\d+$/, '')
  const cleaned = base || 'Student'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

// ─── Shared Layout ───────────────────────────────────────────────────────────

function MobileShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)' }}>
      <div
        className={`w-full max-w-sm relative overflow-hidden ${className}`}
        style={{ minHeight: '100svh', maxHeight: '900px' }}
      >
        {children}
      </div>
    </div>
  )
}

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: 'var(--primary)',
          width: size === 'lg' ? 44 : size === 'md' ? 36 : 28,
          height: size === 'lg' ? 44 : size === 'md' ? 36 : 28,
        }}
      >
        <svg
          width={size === 'lg' ? 22 : size === 'md' ? 18 : 14}
          height={size === 'lg' ? 22 : size === 'md' ? 18 : 14}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" fill="white" fillOpacity="0.25" />
          <path d="M3 9l9-6 9 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="9" y="13" width="6" height="8" rx="1" fill="white" />
          <path d="M9 13h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span
        className={`font-extrabold tracking-tight ${sizes[size]}`}
        style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
      >
        SmartDrop
      </span>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex items-center justify-center gap-2 font-semibold text-base rounded-2xl transition-all duration-200 ${className}`}
      style={{
        background: disabled || loading ? '#94a3b8' : 'var(--primary)',
        color: 'white',
        padding: '16px 24px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transform: 'translateY(0)',
        boxShadow: disabled || loading ? 'none' : '0 4px 20px rgba(31,56,100,0.28)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.01em',
      }}
      onMouseEnter={e => { if (!disabled && !loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
    >
      {loading && (
        <svg
          className="shrink-0"
          style={{ animation: 'spin 0.8s linear infinite' }}
          width="18" height="18" viewBox="0 0 24 24" fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

function AccentButton({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 font-semibold text-base rounded-2xl transition-all duration-200 ${className}`}
      style={{
        background: disabled ? '#e2e8f0' : 'var(--accent)',
        color: disabled ? '#94a3b8' : 'white',
        padding: '16px 24px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 4px 20px rgba(14,124,123,0.3)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </button>
  )
}

// ─── Screen 1: Welcome ───────────────────────────────────────────────────────

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <MobileShell>
      <div className="flex flex-col min-h-screen" style={{ minHeight: '100svh' }}>
        {/* Top decorative band */}
        <div
          className="w-full"
          style={{
            height: 220,
            background: 'linear-gradient(145deg, #1F3864 0%, #16305a 60%, #0E7C7B 100%)',
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
          }}
        >
          <div className="flex flex-col items-center pt-14 pb-8 px-6">
            {/* Package illustration */}
            <div className="animate-fade-up">
              <div
                className="relative flex items-center justify-center rounded-2xl"
                style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
              >
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <rect x="6" y="14" width="32" height="24" rx="3" fill="white" fillOpacity="0.9" />
                  <path d="M6 20h32" stroke="#1F3864" strokeWidth="2" />
                  <path d="M18 14l2-6h4l2 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M17 20v18" stroke="#1F3864" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M27 20v18" stroke="#1F3864" strokeWidth="1.5" strokeDasharray="3 3" />
                  <circle cx="33" cy="8" r="5" fill="#0E7C7B" />
                  <path d="M30.5 8l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Pulsing ring */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    animation: 'pulse-ring 2s ease-out infinite',
                    border: '2px solid rgba(255,255,255,0.4)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
          <div className="animate-fade-up-delay-1 mb-1">
            <Logo size="md" />
          </div>

          <div className="mt-6 animate-fade-up-delay-2">
            <h1
              className="text-[2rem] font-extrabold leading-tight tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
            >
              Never lose track of a package again.
            </h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              No more searching through paper registers or missing OTP calls from hostel reception.
            </p>
          </div>

          {/* Feature pills */}
          <div className="mt-8 flex flex-col gap-3 animate-fade-up-delay-3">
            {[
              { icon: '📦', text: 'Instant arrival notifications' },
              { icon: '🔒', text: 'Secure OTP-based pickup' },
              { icon: '📍', text: 'Block-level package tracking' },
            ].map(item => (
              <div
                key={item.text}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <div className="animate-fade-up-delay-4 space-y-3">
            <PrimaryButton onClick={onNext}>
              Sign in with IIMB email
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </PrimaryButton>
            <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Only for students with an <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@iimb.ac.in</span> email
            </p>
          </div>
        </div>
      </div>
    </MobileShell>
  )
}

// ─── Screen 2: Sign-in ────────────────────────────────────────────────────────

function SignInScreen({ onNext, userData, setUserData }: {
  onNext: () => void
  userData: UserData
  setUserData: React.Dispatch<React.SetStateAction<UserData>>
}) {
  const [email, setEmail] = useState(userData.email)
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const isValidEmail = (v: string) => /^[a-zA-Z0-9._%+-]+@iimb\.ac\.in$/.test(v.trim())
  const hasTyped = email.length > 0
  const showError = touched && hasTyped && !isValidEmail(email)

  async function handleSubmit() {
    setTouched(true)
    setAuthError('')
    if (!isValidEmail(email)) return
    setLoading(true)
    const trimmed = email.trim()
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    setUserData(d => ({ ...d, email: trimmed }))
    onNext()
  }

  return (
    <MobileShell>
      <div className="flex flex-col min-h-screen px-6 pt-14 pb-8" style={{ minHeight: '100svh' }}>
        <div className="animate-fade-up">
          <Logo size="sm" />
        </div>

        <div className="mt-10 animate-fade-up-delay-1">
          <h2
            className="text-[1.75rem] font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
          >
            Sign in to<br />SmartDrop
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            We'll send a one-time code to your IIMB email.
          </p>
        </div>

        <div className="mt-10 animate-fade-up-delay-2">
          <label
            className="block text-sm font-semibold mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            Institute email address
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setTouched(false) }}
              onBlur={() => setTouched(true)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="priya.nair@iimb.ac.in"
              autoFocus
              className="w-full text-base outline-none transition-all duration-200"
              style={{
                padding: '16px 16px 16px 48px',
                borderRadius: 'var(--radius)',
                border: showError
                  ? '2px solid #ef4444'
                  : email && isValidEmail(email)
                  ? '2px solid var(--accent)'
                  : '2px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
              }}
            />
            {/* Mail icon */}
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2"
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              style={{ color: showError ? '#ef4444' : email && isValidEmail(email) ? 'var(--accent)' : 'var(--muted-foreground)' }}
            >
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {/* Checkmark if valid */}
            {email && isValidEmail(email) && (
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 animate-fade-in" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="var(--accent)" />
                <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {showError && (
            <div className="mt-2 flex items-center gap-1.5 animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ef4444" />
                <path d="M12 7v5M12 16v1" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
                Please use your @iimb.ac.in email address
              </p>
            </div>
          )}

          {authError && (
            <div className="mt-2 flex items-center gap-1.5 animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ef4444" />
                <path d="M12 7v5M12 16v1" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{authError}</p>
            </div>
          )}
        </div>

        <div className="mt-6 animate-fade-up-delay-3">
          <PrimaryButton
            onClick={handleSubmit}
            disabled={!email}
            loading={loading}
          >
            {loading ? 'Sending OTP…' : 'Send OTP'}
          </PrimaryButton>
        </div>

        <div className="flex-1" />

        <div className="text-center animate-fade-up-delay-4">
          <button
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Need help? Contact{' '}
            <span style={{ color: 'var(--accent)' }}>hostel-support@iimb.ac.in</span>
          </button>
        </div>
      </div>
    </MobileShell>
  )
}

// ─── Screen 3: OTP Verification ──────────────────────────────────────────────

const OTP_LENGTH = 6

function OTPScreen({ onNext, onBack, userData }: {
  onNext: () => void
  onBack: () => void
  userData: UserData
}) {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  function handleInput(i: number, val: string) {
    const ch = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = ch
    setOtp(next)
    setError('')
    if (ch && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus()
    if (next.every(v => v)) verify(next.join(''))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (text.length === OTP_LENGTH) {
      const next = text.split('')
      setOtp(next)
      setError('')
      inputRefs.current[OTP_LENGTH - 1]?.focus()
      verify(text)
    }
  }

  async function verify(code: string) {
    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: userData.email,
      token: code,
      type: 'email',
    })
    setLoading(false)
    if (verifyError) {
      setError(verifyError.message)
      setOtp(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      return
    }
    onNext()
  }

  async function resend() {
    if (!canResend) return
    setCountdown(30)
    setCanResend(false)
    setOtp(Array(OTP_LENGTH).fill(''))
    setError('')
    inputRefs.current[0]?.focus()
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: userData.email,
      options: { shouldCreateUser: false },
    })
    if (resendError) setError(resendError.message)
  }

  const filled = otp.filter(Boolean).length

  return (
    <MobileShell>
      <div className="flex flex-col min-h-screen px-6 pt-14 pb-8" style={{ minHeight: '100svh' }}>
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium mb-8 self-start transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <div className="animate-fade-up">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(14,124,123,0.1)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="var(--accent)" strokeWidth="1.8" />
              <path d="M2 8l10 6 10-6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h2
            className="text-[1.75rem] font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
          >
            Check your email
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            We sent a 6-digit code to<br />
            <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{userData.email || 'your IIMB email'}</span>
          </p>
        </div>

        {/* OTP boxes */}
        <div className="mt-10 animate-fade-up-delay-1">
          <div className="flex gap-2 justify-between" onPaste={handlePaste}>
            {otp.map((val, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={val}
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
                className="text-center text-xl font-bold outline-none transition-all duration-150"
                style={{
                  width: 44,
                  height: 56,
                  borderRadius: 12,
                  border: error
                    ? '2px solid #ef4444'
                    : val
                    ? '2px solid var(--accent)'
                    : '2px solid var(--border)',
                  background: val ? 'rgba(14,124,123,0.06)' : 'var(--card)',
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                }}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-1.5 animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ef4444" />
                <path d="M12 7v5M12 16v1" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Loading bar */}
          {loading && (
            <div className="mt-4 animate-fade-in">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'var(--accent)',
                    width: '100%',
                    animation: 'pulse 1s ease-in-out infinite',
                    opacity: 0.7,
                  }}
                />
              </div>
              <p className="text-xs text-center mt-2" style={{ color: 'var(--muted-foreground)' }}>
                Verifying…
              </p>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        <div className="mt-6 animate-fade-up-delay-2">
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ background: 'var(--accent)', width: `${(filled / OTP_LENGTH) * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)', minWidth: 32 }}>
              {filled}/{OTP_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Countdown / Resend */}
        <div className="text-center animate-fade-up-delay-3">
          {canResend ? (
            <button
              onClick={resend}
              className="text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              Resend OTP
            </button>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Resend code in{' '}
              <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                {countdown}s
              </span>
            </p>
          )}
        </div>
      </div>
    </MobileShell>
  )
}

// ─── Screen 4: Success / Reward ───────────────────────────────────────────────

function SuccessScreen({ onNext, userData }: { onNext: () => void; userData: UserData }) {
  const displayName = deriveDisplayName(userData.email)

  return (
    <MobileShell>
      <div className="flex flex-col min-h-screen px-6 pt-14 pb-8 items-center text-center" style={{ minHeight: '100svh' }}>
        {/* Success mark */}
        <div className="animate-bounce-in mt-8">
          <div className="relative w-24 h-24 mx-auto">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(14,124,123,0.15) 0%, transparent 70%)',
                animation: 'pulse-ring 2s ease-out infinite',
              }}
            />
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center relative z-10"
              style={{ background: 'linear-gradient(135deg, #0E7C7B 0%, #1F3864 100%)' }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path
                  d="M10 20l7 7 13-14"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-8 animate-fade-up-delay-1">
          <h2
            className="text-[2rem] font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
          >
            You're in, {displayName}! 🎉
          </h2>
          <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Your IIMB email is verified and your account is ready.
          </p>
        </div>

        {/* Social proof card */}
        <div
          className="mt-8 w-full rounded-2xl p-5 text-left animate-fade-up-delay-2"
          style={{
            background: 'linear-gradient(135deg, rgba(31,56,100,0.06) 0%, rgba(14,124,123,0.06) 100%)',
            border: '1px solid rgba(14,124,123,0.2)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'var(--accent)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="1.8" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                347 students already enrolled
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                SmartDrop is already tracking deliveries across all hostel blocks — you're in good company.
              </p>
            </div>
          </div>
          <div
            className="mt-4 pt-4 grid grid-cols-3 gap-3"
            style={{ borderTop: '1px solid rgba(14,124,123,0.15)' }}
          >
            {[
              { num: '2,400+', label: 'Packages tracked' },
              { num: '0', label: 'Lost packages' },
              { num: '< 2 min', label: 'Avg pickup time' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="font-extrabold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                  {s.num}
                </div>
                <div className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <div className="w-full animate-fade-up-delay-3">
          <AccentButton onClick={onNext}>
            Set up my hostel room
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </AccentButton>
          <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Takes about 30 seconds — just one more step
          </p>
        </div>
      </div>
    </MobileShell>
  )
}

// ─── Screen 5: Hostel Setup ──────────────────────────────────────────────────

const HOSTEL_BLOCKS = [
  'Block A — Cauvery',
  'Block B — Krishna',
  'Block C — Ganga',
  'Block D — Godavari',
  'Block E — Narmada',
  'Block F — Sindhu',
]

function SetupScreen({ onNext, userData, setUserData }: {
  onNext: () => void
  userData: UserData
  setUserData: React.Dispatch<React.SetStateAction<UserData>>
}) {
  const [block, setBlock] = useState(userData.hostelBlock)
  const [room, setRoom] = useState(userData.room)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  const isComplete = block && room.trim()

  async function handleSubmit() {
    if (!isComplete) return
    setLoading(true)
    setSaveError('')

    // No dedicated "name" field in this flow yet -- derive a display name
    // from the email prefix, same as the Success/Dashboard screens.
    const fullName = deriveDisplayName(userData.email)

    const { error } = await supabase.rpc('complete_onboarding', {
      p_full_name: fullName,
      p_hostel_block: block,
      p_room: room.trim(),
    })
    setLoading(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setUserData(d => ({ ...d, hostelBlock: block, room: room.trim(), name: fullName }))
    onNext()
  }

  return (
    <MobileShell>
      <div className="flex flex-col min-h-screen px-6 pt-14 pb-8" style={{ minHeight: '100svh' }}>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 animate-fade-up">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className="rounded-full transition-all duration-300"
                style={{
                  width: step === 3 ? 20 : 8,
                  height: 8,
                  background: step === 3 ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Final step</span>
        </div>

        <div className="animate-fade-up-delay-1">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(31,56,100,0.08)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" stroke="var(--primary)" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 22V12h6v10" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2
            className="text-[1.75rem] font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
          >
            Your hostel block<br />&amp; room
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            So we can match packages to the right block and notify you the moment one arrives at reception.
          </p>
        </div>

        <div className="mt-8 space-y-5 animate-fade-up-delay-2">
          {/* Block selector */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Hostel block
            </label>
            <div className="relative">
              <select
                value={block}
                onChange={e => setBlock(e.target.value)}
                className="w-full appearance-none text-base outline-none transition-all duration-200"
                style={{
                  padding: '15px 44px 15px 16px',
                  borderRadius: 'var(--radius)',
                  border: block ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: 'var(--card)',
                  color: block ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                }}
              >
                <option value="">Select your block</option>
                {HOSTEL_BLOCKS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <svg
                className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                width="16" height="16" viewBox="0 0 16 16" fill="none"
              >
                <path d="M4 6l4 4 4-4" stroke="var(--muted-foreground)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Room number */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Room / floor number
            </label>
            <input
              type="text"
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="e.g. 214 or Floor 2 / 14"
              className="w-full text-base outline-none transition-all duration-200"
              style={{
                padding: '15px 16px',
                borderRadius: 'var(--radius)',
                border: room.trim() ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {/* Preview card */}
          {block && room && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3 animate-fade-in"
              style={{ background: 'rgba(14,124,123,0.06)', border: '1.5px solid rgba(14,124,123,0.2)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="10" r="3" stroke="var(--accent)" strokeWidth="1.8" />
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="var(--accent)" strokeWidth="1.8" />
              </svg>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Your delivery address</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--foreground)' }}>
                  {block.split(' — ')[1] || block}, Room {room}
                </p>
              </div>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ef4444" />
                <path d="M12 7v5M12 16v1" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{saveError}</p>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="animate-fade-up-delay-3">
          <PrimaryButton onClick={handleSubmit} disabled={!isComplete} loading={loading}>
            {loading ? 'Setting up…' : 'Finish setup'}
          </PrimaryButton>
        </div>
      </div>
    </MobileShell>
  )
}

// ─── Screen 6: Dashboard (Empty State) ──────────────────────────────────────

function DashboardScreen({ userData }: { userData: UserData }) {
  const displayName = userData.name || deriveDisplayName(userData.email)
  const shortBlock = userData.hostelBlock.split(' — ')[1] || userData.hostelBlock

  return (
    <MobileShell>
      <div className="flex flex-col min-h-screen pb-8" style={{ minHeight: '100svh' }}>
        {/* Header */}
        <div
          className="px-6 pt-14 pb-6"
          style={{ background: 'var(--primary)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <Logo size="sm" />
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                fontFamily: 'var(--font-display)',
              }}
            >
              {displayName.charAt(0)}
            </div>
          </div>
          <div className="animate-fade-up">
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Good morning,
            </p>
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'white' }}
            >
              {displayName} 👋
            </h1>
          </div>

          {/* Location chip */}
          <div
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 animate-fade-up-delay-1"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="10" r="3" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {shortBlock}, Room {userData.room}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 pt-6 space-y-4">
          {/* Status bar */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3 animate-fade-up"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(14,124,123,0.1)' }}
            >
              {/* Pulse dot */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-5 h-5 rounded-full"
                  style={{ background: 'rgba(14,124,123,0.3)', animation: 'pulse-ring 1.8s ease-out infinite' }}
                />
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)' }} />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>SmartDrop is active</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Monitoring {shortBlock} reception — ready and waiting
              </p>
            </div>
          </div>

          {/* Empty state — main card */}
          <div
            className="rounded-3xl p-6 flex flex-col items-center text-center animate-fade-up-delay-1"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(31,56,100,0.06) 0%, rgba(14,124,123,0.08) 100%)' }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="8" y="14" width="24" height="18" rx="2.5" fill="none" stroke="var(--border)" strokeWidth="2" />
                <path d="M8 20h24" stroke="var(--border)" strokeWidth="2" />
                <path d="M16 14l2-5h4l2 5" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
                {/* Plus icon */}
                <circle cx="30" cy="30" r="8" fill="var(--background)" />
                <circle cx="30" cy="30" r="7" fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" />
                <path d="M27 30h6M30 27v6" stroke="var(--muted-foreground)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h3
              className="text-lg font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
            >
              No packages yet
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              The moment a package arrives at {shortBlock} reception, you'll get an instant notification — no need to check manually.
            </p>
            <div
              className="mt-5 w-full rounded-xl px-4 py-3 flex items-center gap-2"
              style={{ background: 'rgba(14,124,123,0.07)', border: '1px dashed rgba(14,124,123,0.3)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                Notifications are on for {shortBlock}
              </p>
            </div>
          </div>

          {/* Recent activity placeholder */}
          <div className="animate-fade-up-delay-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
              How it works
            </p>
            <div className="space-y-2">
              {[
                { icon: '📬', title: 'Package arrives', desc: 'Reception logs it in SmartDrop' },
                { icon: '🔔', title: 'You get notified', desc: 'Push notification + email to your IIMB ID' },
                { icon: '📦', title: 'Pick up with OTP', desc: 'Show your OTP at reception, done.' },
              ].map((step, i) => (
                <div
                  key={step.title}
                  className="flex items-start gap-3 rounded-2xl p-3.5"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <span className="text-lg leading-none">{step.icon}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{step.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div
          className="mx-6 mt-6 rounded-2xl grid grid-cols-3 animate-fade-up-delay-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '4px' }}
        >
          {[
            { icon: '📦', label: 'Packages', active: true },
            { icon: '🔔', label: 'Alerts', active: false },
            { icon: '👤', label: 'Profile', active: false },
          ].map(tab => (
            <button
              key={tab.label}
              className="flex flex-col items-center gap-1 rounded-xl py-2.5 transition-colors duration-150"
              style={{
                background: tab.active ? 'var(--primary)' : 'transparent',
              }}
            >
              <span className="text-base">{tab.icon}</span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: tab.active ? 'white' : 'var(--muted-foreground)' }}
              >
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </MobileShell>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [checkingSession, setCheckingSession] = useState(true)
  const [userData, setUserData] = useState<UserData>({
    email: '',
    name: '',
    hostelBlock: '',
    room: '',
  })

  const go = useCallback((s: Screen) => setScreen(s), [])

  // On load, resume an existing session instead of forcing a signed-in user
  // back through sign-in/OTP on every refresh.
  useEffect(() => {
    let active = true
    async function restoreSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) {
        setCheckingSession(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, hostel_block, room, onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return
      setUserData(d => ({
        ...d,
        email: session.user.email ?? '',
        name: profile?.full_name ?? '',
        hostelBlock: profile?.hostel_block ?? '',
        room: profile?.room ?? '',
      }))
      setScreen(profile?.onboarding_completed ? 'dashboard' : 'setup')
      setCheckingSession(false)
    }
    restoreSession()
    return () => { active = false }
  }, [])

  if (checkingSession) {
    return (
      <MobileShell>
        <div className="flex items-center justify-center" style={{ minHeight: '100svh' }}>
          <Logo size="md" />
        </div>
      </MobileShell>
    )
  }

  return (
    <div key={screen}>
      {screen === 'welcome' && (
        <WelcomeScreen onNext={() => go('signin')} />
      )}
      {screen === 'signin' && (
        <SignInScreen
          onNext={() => go('otp')}
          userData={userData}
          setUserData={setUserData}
        />
      )}
      {screen === 'otp' && (
        <OTPScreen
          onNext={() => go('success')}
          onBack={() => go('signin')}
          userData={userData}
        />
      )}
      {screen === 'success' && (
        <SuccessScreen
          onNext={() => go('setup')}
          userData={userData}
        />
      )}
      {screen === 'setup' && (
        <SetupScreen
          onNext={() => go('dashboard')}
          userData={userData}
          setUserData={setUserData}
        />
      )}
      {screen === 'dashboard' && (
        <DashboardScreen userData={userData} />
      )}
    </div>
  )
}
