import { useState, useEffect, useRef } from 'react'
import { IconClose, IconArrow } from './primitives'
import { useLang } from '../i18n'

export interface Message {
  id: string
  role: 'user' | 'model'
  text: string
  createdAt?: string
  isNotice?: boolean
}

const STARTER_PROMPTS_EN = [
  'What is the price and delivery fee?',
  'How does the daily layout track Salah and priorities?',
  'How do I place an order for the planner?',
  'What is the 60-day undated system?',
]

const STARTER_PROMPTS_BN = [
  'FOCUSO প্ল্যানারের মূল্য এবং ডেলিভারি চার্জ কত?',
  'দৈনিক পেজে সালাত ও অগ্রাধিকার কীভাবে ট্র্যাক করব?',
  'প্ল্যানারটি কীভাবে অর্ডার করব?',
  '৬০ দিনের আনডেটেড সিস্টেমের সুবিধা কী?',
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
          ? 'আসসালামু আলাইকুম। আমি ফোকাসো সহকারী—FOCUSO ডেইলি প্ল্যানার, মূল্য, ডেলিভারি বা ব্যবহার পদ্ধতি নিয়ে আপনার যেকোনো প্রশ্নের উত্তর দিতে প্রস্তুত।'
          : 'As-salamu alaykum. I am your FOCUSO Assistant—here to answer questions about the FOCUSO Daily Planner, features, pricing, delivery, and daily routines.',
    },
  ])

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim()
    if (!messageContent || loading) return

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
            ? 'সহকারী সেবাটি এই মুহূর্তে ব্যস্ত রয়েছে। আপনি চাইলে সরাসরি অর্ডার সম্পন্ন করতে পারেন।'
            : 'The assistant is temporarily resting or at capacity. Feel free to explore the page or place your order directly.',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const starters = lang === 'bn' ? STARTER_PROMPTS_BN : STARTER_PROMPTS_EN

  return (
    <>
      {/* Floating Trigger Button */}
      <aside aria-label="FOCUSO Assistant Launcher" className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group inline-flex items-center gap-2.5 rounded-full border border-ink-15 bg-white-soft px-5 py-3 text-[14px] font-semibold text-ink shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:border-green hover:bg-soft-green transition-all duration-200"
          aria-expanded={isOpen}
          aria-label={lang === 'bn' ? 'ফোকাসো সহকারী খুলুন' : 'Open FOCUSO Assistant'}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-green" />
          <span className="font-serif tracking-wide">
            {lang === 'bn' ? 'ফোকাসো সহকারী' : 'FOCUSO Assistant'}
          </span>
        </button>
      </aside>

      {/* Slide-over Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/20 backdrop-blur-xs animate-fade">
          <div
            className="w-full max-w-[440px] h-full bg-white-soft border-l border-ink-15 flex flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="FOCUSO Assistant"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-ink-15 flex items-center justify-between bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green" />
                  <h2 className="font-serif text-[18px] text-ink">
                    {lang === 'bn' ? 'ফোকাসো সহকারী' : 'FOCUSO Assistant'}
                  </h2>
                </div>
                <p className="text-[12px] text-ink-60 mt-0.5">
                  {lang === 'bn'
                    ? 'প্ল্যানার, মূল্য ও ডেলিভারি সম্পর্কিত তথ্য'
                    : 'Product, pricing & delivery inquiries'}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-ink-60 hover:text-ink transition-colors"
                aria-label="Close assistant"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            {/* Message Thread */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
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
                      <p className="whitespace-pre-wrap">{m.text}</p>
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
                  {lang === 'bn' ? 'উত্তর তৈরি হচ্ছে...' : 'Checking details...'}
                </div>
              )}
            </div>

            {/* Starter Suggestion Chips */}
            {messages.length <= 2 && !loading && (
              <div className="px-6 py-3 border-t border-ink-15 bg-white/70">
                <p className="text-[11px] uppercase tracking-wider text-ink-45 mb-2 font-semibold">
                  {lang === 'bn' ? 'সাধারণ প্রশ্নাবলী' : 'Common questions'}
                </p>
                <div className="flex flex-col gap-1.5">
                  {starters.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="text-left text-[12px] text-ink-60 hover:text-green hover:bg-soft-green px-2.5 py-1.5 rounded-[6px] border border-ink-15 transition-colors line-clamp-1"
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
                value={input}
                maxLength={400}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'প্ল্যানার, মূল্য বা ডেলিভারি সম্পর্কে লিখুন...'
                    : 'Ask about the planner, price, delivery...'
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
          </div>
        </div>
      )}
    </>
  )
}
