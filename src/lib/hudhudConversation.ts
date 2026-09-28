// Shared bounds keep the UI and API aligned without shipping model instructions.
export const HUDHUD_INPUT_CHARS = 400
export const HUDHUD_REPLY_CHARS = 2400
export const HUDHUD_CONTEXT_MESSAGES = 11 // Five complete exchanges + current user.
export const HUDHUD_SESSION_MESSAGES = 41 // In-memory only; no browser storage.

export interface HudHudChatMessage {
  role: 'user' | 'model'
  text: string
}

export function recentHudHudContext(messages: HudHudChatMessage[]): HudHudChatMessage[] {
  const recent = messages.slice(-HUDHUD_CONTEXT_MESSAGES)
  // Gemini history begins with a user, even when the oldest exchange was pruned.
  while (recent.length && recent[0].role !== 'user') recent.shift()
  return recent
}
