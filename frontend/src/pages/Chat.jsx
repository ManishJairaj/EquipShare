import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import api from '../services/api'
import {
  decryptChatMessage,
  encryptChatMessage,
  ensureChatIdentity,
} from '../services/chatCrypto'
import { formatApiError } from '../utils/errorFormatter'
import { formatDateTime } from '../utils/dateFormatter'

const headersFor = (token) => ({ Authorization: `Bearer ${token}` })

function Chat() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const messagesEndRef = useRef(null)

  const [user, setUser] = useState(null)
  const [identity, setIdentity] = useState(null)
  const [conversations, setConversations] = useState([])
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [error, setError] = useState('')

  const decryptConversationMessages = useCallback(async (detail, chatIdentity) => {
    if (!detail.peer_public_key) {
      setMessages([])
      return
    }
    const decrypted = await Promise.all((detail.messages || []).map(async (message) => {
      try {
        const plaintext = await decryptChatMessage(
          message,
          chatIdentity.privateKey,
          detail.peer_public_key,
          detail.id,
        )
        return { ...message, plaintext }
      } catch {
        return { ...message, plaintext: 'Unable to decrypt this message on this device.', failed: true }
      }
    }))
    setMessages(decrypted)
  }, [])

  const loadConversations = useCallback(async () => {
    if (!token) return
    const response = await api.get('/chats', { headers: headersFor(token) })
    setConversations(Array.isArray(response.data) ? response.data : [])
  }, [token])

  const loadConversation = useCallback(async (id, chatIdentity, silent = false) => {
    if (!id || !token || !chatIdentity) return
    try {
      const response = await api.get(`/chats/${id}`, { headers: headersFor(token) })
      setConversation(response.data)
      await decryptConversationMessages(response.data, chatIdentity)
      if (!silent) setError('')
    } catch (err) {
      if (!silent) setError(formatApiError(err))
    }
  }, [decryptConversationMessages, token])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    let cancelled = false
    const initialize = async () => {
      setLoading(true)
      try {
        const userResponse = await api.get('/auth/me', { headers: headersFor(token) })
        const currentUser = userResponse.data
        const chatIdentity = await ensureChatIdentity(currentUser.id, token)
        if (cancelled) return
        setUser(currentUser)
        setIdentity(chatIdentity)
        await loadConversations()
        if (conversationId) await loadConversation(conversationId, chatIdentity)
      } catch (err) {
        if (!cancelled) setError(err.message || formatApiError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    initialize()
    return () => { cancelled = true }
  }, [conversationId, loadConversation, loadConversations, navigate, token])

  useEffect(() => {
    if (!conversationId || !identity) return undefined
    const interval = window.setInterval(() => {
      loadConversation(conversationId, identity, true)
      loadConversations().catch(() => {})
    }, 5000)
    return () => window.clearInterval(interval)
  }, [conversationId, identity, loadConversation, loadConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openConversation = (id) => navigate(`/chat/${id}`)

  const handleSend = async (event) => {
    event.preventDefault()
    const plaintext = messageText.trim()
    if (!plaintext || !conversation || !identity || !conversation.peer_public_key) return
    setSending(true)
    setError('')
    try {
      const encryptedPayload = await encryptChatMessage(
        plaintext,
        identity.privateKey,
        conversation.peer_public_key,
        conversation.id,
      )
      await api.post(`/chats/${conversation.id}/messages`, encryptedPayload, {
        headers: headersFor(token),
      })
      setMessageText('')
      await Promise.all([
        loadConversation(conversation.id, identity),
        loadConversations(),
      ])
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSending(false)
    }
  }

  const handleBlockToggle = async () => {
    if (!conversation) return
    setBlockLoading(true)
    setError('')
    try {
      const action = conversation.is_blocked ? 'unblock' : 'block'
      const response = await api.patch(`/chats/${conversation.id}/${action}`, {}, {
        headers: headersFor(token),
      })
      setConversation(response.data)
      await loadConversations()
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setBlockLoading(false)
    }
  }

  const otherParticipant = conversation
    ? (conversation.current_user_role === 'buyer' ? conversation.seller : conversation.buyer)
    : null
  const waitingForSeller = conversation?.current_user_role === 'buyer'
    && conversation.awaiting_seller_reply
  const waitingForSecureKey = conversation?.current_user_role === 'buyer'
    && !conversation.peer_public_key
  const composerDisabled = conversation?.is_blocked || waitingForSeller
    || waitingForSecureKey || sending

  return (
    <div className="theme-page min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Private messaging</p>
            <h1 className="mt-1 text-3xl font-extrabold">Chats</h1>
          </div>
          <div className="theme-badge-mint rounded-full px-3 py-1.5 text-xs font-bold">
            End-to-end encrypted
          </div>
        </div>

        {error && <div className="theme-alert-error mb-4 rounded-xl border p-4 text-sm font-semibold">{error}</div>}

        <div className="theme-card grid min-h-[70vh] overflow-hidden rounded-2xl border lg:grid-cols-[330px_1fr]">
          <aside className={`${conversationId ? 'hidden lg:block' : 'block'} border-r border-[var(--border)]`}>
            <div className="border-b border-[var(--border-soft)] p-5">
              <h2 className="font-extrabold">Conversations</h2>
              <p className="mt-1 text-xs text-slate-500">Only the latest 15 messages are retained.</p>
            </div>
            <div className="max-h-[64vh] overflow-y-auto">
              {loading ? (
                <p className="p-6 text-sm text-slate-500">Loading secure chats…</p>
              ) : conversations.length === 0 ? (
                <div className="p-7 text-center">
                  <p className="font-bold">No conversations yet</p>
                  <p className="mt-2 text-sm text-slate-500">Open a listing and choose “Message seller” to begin.</p>
                </div>
              ) : conversations.map((item) => {
                const participant = item.current_user_role === 'buyer' ? item.seller : item.buyer
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => openConversation(item.id)}
                    className={`w-full border-b border-[var(--border-soft)] p-4 text-left transition-colors cursor-pointer ${
                      Number(conversationId) === item.id ? 'bg-[var(--primary)]' : 'hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--secondary)] font-extrabold">
                        {participant.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{participant.name}</span>
                        <span className="block truncate text-xs text-slate-500">{item.equipment.name}</span>
                        <span className="mt-1 block text-[11px] text-slate-500">
                          {item.is_blocked ? 'Conversation blocked' : 'Encrypted conversation'}
                        </span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className={`${conversationId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col`}>
            {!conversation ? (
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-2xl">🔒</div>
                <h2 className="text-xl font-extrabold">Select a secure conversation</h2>
                <p className="mt-2 max-w-md text-sm text-slate-500">Messages are encrypted in your browser. EquipShare stores only unreadable ciphertext.</p>
              </div>
            ) : (
              <>
                <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--primary)] p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <button type="button" onClick={() => navigate('/chat')} className="lg:hidden text-xl cursor-pointer" aria-label="Back to conversations">←</button>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--secondary)] font-extrabold">
                      {otherParticipant?.name?.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-extrabold">{otherParticipant?.name}</h2>
                      <p className="truncate text-xs text-slate-600">@{otherParticipant?.username} · {conversation.equipment.name}</p>
                    </div>
                  </div>
                  {conversation.current_user_role === 'seller' && (
                    <button
                      type="button"
                      onClick={handleBlockToggle}
                      disabled={blockLoading}
                      className={conversation.is_blocked
                        ? 'theme-positive-button rounded-full px-4 py-2 text-xs font-bold cursor-pointer'
                        : 'theme-danger-button rounded-full px-4 py-2 text-xs font-bold cursor-pointer'}
                    >
                      {blockLoading ? 'Updating…' : conversation.is_blocked ? 'Continue chat' : 'Block chat'}
                    </button>
                  )}
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--surface-muted)] p-4 sm:p-6">
                  <div className="mx-auto mb-5 max-w-md rounded-xl border border-[var(--border)] bg-[var(--accent-yellow)] p-3 text-center text-xs font-semibold">
                    {waitingForSecureKey
                      ? `🔐 ${otherParticipant?.name} has been notified. Messaging unlocks automatically after they next sign in.`
                      : `🔒 Messages are end-to-end encrypted. Only you and ${otherParticipant?.name} can read them.`}
                  </div>
                  {messages.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500">
                      {conversation.current_user_role === 'buyer'
                        ? 'Send one opening message to the seller.'
                        : 'The buyer has not sent an opening message yet.'}
                    </div>
                  ) : messages.map((message) => {
                    const isMine = message.sender_id === user?.id
                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] rounded-2xl border border-[var(--border)] px-4 py-3 ${
                          isMine ? 'rounded-br-sm bg-[var(--primary)]' : 'rounded-bl-sm bg-[var(--secondary)]'
                        }`}>
                          <p className={`whitespace-pre-wrap break-words text-sm ${message.failed ? 'italic text-slate-500' : ''}`}>{message.plaintext}</p>
                          <p className="mt-1.5 text-right text-[10px] text-slate-500">{formatDateTime(message.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <footer className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
                  {conversation.is_blocked ? (
                    <div className="theme-alert-warning rounded-xl border p-3 text-center text-sm font-bold">
                      This conversation is blocked. The seller can choose “Continue chat” to reopen it.
                    </div>
                  ) : waitingForSecureKey ? (
                    <div className="theme-alert-pending rounded-xl border p-3 text-center text-sm font-bold">
                      The seller has been notified. Waiting for their secure chat key—no action is needed from you.
                    </div>
                  ) : waitingForSeller ? (
                    <div className="theme-alert-pending rounded-xl border p-3 text-center text-sm font-bold">
                      Your first message was sent. You can continue after the seller replies.
                    </div>
                  ) : (
                    <form onSubmit={handleSend} className="flex items-end gap-3">
                      <textarea
                        rows="1"
                        maxLength={2000}
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            event.currentTarget.form?.requestSubmit()
                          }
                        }}
                        placeholder="Write an encrypted message…"
                        className="theme-input max-h-32 min-h-11 flex-1 resize-y rounded-xl border px-4 py-3 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={composerDisabled || !messageText.trim()}
                        className="theme-primary-button min-h-11 rounded-xl px-5 text-sm font-bold cursor-pointer"
                      >
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </form>
                  )}
                </footer>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default Chat
