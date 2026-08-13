import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function Navbar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      setUser(null)
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let cancelled = false
    const headers = { Authorization: `Bearer ${token}` }

    const fetchNotifications = async () => {
      try {
        const [notificationsRes, countRes] = await Promise.all([
          api.get('/notifications', { headers }),
          api.get('/notifications/unread-count', { headers }),
        ])
        if (cancelled) return
        const items = Array.isArray(notificationsRes.data)
          ? notificationsRes.data
          : []
        setNotifications(items)
        setUnreadCount(Number(countRes.data?.unread_count ?? 0))
        setNotificationsError('')
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load notifications:', err)
          setNotificationsError('Could not load notifications.')
        }
      }
    }

    api.get('/auth/me', { headers })
      .then(res => {
        if (!cancelled) setUser(res.data)
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem('token')
          setUser(null)
        }
      })

    fetchNotifications()
    const intervalId = window.setInterval(fetchNotifications, 30000)
    window.addEventListener('equipshare:notifications-changed', fetchNotifications)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('equipshare:notifications-changed', fetchNotifications)
    }
  }, [token])

  const markNotificationRead = async (notification) => {
    if (!notification.is_read) {
      try {
        await api.patch(`/notifications/${notification.id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setNotifications(current => current.map(item => (
          item.id === notification.id ? { ...item, is_read: true } : item
        )))
        setUnreadCount(current => Math.max(0, current - 1))
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    }
    setNotificationsOpen(false)
    navigate('/dashboard?tab=rentals')
  }

  const markAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications(current => current.map(item => ({ ...item, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark notifications as read:', err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setNotifications([])
    setUnreadCount(0)
    navigate('/login')
  }

  const latestUnread = notifications.find(notification => !notification.is_read)

  return (
    <nav className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 transition-all duration-300">
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
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(current => !current)}
                  className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  aria-label="Open notifications"
                  aria-expanded={notificationsOpen}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
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
          <div className="md:hidden flex items-center gap-1">
            {user && (
              <button
                type="button"
                onClick={() => setNotificationsOpen(current => !current)}
                className="relative inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Open notifications"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
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

      {user && notificationsOpen && (
        <div className="absolute right-4 top-16 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white">Notifications</h3>
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={markAllNotificationsRead}
              disabled={unreadCount === 0}
              className="text-xs font-bold text-indigo-600 disabled:text-slate-400 dark:text-indigo-400 cursor-pointer disabled:cursor-default"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notificationsError ? (
              <p className="p-5 text-center text-sm text-rose-500">{notificationsError}</p>
            ) : notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : notifications.map(notification => (
              <button
                type="button"
                key={notification.id}
                onClick={() => markNotificationRead(notification)}
                className={`w-full border-b border-slate-100 px-4 py-4 text-left transition-colors last:border-0 dark:border-slate-800 cursor-pointer ${
                  notification.is_read
                    ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70'
                    : 'bg-indigo-50 hover:bg-indigo-100/70 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-slate-300 dark:bg-slate-600' : 'bg-indigo-500'}`} />
                  <div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-200">{notification.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(notification.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {user && latestUnread && (
        <button
          type="button"
          onClick={() => markNotificationRead(latestUnread)}
          className="w-full border-t border-indigo-200/60 bg-indigo-50 px-4 py-2.5 text-left text-sm font-semibold text-indigo-900 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/35 dark:text-indigo-200 dark:hover:bg-indigo-950/55 cursor-pointer"
        >
          <span className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <span className="truncate">{latestUnread.message}</span>
            <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">View request</span>
          </span>
        </button>
      )}
    </nav>
  )
}

export default Navbar
