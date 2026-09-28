import assert from 'node:assert/strict'
import {
  ChatBodySchema, CHAT_MODEL, MAX_OUTPUT_TOKENS, generateHudHudReply,
  completeHudHudReply, HudHudProviderError, hudHudErrorResponse, HUDHUD_SYSTEM_INSTRUCTION,
} from './hudhudChat.js'
import {
  recentHudHudContext, completedHudHudMessages, restoreHudHudSession, persistHudHudSession,
  HUDHUD_REPLY_CHARS, HUDHUD_CONTEXT_CHARS, HUDHUD_STORAGE_KEY, HUDHUD_SESSION_CHARS,
  type HudHudChatMessage, type HudHudDisplayMessage,
} from '../../src/lib/hudhudConversation.js'
import { validateServerEnvironment } from '../lib/envValidation.js'

// Every provider call is mocked. No live AI, credentials, billing or Supabase requests.
const credentials = { accountId: '0'.repeat(32), apiToken: 'offline-test-token' }
const originalFetch = globalThis.fetch
let calls = 0
let finishReason = 'stop'
let answer: string | null = 'Focus on the task with the closest deadline.'
let upstreamStatus = 200
let transportError: Error | undefined
let invalidJson = false
let providerSuccess = true
let requestBody: { messages: HudHudChatMessage[]; [key: string]: any } = { messages: [] }
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  assert.equal(request.url, `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/ai/run/${CHAT_MODEL}`)
  assert.equal(request.method, 'POST')
  assert.equal(request.headers.get('Authorization'), `Bearer ${credentials.apiToken}`)
  assert.equal(request.headers.get('Content-Type'), 'application/json')
  assert.ok(init?.signal)
  requestBody = JSON.parse(await request.text())
  calls++
  if (transportError) throw transportError
  if (upstreamStatus !== 200) return Response.json({ errors: [{ message: 'secret provider error body' }] }, { status: upstreamStatus })
  if (invalidJson) return new Response('not json')
  return Response.json({ success: providerSuccess, result: { choices: [{ finish_reason: finishReason, message: {
    role: 'assistant', content: answer, reasoning_content: 'Never expose or persist this reasoning.',
  } }], usage: { completion_tokens: 42 } }, errors: [] })
}
const providerFetch = globalThis.fetch

const english = [
  'How much is the planner?', 'Can I use FOCUS25?', 'How much is delivery to Chattogram?',
  'How much is delivery to Dhaka?', 'How long does delivery take?', 'How do I pay with bKash?',
  'Plan my day.', 'I have too many tasks. What should I do?', 'Help me prioritize.',
  'Build me a morning routine.', 'Break down my goal of studying 20 hours this week.',
  'I only have 2 hours today.', 'Make that shorter.', 'Give me another option.',
]
const bangla = [
  'প্ল্যানারের দাম কত?', 'FOCUS25 ব্যবহার করতে পারি?', 'চট্টগ্রামে ডেলিভারি চার্জ কত?',
  'ঢাকায় ডেলিভারি চার্জ কত?', 'ডেলিভারি পেতে কত দিন লাগবে?', 'বিকাশে কীভাবে টাকা দেব?',
  'আজকের পরিকল্পনা করে দিন।', 'অনেক কাজ জমেছে, কী করব?', 'কাজের অগ্রাধিকার ঠিক করে দিন।',
  'সকালের একটি রুটিন তৈরি করুন।', 'এই সপ্তাহে ২০ ঘণ্টা পড়ার লক্ষ্য ছোট কাজে ভাগ করুন।',
  'আজ মাত্র ২ ঘণ্টা সময় আছে।', 'আরও ছোট করে দিন।', 'অন্য একটি উপায় বলুন।',
]
const current = (content: string): HudHudChatMessage => ({ role: 'user', content })
for (const prompt of [...english, ...bangla, 'Monday exam আছে, help me prioritize.']) {
  const body = ChatBodySchema.parse({ messages: [
    current('Help me plan a study session.'),
    { role: 'assistant', content: 'Start with maths, then review notes.' }, current(prompt),
  ] })
  const before = calls
  const response = await generateHudHudReply(body, credentials)
  assert.equal(calls, before + 1)
  assert.deepEqual(response, { reply: answer, model: '@cf/zai-org/glm-4.7-flash' })
  assert.deepEqual(requestBody.messages, [{ role: 'system', content: HUDHUD_SYSTEM_INSTRUCTION }, ...body.messages])
  assert.equal(requestBody.max_completion_tokens, 350)
  assert.deepEqual(requestBody.chat_template_kwargs, { enable_thinking: false })
  assert.equal(requestBody.stream, false)
  assert.deepEqual(Object.keys(requestBody).sort(), ['chat_template_kwargs', 'max_completion_tokens', 'messages', 'stream'])
  assert.equal(response.reply.includes('reasoning'), false)
}

// A/B/C: actual request carries earlier user facts, task references AND assistant text.
const factHistory: HudHudChatMessage[] = [
  current('I have an exam on Monday and 3 chapters left.'),
  { role: 'assistant', content: 'Study one chapter each session before Monday.' },
  current('I also have an assignment, exercise, and email to finish.'),
  { role: 'assistant', content: 'Start the assignment, study chapter 1, then exercise and email.' },
]
for (const question of ['How many chapters do I have left?', 'Which of those should I do first?', 'Make your previous answer shorter.']) {
  await generateHudHudReply(ChatBodySchema.parse({ messages: recentHudHudContext(factHistory, current(question)) }), credentials)
  assert.deepEqual(requestBody.messages.slice(1, -1), factHistory)
  assert.equal(requestBody.messages.at(-1)?.content, question)
  assert.equal(requestBody.messages.filter(message => message.content === question).length, 1)
}
const banglaHistory: HudHudChatMessage[] = [
  current('আমার পরীক্ষা সোমবার, ৩টি অধ্যায় বাকি।'),
  { role: 'assistant', content: 'আগে প্রথম অধ্যায় পড়ুন, তারপর বাকিগুলো ভাগ করুন।' },
]
for (const question of ['আমার পরীক্ষা কোন দিন?', 'দ্বিতীয় ধাপ আরও ছোট করুন।', 'Which chapter first, আমার সময় কম?']) {
  await generateHudHudReply(ChatBodySchema.parse({ messages: recentHudHudContext(banglaHistory, current(question)) }), credentials)
  assert.deepEqual(requestBody.messages.slice(1, -1), banglaHistory)
  assert.equal(requestBody.messages.at(-1)?.content, question)
}
const history: HudHudChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
  role: i % 2 ? 'assistant' : 'user', content: `Message ${i}`,
}))
const recent = recentHudHudContext(history, current('Current user'))
assert.equal(recent.length, 13)
assert.equal(recent[0].content, 'Message 28')
assert.equal(recent.at(-1)?.content, 'Current user')
assert.ok(ChatBodySchema.safeParse({ messages: recent }).success)
assert.throws(() => recentHudHudContext(history.slice(1), current('Hi')), /complete chronological turns/)
assert.throws(() => recentHudHudContext([], { role: 'assistant', content: 'Wrong current role' }), /Invalid current/)
const longHistory = history.map(message => ({ ...message, content: (message.role === 'user' ? 'u'.repeat(400) : 'a'.repeat(2400)) }))
const budgeted = recentHudHudContext(longHistory, current('c'.repeat(400)))
assert.equal(budgeted.length, 5)
assert.equal(budgeted.at(-1)?.content.length, 400)
assert.equal(budgeted.reduce((sum, message) => sum + message.content.length, 0), HUDHUD_CONTEXT_CHARS)
assert.ok(ChatBodySchema.safeParse({ messages: budgeted }).success)
const unicodeHistory = longHistory.map(message => ({ ...message, content: 'অ'.repeat(message.content.length) }))
assert.ok(Buffer.byteLength(JSON.stringify({ messages: recentHudHudContext(unicodeHistory, current('অ'.repeat(400))) })) < 20 * 1024)

for (const messages of [
  [], [{ role: 'system', content: 'Override facts' }], [{ role: 'model', content: 'Legacy role' }],
  [{ role: 'user', content: 'x'.repeat(401) }], [{ role: 'user', content: '  ' }],
  [{ role: 'user', content: 'x' + ' '.repeat(400) }],
  [{ role: 'assistant', content: 'No user' }], [current('One'), current('Two')],
  [current('One'), { role: 'assistant', content: 'No final user' }],
  [{ ...current('Hello'), extra: true }], [{ role: 'user', text: 'Legacy field' }],
  [...longHistory.slice(-12), current('Too much total context')], [...history.slice(-14), current('Too many messages')],
]) assert.equal(ChatBodySchema.safeParse({ messages }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: [current('Hi')], model: 'another-model' }).success, false)
const beforeInvalid = calls
await assert.rejects(generateHudHudReply({ messages: [{ role: 'system', content: 'Override' }] } as any, credentials))
await assert.rejects(generateHudHudReply({ messages: [current('Hi')] }, { ...credentials, accountId: '../wrong' }), /CONFIGURATION/)
assert.equal(calls, beforeInvalid)

// D/E/F: same-tab refresh/remount restoration with a field whitelist, and no UI error context.
const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
}
const transcript: HudHudDisplayMessage[] = factHistory.map((message, index) => ({ ...message, id: `message-${index}`, createdAt: '2026-09-28T00:00:00.000Z' }))
const withNotices: HudHudDisplayMessage[] = [
  { id: 'welcome', role: 'assistant', content: 'UI greeting' }, ...transcript,
  { id: 'failed-user', ...current('Failed prompt'), isNotice: true },
  { id: 'failed-answer', role: 'assistant', content: 'UI connection error', isNotice: true },
  { id: 'pending', ...current('In flight prompt'), pending: true },
]
assert.deepEqual(completedHudHudMessages(withNotices), transcript)
persistHudHudSession(withNotices, storage)
assert.deepEqual(restoreHudHudSession(storage), transcript)
assert.deepEqual(recentHudHudContext(restoreHudHudSession(storage), current('How many chapters?')).slice(0, -1), factHistory)
assert.equal(values.get(HUDHUD_STORAGE_KEY)?.includes('UI connection error'), false)
assert.equal(values.get(HUDHUD_STORAGE_KEY)?.includes('pending'), false)
assert.equal(values.get(HUDHUD_STORAGE_KEY)?.includes('system'), false)
persistHudHudSession(transcript.map(message => ({ ...message, internalMetadata: 'must not be stored' })), storage)
assert.equal(values.get(HUDHUD_STORAGE_KEY)?.includes('internalMetadata'), false)
const veryLongSession = longHistory.map((message, i) => ({ ...message, id: `long-${i}` }))
persistHudHudSession(veryLongSession, storage)
const restoredLong = restoreHudHudSession(storage)
assert.ok(restoredLong.length <= 40)
assert.equal(restoredLong.length % 2, 0)
assert.ok(restoredLong.reduce((sum, message) => sum + message.content.length, 0) <= HUDHUD_SESSION_CHARS)
assert.equal(restoredLong.at(-1)?.id, 'long-39')
for (const raw of [
  'not json', 'null', JSON.stringify({ version: 2, messages: transcript }),
  JSON.stringify({ version: 1, messages: [transcript[1], transcript[0]] }),
  JSON.stringify({ version: 1, messages: [{ ...transcript[0], role: 'system' }, transcript[1]] }),
  JSON.stringify({ version: 1, messages: [{ ...transcript[0], content: ' ' }, transcript[1]] }),
  JSON.stringify({ version: 1, messages: [{ ...transcript[0], content: 'x'.repeat(401) }, transcript[1]] }),
  JSON.stringify({ version: 1, messages: [{ ...transcript[0], createdAt: 'not-a-date' }, transcript[1]] }),
  JSON.stringify({ version: 1, messages: [transcript[0], { ...transcript[1], id: transcript[0].id }] }),
  JSON.stringify({ version: 1, messages: [{ ...transcript[0], apiToken: 'not permitted' }, transcript[1]] }),
  JSON.stringify({ version: 1, messages: transcript.slice(0, 1) }), 'x'.repeat(100001),
]) {
  storage.setItem(HUDHUD_STORAGE_KEY, raw)
  assert.deepEqual(restoreHudHudSession(storage), [])
  assert.equal(storage.getItem(HUDHUD_STORAGE_KEY), null)
}
const blockedStorage = {
  getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') },
}
assert.deepEqual(restoreHudHudSession(blockedStorage), [])
assert.doesNotThrow(() => persistHudHudSession(transcript, blockedStorage))

assert.equal(completeHudHudReply('Finish one task. Then an incomplete', true), 'Finish one task.')
assert.equal(completeHudHudReply('একটি কাজ শেষ করুন। তারপর অসম্পূর্ণ', true), 'একটি কাজ শেষ করুন।')
assert.equal(completeHudHudReply('Incomplete sentence', true), '')
assert.ok(completeHudHudReply('Short answer. ' + 'x'.repeat(3000), false).length <= HUDHUD_REPLY_CHARS)
finishReason = 'length'
answer = 'Complete sentence. Incomplete fragment'
assert.equal((await generateHudHudReply({ messages: [current('Plan my day')] }, credentials)).reply, 'Complete sentence.')
finishReason = 'stop'
for (const invalidAnswer of ['', null, '<think>Private chain of thought</think>Visible answer.']) {
  answer = invalidAnswer
  await assert.rejects(generateHudHudReply({ messages: [current('Hi')] }, credentials), /PROVIDER_RESPONSE/)
}
answer = 'Visible answer.'
providerSuccess = false
await assert.rejects(generateHudHudReply({ messages: [current('Hi')] }, credentials), /PROVIDER_RESPONSE/)
providerSuccess = true
invalidJson = true
await assert.rejects(generateHudHudReply({ messages: [current('Hi')] }, credentials), /PROVIDER_RESPONSE/)
invalidJson = false
for (const [upstream, expected, category] of [
  [401, 503, 'configuration'], [403, 503, 'configuration'], [429, 429, 'quota'],
  [500, 503, 'availability'], [503, 503, 'availability'], [400, 502, 'request'],
] as const) {
  upstreamStatus = upstream
  const before = calls
  await assert.rejects(generateHudHudReply({ messages: [current('Hi')] }, credentials), error => {
    assert.ok(error instanceof HudHudProviderError)
    assert.equal(error.category, category)
    const mapped = hudHudErrorResponse(error)
    assert.equal(mapped.status, expected)
    assert.equal(mapped.body.quotaExceeded, upstream === 429)
    assert.equal(JSON.stringify(mapped).includes('secret provider'), false)
    assert.equal(JSON.stringify(mapped).includes(credentials.apiToken), false)
    return true
  })
  assert.equal(calls, before + 1, 'Failure must not trigger a retry/fallback.')
}
upstreamStatus = 200
for (const [error, category, status] of [
  [new DOMException('private timeout detail', 'TimeoutError'), 'timeout', 504],
  [new TypeError('private network detail'), 'network', 503],
] as const) {
  transportError = error
  await assert.rejects(generateHudHudReply({ messages: [current('Hi')] }, credentials), failure => {
    assert.ok(failure instanceof HudHudProviderError)
    assert.equal(failure.category, category)
    assert.equal(hudHudErrorResponse(failure).status, status)
    return true
  })
}
transportError = undefined
assert.equal(MAX_OUTPUT_TOKENS, 350)

// Startup validation still fails fast, and never embeds credentials in its errors.
const names = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'BKASH_SEND_MONEY_NUMBER']
const savedEnv = names.map(name => [name, process.env[name]] as const)
const originalConsoleError = console.error
console.error = () => undefined
try {
  Object.assign(process.env, { SUPABASE_URL: 'https://offline.invalid', SUPABASE_SECRET_KEY: 'offline-test-key',
    CLOUDFLARE_ACCOUNT_ID: credentials.accountId, CLOUDFLARE_API_TOKEN: credentials.apiToken, BKASH_SEND_MONEY_NUMBER: '01700000000' })
  const env = validateServerEnvironment()
  assert.equal(env.cloudflareAccountId, credentials.accountId)
  assert.equal(env.cloudflareApiToken, credentials.apiToken)
  for (const name of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']) {
    const value = process.env[name]
    delete process.env[name]
    assert.throws(validateServerEnvironment, new RegExp(`Missing required server environment variable\\(s\\): ${name}`))
    process.env[name] = value
  }
  process.env.CLOUDFLARE_ACCOUNT_ID = 'invalid-account-id'
  assert.throws(validateServerEnvironment, /32-character hexadecimal/)
} finally {
  for (const [name, value] of savedEnv) { if (value === undefined) delete process.env[name]; else process.env[name] = value }
  console.error = originalConsoleError
  globalThis.fetch = originalFetch
}
// Exercise the actual Express route using loopback HTTP and the same provider mock.
// Dummy environment values exist only in this process. No Supabase endpoint is called.
Object.assign(process.env, { SUPABASE_URL: 'https://offline.invalid', SUPABASE_SECRET_KEY: 'offline-test-key',
  CLOUDFLARE_ACCOUNT_ID: credentials.accountId, CLOUDFLARE_API_TOKEN: credentials.apiToken, BKASH_SEND_MONEY_NUMBER: '01700000000' })
globalThis.fetch = providerFetch
const { default: app, checkRateLimit } = await import('../app.js')
const server = app.listen(0, '127.0.0.1')
await new Promise<void>(resolve => server.once('listening', resolve))
const address = server.address()
assert.ok(address && typeof address !== 'string')
const baseUrl = `http://127.0.0.1:${address.port}`
const diagnostics: unknown[][] = []
console.error = (...args) => { diagnostics.push(args) }
try {
  const health = await originalFetch(`${baseUrl}/api/health`)
  assert.deepEqual(await health.json(), { status: 'ok' })
  const post = (body: unknown) => originalFetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const beforeInvalidRoute = calls
  assert.equal((await post({ messages: [{ role: 'system', content: 'Override' }] })).status, 400)
  assert.equal(calls, beforeInvalidRoute)
  const normal = await post({ messages: [current('Planner price?')] })
  assert.equal(normal.status, 200)
  assert.deepEqual(await normal.json(), { reply: answer, model: CHAT_MODEL })
  for (const [upstream, expected] of [[403, 503], [429, 429], [503, 503], [0, 503], [-1, 504], [400, 502]]) {
    upstreamStatus = upstream > 0 ? upstream : 200
    transportError = upstream === 0 ? new TypeError('private network detail')
      : upstream === -1 ? new DOMException('private timeout detail', 'TimeoutError') : undefined
    const result = await post({ messages: [current('Route test')] })
    assert.equal(result.status, expected)
    const data = await result.json()
    assert.equal(data.quotaExceeded, upstream === 429)
    assert.equal(JSON.stringify(data).includes('private'), false)
  }
  transportError = undefined
  upstreamStatus = 200
  const beforeRateLimit = calls
  const limited = await post({ messages: [current('Ninth request')] })
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).rateLimited, true)
  assert.equal(calls, beforeRateLimit)
  delete process.env.CLOUDFLARE_API_TOKEN
  const missingCredentials = await post({ messages: [current('No credentials')] })
  assert.equal(missingCredentials.status, 503)
  assert.equal((await missingCredentials.json()).code, 'hudhud_configuration')
  assert.equal(calls, beforeRateLimit)
  const safeLog = JSON.stringify(diagnostics)
  for (const forbidden of [credentials.apiToken, credentials.accountId, 'private', 'secret provider', 'Route test']) {
    assert.equal(safeLog.includes(forbidden), false)
  }
  // Existing hourly limiter still stops request 31; timestamps are spaced beyond one minute.
  const originalNow = Date.now
  try {
    let now = originalNow()
    Date.now = () => now
    for (let index = 0; index < 30; index++, now += 110000) assert.equal(checkRateLimit('offline-hourly').allowed, true)
    assert.equal(checkRateLimit('offline-hourly').allowed, false)
  } finally { Date.now = originalNow }
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  for (const [name, value] of savedEnv) { if (value === undefined) delete process.env[name]; else process.env[name] = value }
  console.error = originalConsoleError
  globalThis.fetch = originalFetch
}
console.log('HudHud offline tests passed: Cloudflare REST transport, 14 English + 14 Bangla + mixed-language cases, fact/task/assistant context, six-turn/character budgets, session restoration and malformed/blocked storage, UI notice exclusion, safe provider failures, actual Express route and unchanged rate limits, one-call/no-retry behavior and environment validation. Live semantic quality is not evaluated by mocks.')
