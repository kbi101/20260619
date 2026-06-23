import React, { useState } from 'react'

interface LoginScreenProps {
  onLoginInitiated: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginInitiated }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('paper')
  const [isInitiating, setIsInitiating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsInitiating(true)

    try {
      const response = await fetch('http://localhost:8080/api/ibkr/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, mode }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to initiate login')
      }

      onLoginInitiated()
    } catch (err: any) {
      console.error('[LoginScreen] Login error:', err)
      setError(err.message || 'An unexpected error occurred.')
      setIsInitiating(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">QuantStation</h1>
          <p className="login-subtitle">Connect to Interactive Brokers Gateway to start trading</p>
        </div>

        {!isInitiating ? (
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}

            <div className="order-entry__field">
              <label className="order-entry__label">Username</label>
              <input
                type="text"
                className="login-input"
                placeholder="IBKR Login ID"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="order-entry__field">
              <label className="order-entry__label">Password</label>
              <input
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="order-entry__field login-form__full">
              <label className="order-entry__label">Trading Mode</label>
              <select
                className="login-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="paper">Paper Trading (Simulated — Port 4002)</option>
                <option value="live">Live Trading (Real Account — Port 4001)</option>
              </select>
            </div>

            <button type="submit" className="login-button">
              Log In to IBKR
            </button>
          </form>
        ) : (
          <div className="login-mfa-container">
            <div className="login-spinner-container">
              <div className="login-spinner" />
              <span>Restarting Gateway & Initiating Login...</span>
            </div>

            <div className="login-alert">
              <span className="login-alert__title">MFA / 2FA Verification Required</span>
              <span>
                Please check your phone for an **IBKR Mobile App (IB Key) Push Notification** and tap **Approve**. 
                You can monitor the live login progress in the terminal display below.
              </span>
            </div>

            <div className="novnc-wrapper">
              <iframe
                src="http://localhost:6080/?password=quantstation&autoconnect=1&resize=scale"
                className="novnc-frame"
                title="IBKR Gateway Desktop"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
