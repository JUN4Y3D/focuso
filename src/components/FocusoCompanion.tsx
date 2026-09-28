import { useState, useEffect, useRef } from 'react'
import { IconClose, IconArrow } from './primitives'
import { useLang } from '../i18n'
import { HudHudBird, HudHudTrigger } from './HudHud/HudHudTrigger'
import {
  HUDHUD_INPUT_CHARS, HUDHUD_REPLY_CHARS, HUDHUD_SESSION_MESSAGES, recentHudHudContext,
  completedHudHudMessages, restoreHudHudSession, persistHudHudSession,
  type HudHudDisplayMessage as Message,
} from '../lib/hudhudConversation'

const STARTER_PROMPTS_EN = [
  'Plan my day',
  'Help me prioritize',
  'Build a routine',
  'Break down a goal',
]

const STARTER_PROMPTS_BN = [
  'দিনের পরিকল্পনা করি',
  'অগ্রাধিকার ঠিক করি',
  'একটি রুটিন তৈরি করি',
  'লক্ষ্যকে ছোট কাজে ভাগ করি',
]

export function FocusoCompanion() {
  const { lang } = useLang()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        lang === 'bn'
          ? 'আসসালামু আলাইকুম 👋 আজ কোন কাজে মনোযোগ দিতে চান?'
          : 'Assalamu Alaikum 👋 What would you like help focusing on today?',
    },
    ...restoreHudHudSession(),
  ])
  const messagesRef = useRef(messages)

  const scrollRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sendingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nearBottomRef = useRef(true)

  function updateMessages(next: Message[]) {
    // Synchronous source of truth avoids stale render snapshots between consecutive sends.
    const thread = next.slice(1).slice(-HUDHUD_SESSION_MESSAGES)
    while (thread[0]?.role === 'assistant') thread.shift()
    const bounded = [next[0], ...thread]
    messagesRef.current = bounded
    setMessages(bounded)
    persistHudHudSession(bounded)
  }

  // VisualViewport tracks the space above the mobile software keyboard.
  useEffect(() => {
    if (!isOpen) return
    const viewport = window.visualViewport
    const resize = () => {
      const dialog = dialogRef.current
      if (!dialog || !viewport) return
      dialog.style.setProperty('--hudhud-viewport-height', `${viewport.height}px`)
      dialog.style.setProperty('--hudhud-viewport-top', `${viewport.offsetTop}px`)
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [isOpen])

  // Keep the greeting aligned with the selected language without replacing conversation history.
  useEffect(() => {
    updateMessages(messagesRef.current.map(message => message.id === 'welcome' ? {
      ...message,
      content: lang === 'bn'
        ? 'আসসালামু আলাইকুম 👋 আজ কোন কাজে মনোযোগ দিতে চান?'
        : 'Assalamu Alaikum 👋 What would you like help focusing on today?',
    } : message))
  }, [lang])

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current && nearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, isOpen])

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim()
    if (!messageContent || sendingRef.current) return
    sendingRef.current = true

    // Limit client-side prompt length to avoid excessive payload
    const safeContent = messageContent.slice(0, HUDHUD_INPUT_CHARS)

    // Retrying the immediately failed message reuses its bubble, not its error notice.
    const previous = messagesRef.current
    const failedUser = previous.at(-2)
    const retry = failedUser?.role === 'user' && failedUser.isNotice && failedUser.content === safeContent
      && previous.at(-1)?.isNotice && previous.at(-1)?.role === 'assistant'
    const userMessage: Message = {
      id: retry ? failedUser.id : 'u_' + crypto.randomUUID(),
      role: 'user',
      content: safeContent,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    const history = completedHudHudMessages(previous)
    nearBottomRef.current = true
    updateMessages([...(retry ? previous.slice(0, -2) : previous), userMessage])
    setInput('')
    setLoading(true)

    try {
      const payloadMessages = recentHudHudContext(history, userMessage)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: AbortSignal.timeout(30000),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // Provider details are intentionally not rendered. Only quota/rate uses the busy notice.
        throw new Error(response.status === 429 ? 'rate_limited' : 'unavailable')
      }

      if (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > HUDHUD_REPLY_CHARS) throw new Error('Empty reply')
      const companionMessage: Message = {
        id: 'm_' + crypto.randomUUID(),
        role: 'assistant',
        content: data.reply.trim(),
        createdAt: new Date().toISOString(),
      }

      updateMessages([
        ...messagesRef.current.map(message => message.id === userMessage.id ? { ...message, pending: false } : message),
        companionMessage,
      ])
    } catch (err: unknown) {
      const rateLimited = err instanceof Error && err.message === 'rate_limited'
      const errorMsg: Message = {
        id: 'err_' + crypto.randomUUID(),
        role: 'assistant',
        isNotice: true,
        content: rateLimited
          ? lang === 'bn'
            ? 'হুদহুদ এখন সাময়িকভাবে ব্যস্ত। একটু পর আবার চেষ্টা করুন।'
            : 'HudHud is temporarily unavailable. Please try again in a few moments.'
          : lang === 'bn'
            ? 'হুদহুদ এখন সংযোগ করতে পারছে না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।'
            : 'HudHud couldn’t connect right now. Please try again in a moment.',
        createdAt: new Date().toISOString(),
      }
      updateMessages([
        ...messagesRef.current.map(message => message.id === userMessage.id ? { ...message, pending: false, isNotice: true } : message),
        errorMsg,
      ])
      setInput(safeContent)
    } finally {
      sendingRef.current = false
      setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    }
  }

  const starters = lang === 'bn' ? STARTER_PROMPTS_BN : STARTER_PROMPTS_EN

  return (
    <>
      <HudHudTrigger onOpen={() => setIsOpen(true)} buttonRef={triggerRef} lang={lang} />

      {/* Native modal provides focus containment and Escape handling. */}
      {isOpen && (
          <dialog
            ref={dialogRef}
            id="hudhud-dialog"
            className="hudhud-dialog"
            aria-labelledby="hudhud-title"
            onCancel={() => setIsOpen(false)}
            onClose={() => setIsOpen(false)}
          >
            {/* Header */}
            <header>
              <span className="hudhud-avatar"><HudHudBird /></span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="hudhud-title" className="font-serif text-ink">
                    {lang === 'bn' ? 'হুদহুদ' : 'HudHud'}
                  </h2>
                </div>
                <p className="text-[12px] text-ink-60 mt-0.5">
                  {lang === 'bn'
                    ? 'আপনার FOCUSO AI সহকারী'
                    : 'Your FOCUSO AI assistant'}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-ink-60 hover:text-ink transition-colors"
                autoFocus
                aria-label={lang === 'bn' ? 'সহকারী বন্ধ করুন' : 'Close assistant'}
              >
                <IconClose className="w-5 h-5" />
              </button>
            </header>

            {/* Message Thread */}
            <div ref={scrollRef} onScroll={() => {
              const thread = scrollRef.current
              if (thread) nearBottomRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80
            }} role="log" aria-label={lang === 'bn' ? 'কথোপকথন' : 'Conversation'} aria-live="polite" aria-relevant="additions" className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4 overscroll-contain">
              {messages.map((m) => {
                const isUser = m.role === 'user'
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`min-w-0 max-w-[92%] rounded-[14px] px-4 py-3 text-[14px] leading-relaxed border ${
                        isUser
                          ? 'bg-green text-white-soft border-green'
                          : m.isNotice
                          ? 'bg-soft-green text-deep border-ink-15 text-[13px]'
                          : 'bg-white text-ink border-ink-15'
                      }`}
                    >
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.content}</p>
                    </div>
                    {m.createdAt && (
                      <span className="text-[10px] text-ink-45 mt-1 px-1">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                )
              })}

              {loading && (
                <div role="status" className="flex items-center gap-2 text-ink-60 text-[13px] bg-white border border-ink-15 rounded-[10px] px-3.5 py-2.5 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  {lang === 'bn' ? 'উত্তর তৈরি হচ্ছে...' : 'HudHud is thinking…'}
                </div>
              )}
            </div>

            {/* Starter Suggestion Chips */}
            {messages.length <= 2 && !loading && (
              <div className="hudhud-suggestions px-6 py-3 border-t border-ink-15 bg-white/70">
                <p className="text-[11px] uppercase tracking-wider text-ink-45 mb-2 font-semibold">
                  {lang === 'bn' ? 'কোথা থেকে শুরু করবেন?' : 'A place to begin'}
                </p>
                <div className="hudhud-starters">
                  {starters.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      disabled={loading}
                      className="text-ink-60 hover:text-green transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!sendingRef.current) handleSend()
              }}
              className="p-4 border-t border-ink-15 bg-white flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                aria-label={lang === 'bn' ? 'হুদহুদকে বার্তা লিখুন' : 'Message HudHud'}
                value={input}
                maxLength={HUDHUD_INPUT_CHARS}
                enterKeyHint="send"
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'হুদহুদকে জিজ্ঞেস করুন...'
                    : 'Ask HudHud…'
                }
                className="flex-1 bg-white-soft border border-ink-15 rounded-[8px] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-45 focus:border-green focus:outline-none transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex items-center justify-center p-2.5 rounded-[8px] bg-green text-white-soft hover:bg-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label={lang === 'bn' ? 'বার্তা পাঠান' : 'Send message'}
              >
                <IconArrow className="w-4 h-4" />
              </button>
            </form>
          </dialog>
      )}
    </>
  )
}
