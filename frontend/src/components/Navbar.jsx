import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import { ensureChatIdentity } from '../services/chatCrypto'
import { formatDateTime } from '../utils/dateFormatter'

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('user')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      setUser(null)
      localStorage.removeItem('user')
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
        if (!cancelled) {
          setUser(res.data)
          localStorage.setItem('user', JSON.stringify(res.data))
          ensureChatIdentity(res.data.id, token).catch((err) => {
            console.warn('Secure chat key could not be initialized:', err.message)
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
      })

    fetchNotifications()
    const intervalId = window.setInterval(fetchNotifications, 10000)
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
    if (notification.type === 'new_chat_message' && notification.conversation_id) {
      navigate(`/chat/${notification.conversation_id}`)
    } else {
      navigate('/dashboard?tab=rentals')
    }
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
    localStorage.removeItem('user')
    setUser(null)
    setNotifications([])
    setUnreadCount(0)
    navigate('/login')
  }

  const latestUnread = notifications.find(notification => !notification.is_read)

  const notificationTone = (notification) => {
    if (notification.type === 'new_chat_message') return 'theme-alert-info'
    if (notification.type === 'request_accepted') return 'theme-alert-success'
    if (notification.type === 'request_rejected') return 'theme-alert-error'
    return 'theme-alert-pending'
  }

  return (
    <nav className="theme-navbar relative bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="theme-logo-mark h-9 w-9 rounded-lg flex items-center justify-center group-hover:scale-105 transition-all duration-200">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-extrabold text-xl text-[var(--foreground)]">
                Equip<span className="text-[var(--foreground)]">Share</span>
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              to="/explore"
              className={location.pathname === '/explore'
                ? "theme-nav-active font-bold px-3 py-1.5 rounded-lg transition-all"
                : "text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-medium px-3 py-1.5 rounded-xl transition-colors"}
            >
              Explore
            </Link>
            
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className={location.pathname === '/dashboard'
                    ? "theme-nav-active font-bold px-3 py-1.5 rounded-lg transition-all"
                    : "text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-medium px-3 py-1.5 rounded-xl transition-colors"}
                >
                  Dashboard
                </Link>
                <Link
                  to="/chat"
                  className={location.pathname.startsWith('/chat')
                    ? "theme-nav-active font-bold px-3 py-1.5 rounded-lg transition-all"
                    : "text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-medium px-3 py-1.5 rounded-xl transition-colors"}
                >
                  Chats
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
                    className="theme-primary-button inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer"
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
                  className="theme-primary-button inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-all"
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
            to="/explore"
            onClick={() => setIsOpen(false)}
            className={location.pathname === '/explore'
              ? "block px-3 py-2 rounded-xl text-base font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/30"
              : "block px-3 py-2 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}
          >
            Explore
          </Link>
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className={location.pathname === '/dashboard'
                  ? "block px-3 py-2 rounded-xl text-base font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/30"
                  : "block px-3 py-2 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-850"}
              >
                Dashboard
              </Link>
              <Link
                to="/chat"
                onClick={() => setIsOpen(false)}
                className={location.pathname.startsWith('/chat')
                  ? "block px-3 py-2 rounded-xl text-base font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/30"
                  : "block px-3 py-2 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}
              >
                Chats
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
                className="theme-primary-button block text-center px-4 py-2 text-base font-medium rounded-lg"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}

      {user && notificationsOpen && (
        <div className="theme-card absolute right-4 top-16 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white">
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
                className={`w-full border-b px-4 py-4 text-left transition-colors last:border-0 cursor-pointer ${notificationTone(notification)} ${
                  notification.is_read
                    ? 'opacity-65 hover:opacity-85'
                    : 'hover:brightness-95'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-slate-300 dark:bg-slate-600' : 'bg-indigo-500'}`} />
                  <div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-200">{notification.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.created_at)}</p>
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
          className={`w-full border-t border-[var(--border)] px-4 py-2.5 text-left text-sm font-semibold hover:brightness-95 cursor-pointer ${notificationTone(latestUnread)}`}
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
