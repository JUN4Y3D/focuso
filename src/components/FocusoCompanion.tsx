import { useState, useEffect, useRef } from 'react'
import { IconClose, IconArrow } from './primitives'
import { useLang } from '../i18n'
import { HudHudBird, HudHudTrigger } from './HudHud/HudHudTrigger'

export interface Message {
  id: string
  role: 'user' | 'model'
  text: string
  createdAt?: string
  isNotice?: boolean
}

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text:
        lang === 'bn'
          ? 'আসসালামু আলাইকুম। আমি হুদহুদ, আপনার FOCUSO AI সহকারী। আজ কোন কাজে মনোযোগ দিতে চান?'
          : 'Assalamu Alaikum. I’m HudHud, your FOCUSO AI assistant. What would you like help focusing on today?',
    },
  ])

  const scrollRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sendingRef = useRef(false)

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
    setMessages(previous => previous.map(message => message.id === 'welcome' ? {
      ...message,
      text: lang === 'bn'
        ? 'আসসালামু আলাইকুম। আমি হুদহুদ, আপনার FOCUSO AI সহকারী। আজ কোন কাজে মনোযোগ দিতে চান?'
        : 'Assalamu Alaikum. I’m HudHud, your FOCUSO AI assistant. What would you like help focusing on today?',
    } : message))
  }, [lang])

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, isOpen])

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim()
    if (!messageContent || sendingRef.current) return
    sendingRef.current = true

    // Limit client-side prompt length to avoid excessive payload
    const safeContent = messageContent.slice(0, 400)

    const userMessage: Message = {
      id: 'u_' + Date.now(),
      role: 'user',
      text: safeContent,
      createdAt: new Date().toISOString(),
    }

    const updated = [...messages, userMessage]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      // Send at most the last 4 messages to minimize token usage
      const payloadMessages = updated
        .filter((m) => !m.isNotice)
        .slice(-4)
        .map((m) => ({ role: m.role, text: m.text }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 429 || data.rateLimited || data.quotaExceeded) {
          const limitMsg: Message = {
            id: 'limit_' + Date.now(),
            role: 'model',
            isNotice: true,
            text:
              lang === 'bn'
                ? 'সাময়িকভাবে চ্যাটের সীমা শেষ হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন অথবা সরাসরি "প্ল্যানারটি অর্ডার করুন" বাটনে গিয়ে অর্ডার সম্পন্ন করতে পারেন।'
                : 'Chat rate limit reached for this session. Please wait a moment or click "Order the Planner" to proceed directly with your order.',
            createdAt: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, limitMsg])
          return
        }
        throw new Error(data.error || 'Failed to get response.')
      }

      const companionMessage: Message = {
        id: 'm_' + Date.now(),
        role: 'model',
        text:
          data.reply ||
          (lang === 'bn'
            ? 'ধন্যবাদ। ফোকাসো প্ল্যানার নিয়ে আর কোনো প্রশ্ন থাকলে জানান।'
            : 'Thank you. Let me know if you have any other questions about FOCUSO.'),
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, companionMessage])
    } catch (err: unknown) {
      console.warn('Chat service notice:', err)
      const errorMsg: Message = {
        id: 'err_' + Date.now(),
        role: 'model',
        isNotice: true,
        text:
          lang === 'bn'
            ? 'হুদহুদ এখন সংযোগ করতে পারছে না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।'
            : 'HudHud couldn’t connect right now. Please try again in a moment.',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      sendingRef.current = false
      setLoading(false)
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
            <div ref={scrollRef} role="log" aria-label={lang === 'bn' ? 'কথোপকথন' : 'Conversation'} aria-live="polite" className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-4">
              {messages.map((m) => {
                const isUser = m.role === 'user'
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-[12px] px-4 py-3 text-[14px] leading-relaxed border ${
                        isUser
                          ? 'bg-green text-white-soft border-green'
                          : m.isNotice
                          ? 'bg-soft-green text-deep border-ink-15 text-[13px]'
                          : 'bg-white text-ink border-ink-15'
                      }`}
                    >
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
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
                <div className="flex items-center gap-2 text-ink-60 text-[13px] italic bg-white border border-ink-15 rounded-[10px] px-3.5 py-2.5 w-fit">
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
                handleSend()
              }}
              className="p-4 border-t border-ink-15 bg-white flex items-center gap-2"
            >
              <input
                type="text"
                aria-label={lang === 'bn' ? 'হুদহুদকে বার্তা লিখুন' : 'Message HudHud'}
                value={input}
                maxLength={400}
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
                aria-label="Send message"
              >
                <IconArrow className="w-4 h-4" />
              </button>
            </form>
            <a href="/audio/hudhud-call-license.html" target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-ink-60 underline underline-offset-2 px-4 pb-2 w-fit">
              {lang === 'bn' ? 'পাখির ডাকের কৃতিত্ব' : 'Bird call credit'}
            </a>
          </dialog>
      )}
    </>
  )
}
