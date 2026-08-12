import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function Navbar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeAlerts, setActiveAlerts] = useState([])
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (token) {
      // Fetch user profile
      api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        const loggedUser = res.data
        setUser(loggedUser)

        // Check if notifications have been displayed for this session
        const sessionKey = `notif_shown_${loggedUser.id}`
        if (!sessionStorage.getItem(sessionKey)) {
          const collectedAlerts = []

          // Fetch incoming requests for product owners (status: pending)
          api.get('/rentals/incoming', {
            headers: { Authorization: `Bearer ${token}` }
          })
          .then(incomingRes => {
            const pendingCount = incomingRes.data.filter(r => r.status === 'pending').length
            if (pendingCount > 0) {
              collectedAlerts.push({
                id: 'incoming',
                type: 'incoming',
                message: `You have ${pendingCount} new pending equipment request${pendingCount > 1 ? 's' : ''} to review in your Dashboard.`
              })
              setActiveAlerts(prev => [...prev, ...collectedAlerts])
            }
          })
          .catch(console.error)

          // Fetch outgoing requests for buyers (status: accepted)
          api.get('/rentals/my-requests', {
            headers: { Authorization: `Bearer ${token}` }
          })
          .then(outgoingRes => {
            const acceptedList = outgoingRes.data.filter(r => r.status === 'accepted')
            if (acceptedList.length > 0) {
              const items = acceptedList.map(req => ({
                id: `accepted_${req.id}`,
                type: 'accepted',
                message: `Your request to rent/buy "${req.equipment?.name}" has been accepted!`
              }))
              setActiveAlerts(prev => [...prev, ...items])
            }
          })
          .catch(console.error)

          // Set session storage flag to prevent popping up on every navigation
          sessionStorage.setItem(sessionKey, 'true')
        }
      })
      .catch(() => {
        // Token might be expired
        localStorage.removeItem('token')
        setUser(null)
      })
    } else {
      setUser(null)
    }
  }, [token])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    navigate('/login')
  }

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-all duration-200">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-extrabold text-xl bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Equip<span className="text-indigo-600 dark:text-indigo-400">Share</span>
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-medium transition-colors">
              Explore
            </Link>
            
            {user ? (
              <>
                <Link to="/dashboard" className="text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-medium transition-colors">
                  Dashboard
                </Link>
                <div className="flex items-center gap-4 pl-4 border-l border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</span>
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link to="/login" className="text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-medium transition-colors">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-500/20"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 pt-2 pb-3 space-y-1 sm:px-3 animate-fade-in">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Explore
          </Link>
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Dashboard
              </Link>
              <div className="pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between">
                <div>
                  <div className="text-base font-medium text-slate-800 dark:text-white">{user.name}</div>
                  <div className="text-sm font-medium text-slate-500">{user.email}</div>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="px-3 py-1.5 text-sm font-semibold text-white bg-slate-900 dark:bg-indigo-600 rounded-lg"
                >
                  Log Out
                </button>
              </div>
            </>
          ) : (
            <div className="pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 px-3">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="block text-center px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="block text-center px-4 py-2 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Centered Premium Alert Modal */}
      {activeAlerts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-6 sm:p-8 max-w-md w-full animate-zoom-in text-center">
            {/* Alert Header Icon */}
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-5">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
              Updates for You
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Here are the latest updates regarding your equipment requests:
            </p>

            {/* List of Alerts */}
            <div className="space-y-3 max-h-60 overflow-y-auto mb-8 pr-1">
              {activeAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 ${
                    alert.type === 'incoming' 
                      ? 'bg-indigo-50/55 dark:bg-indigo-950/15 border-indigo-100 dark:border-indigo-900/30 text-indigo-950 dark:text-indigo-200' 
                      : 'bg-emerald-50/55 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 text-emerald-950 dark:text-emerald-200'
                  }`}
                >
                  <span className="mt-0.5">
                    {alert.type === 'incoming' ? (
                      <span className="flex h-2 w-2 translate-y-1 rounded-full bg-indigo-500"></span>
                    ) : (
                      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <p className="text-xs font-semibold leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => setActiveAlerts([])}
              className="w-full py-3.5 px-6 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl cursor-pointer shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Okay, Got It
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
