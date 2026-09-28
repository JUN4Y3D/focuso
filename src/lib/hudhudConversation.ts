// Shared limits and session data only. Model instructions and credentials stay server-side.
export const HUDHUD_INPUT_CHARS = 400
export const HUDHUD_REPLY_CHARS = 2400
export const HUDHUD_CONTEXT_MESSAGES = 13 // Six complete exchanges + current user.
export const HUDHUD_CONTEXT_CHARS = 6000
export const HUDHUD_SESSION_MESSAGES = 40 // At most twenty completed exchanges.
export const HUDHUD_SESSION_CHARS = 24000
export const HUDHUD_STORAGE_KEY = 'focuso:hudhud:chat:v1'

export interface HudHudChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HudHudDisplayMessage extends HudHudChatMessage {
  id: string
  createdAt?: string
  isNotice?: boolean
  pending?: boolean
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function hudHudSessionStorage(): SessionStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage } catch { return undefined }
}

/** UI greetings, failed/pending sends and error notices are never model context. */
export function completedHudHudMessages(messages: HudHudDisplayMessage[]): HudHudDisplayMessage[] {
  const genuine = messages.filter(message => message.id !== 'welcome' && !message.isNotice && !message.pending)
  const completed: HudHudDisplayMessage[] = []
  for (let index = 0; index < genuine.length - 1; index++) {
    if (genuine[index].role === 'user' && genuine[index + 1].role === 'assistant') {
      completed.push(genuine[index], genuine[index + 1])
      index++
    }
  }
  return completed
}

/** Prune entire oldest turns, never half an exchange or the current user message. */
export function recentHudHudContext(history: HudHudChatMessage[], currentUser: HudHudChatMessage): HudHudChatMessage[] {
  if (currentUser.role !== 'user' || !currentUser.content.trim() || currentUser.content.length > HUDHUD_INPUT_CHARS) {
    throw new Error('Invalid current HudHud message')
  }
  if (history.length % 2 !== 0 || history.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user'))) {
    throw new Error('HudHud history must contain complete chronological turns')
  }
  const context = history.slice(-(HUDHUD_CONTEXT_MESSAGES - 1)).map(({ role, content }) => ({ role, content }))
  let characters = context.reduce((sum, message) => sum + message.content.length, currentUser.content.length)
  while (context.length && characters > HUDHUD_CONTEXT_CHARS) {
    characters -= context[0].content.length + context[1].content.length
    context.splice(0, 2)
  }
  return [...context, { role: 'user', content: currentUser.content }]
}

function clearSession(storage?: SessionStorage) {
  try { storage?.removeItem(HUDHUD_STORAGE_KEY) } catch { /* Blocked storage does not break chat. */ }
}

function validStoredMessage(message: unknown): message is HudHudDisplayMessage {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false
  const value = message as Record<string, unknown>
  if (Object.keys(value).some(key => !['id', 'role', 'content', 'createdAt'].includes(key))) return false
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 80 && value.id !== 'welcome'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.content === 'string' && value.content.trim().length > 0
    && value.content.length <= (value.role === 'user' ? HUDHUD_INPUT_CHARS : HUDHUD_REPLY_CHARS)
    && (value.createdAt === undefined || (typeof value.createdAt === 'string' && value.createdAt.length <= 32
      && Number.isFinite(Date.parse(value.createdAt))))
}

export function restoreHudHudSession(storage = hudHudSessionStorage()): HudHudDisplayMessage[] {
  try {
    const raw = storage?.getItem(HUDHUD_STORAGE_KEY)
    if (!raw) return []
    if (raw.length > 100000) throw new Error('Oversized session')
    const session: unknown = JSON.parse(raw)
    if (!session || typeof session !== 'object' || Array.isArray(session)) throw new Error('Invalid session')
    const value = session as Record<string, unknown>
    if (value.version !== 1 || Object.keys(value).some(key => !['version', 'messages'].includes(key))
      || !Array.isArray(value.messages) || value.messages.length > HUDHUD_SESSION_MESSAGES
      || value.messages.length % 2 !== 0 || !value.messages.every(validStoredMessage)) throw new Error('Invalid session')
    const messages = value.messages as HudHudDisplayMessage[]
    if (new Set(messages.map(message => message.id)).size !== messages.length
      || messages.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user'))
      || messages.reduce((sum, message) => sum + message.content.length, 0) > HUDHUD_SESSION_CHARS) throw new Error('Invalid turns')
    return messages
  } catch {
    clearSession(storage)
    return []
  }
}

export function persistHudHudSession(messages: HudHudDisplayMessage[], storage = hudHudSessionStorage()) {
  // Whitelist fields rather than serializing UI state or provider metadata.
  const completed = completedHudHudMessages(messages).slice(-HUDHUD_SESSION_MESSAGES)
    .map(({ id, role, content, createdAt }) => ({ id, role, content, ...(createdAt ? { createdAt } : {}) }))
  let characters = completed.reduce((sum, message) => sum + message.content.length, 0)
  while (completed.length && characters > HUDHUD_SESSION_CHARS) {
    characters -= completed[0].content.length + completed[1].content.length
    completed.splice(0, 2)
  }
  try { storage?.setItem(HUDHUD_STORAGE_KEY, JSON.stringify({ version: 1, messages: completed })) } catch { /* In-memory fallback. */ }
}
