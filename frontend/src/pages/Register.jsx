import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import api from '../services/api'
import { formatApiError } from '../utils/errorFormatter'

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    const usernameRegex = /^[A-Za-z0-9_]+$/
    if (!usernameRegex.test(formData.username)) {
      setError('Username can only contain alphanumeric characters and underscores')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password
      })
      
      // Auto login: FastAPI OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
      const loginParams = new URLSearchParams()
      loginParams.append('username', formData.email)
      loginParams.append('password', formData.password)
      
      const loginResponse = await api.post('/auth/login', loginParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      
      localStorage.setItem('token', loginResponse.data.access_token)
      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="theme-page min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="theme-card w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-8 relative overflow-hidden transition-all duration-300">
          {/* Decorative background shapes */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-violet-500/10 rounded-full blur-xl pointer-events-none"></div>

          <div className="text-center mb-8 relative z-10">
            <h2 className="text-3xl font-extrabold text-slate-950 dark:text-white">
              Create an Account
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Join EquipShare to borrow and lend college equipment
            </p>
          </div>

          {error && (
            <div className="theme-alert-error mb-6 p-4 rounded-xl border text-sm font-semibold animate-shake">
              {error}
            </div>
          )}

          {success && (
            <div className="theme-alert-success mb-6 p-4 rounded-xl border text-sm font-semibold">
              Registration successful! Redirecting to explore...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                disabled={loading || success}
                placeholder="John Doe"
                className="theme-input w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                disabled={loading || success}
                placeholder="johndoe123"
                className="theme-input w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading || success}
                placeholder="your.email@college.edu"
                className="theme-input w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password (min 8 chars)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading || success}
                placeholder="••••••••"
                className="theme-input w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading || success}
                placeholder="••••••••"
                className="theme-input w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="theme-primary-button w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm font-medium relative z-10">
            <span className="text-slate-500 dark:text-slate-400">Already have an account? </span>
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Register
