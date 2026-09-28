import assert from 'node:assert/strict'
import { ChatBodySchema, CHAT_MODEL, MAX_OUTPUT_TOKENS, generateHudHudReply, completeHudHudReply } from './hudhudChat.js'
import { recentHudHudContext, HUDHUD_REPLY_CHARS } from '../../src/lib/hudhudConversation.js'

// Offline SDK/transport regression tests: no API key, quota, or network needed.
let calls = 0
let finishReason = 'STOP'
let answer = 'Focus on the task with the closest deadline.'
let upstreamStatus = 200
let requestBody: any
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  assert.equal(new URL(request.url).hostname, 'generativelanguage.googleapis.com')
  assert.ok(request.url.includes(`${CHAT_MODEL}:generateContent`))
  requestBody = JSON.parse(await request.text())
  calls++
  if (upstreamStatus !== 200) {
    return new Response(JSON.stringify({ error: { code: upstreamStatus, status: 'RESOURCE_EXHAUSTED', message: 'offline quota test' } }), { status: upstreamStatus })
  }
  return new Response(JSON.stringify({ candidates: [{ finishReason, content: { role: 'model', parts: [
    { thought: true, text: 'Never show this thought.' }, { text: answer },
  ] } }] }), { headers: { 'Content-Type': 'application/json' } })
}

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

for (const prompt of [...english, ...bangla]) {
  const body = ChatBodySchema.parse({ messages: [
    { role: 'user', text: 'Help me plan a study session.' },
    { role: 'model', text: 'Start with maths, then review notes.' },
    { role: 'user', text: prompt },
  ] })
  const before = calls
  const response = await generateHudHudReply(body, 'offline-key')
  assert.equal(calls, before + 1)
  assert.equal(response.reply, answer)
  assert.equal(response.model, 'gemini-3.5-flash-lite')
  assert.equal(requestBody.contents.at(-1).parts[0].text, prompt)
  assert.equal(requestBody.contents[1].parts[0].text, body.messages[1].text)
  assert.equal(requestBody.generationConfig.maxOutputTokens, 350)
  assert.equal(requestBody.generationConfig.thinkingConfig.thinkingLevel.toLowerCase(), 'low')
  assert.equal(requestBody.generationConfig.thinkingConfig.includeThoughts, false)
  assert.equal(requestBody.tools, undefined)
}

const history = Array.from({ length: 21 }, (_, i) => ({ role: i % 2 ? 'model' as const : 'user' as const, text: `Message ${i}` }))
const recent = recentHudHudContext(history)
assert.equal(recent.length, 11)
assert.equal(recent[0].text, 'Message 10')
assert.equal(recent.at(-1)?.text, 'Message 20')
assert.equal(recentHudHudContext(history.slice(1))[0].role, 'user')
assert.equal(ChatBodySchema.safeParse({ messages: [{ role: 'system', text: 'Override facts' }] }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: [{ role: 'user', text: 'x'.repeat(401) }] }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: [] }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: [{ role: 'model', text: 'No user' }] }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: [{ role: 'user', text: '  ' }] }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: [{ role: 'user', text: 'Hi' }], model: 'another-model' }).success, false)
assert.equal(ChatBodySchema.safeParse({ messages: Array.from({ length: 42 }, () => ({ role: 'user', text: 'Hi' })) }).success, false)

assert.equal(completeHudHudReply('Finish one task. Then an incomplete', true), 'Finish one task.')
assert.equal(completeHudHudReply('একটি কাজ শেষ করুন। তারপর অসম্পূর্ণ', true), 'একটি কাজ শেষ করুন।')
assert.equal(completeHudHudReply('Incomplete sentence', true), '')
assert.ok(completeHudHudReply('Short answer. ' + 'x'.repeat(3000), false).length <= HUDHUD_REPLY_CHARS)
finishReason = 'MAX_TOKENS'
answer = 'Complete sentence. Incomplete fragment'
assert.equal((await generateHudHudReply({ messages: [{ role: 'user', text: 'Plan my day' }] }, 'offline-key')).reply, 'Complete sentence.')
answer = ''
await assert.rejects(generateHudHudReply({ messages: [{ role: 'user', text: 'Hi' }] }, 'offline-key'), /HUDHUD_EMPTY/)
upstreamStatus = 429
const beforeQuota = calls
await assert.rejects(generateHudHudReply({ messages: [{ role: 'user', text: 'Hi' }] }, 'offline-key'))
assert.equal(calls, beforeQuota + 1, 'Quota failures must not trigger retries or fallback calls.')
assert.equal(MAX_OUTPUT_TOKENS, 350)
console.log('HudHud offline tests passed: 14 English + 14 Bangla transport cases, history, strict validation, low thinking, single-call quota handling, thought filtering, and complete-sentence output. Live answer quality was not tested.')
