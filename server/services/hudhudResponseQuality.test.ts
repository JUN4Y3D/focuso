import assert from 'node:assert/strict'
import {
  CHAT_MODEL, MAX_OUTPUT_TOKENS, HUDHUD_SYSTEM_INSTRUCTION, ChatBodySchema,
  generateHudHudReply, completeHudHudReply, plainHudHudText,
} from './hudhudChat.js'
import { recentHudHudContext, type HudHudChatMessage } from '../../src/lib/hudhudConversation.js'

// These are prompt-contract and real transport/formatting regressions with fixtures,
// NOT an evaluation of the live model's semantic compliance with the instructions.
assert.equal(CHAT_MODEL, '@cf/zai-org/glm-4.7-flash')
assert.equal(MAX_OUTPUT_TOKENS, 350)
for (const rule of [
  `Exact backend model: ${CHAT_MODEL}`,
  'Underlying model: GLM-4.7-Flash. Provider/runtime: Cloudflare Workers AI.',
  'FOCUSO built the HudHud product experience; it did not create or train the underlying model.',
  "I'm HudHud, FOCUSO's AI productivity assistant.",
  "I'm powered by GLM-4.7-Flash through Cloudflare Workers AI.",
  'GLM-4.7-Flash, served through Cloudflare Workers AI.',
  'No. HudHud uses GLM-4.7-Flash through Cloudflare Workers AI.',
  'আমি GLM-4.7-Flash ব্যবহার করি, Cloudflare Workers AI-এর মাধ্যমে।',
  'Answer the question. Use only relevant recent context. Stop when the answer is complete.',
  'Mention a limitation only when the user asks for a fact or action you cannot provide',
  'Short by default; detailed only when asked or needed for a usable plan.',
  '1–4 short sentences', '2–4 compact bullets', '40–120 words, not a minimum',
  'No **bold**, ## headings, ### sections',
  'short paragraphs separated by a blank line',
  'Do not mention FOCUSO or the planner in general productivity advice unless',
  'relevant recent user AND assistant messages, not as isolated questions',
  'Relevance must never suppress necessary safety guidance.',
  'Never request PINs, OTPs, passwords, or credentials.',
  'No confirmed delivery timeframe is published.',
  'floor fractional BDT discounts; delivery is never discounted.',
  'no translated-sounding or overly formal Bangla',
]) assert.ok(HUDHUD_SYSTEM_INSTRUCTION.includes(rule), `Missing response-quality instruction: ${rule}`)

const formattingCases = [
  ['**Allocate 45 minutes** to the assignment.', 'Allocate 45 minutes to the assignment.'],
  ['## Tonight\n\n**Finish the assignment.**\n* Review calculus.', 'Tonight\n\nFinish the assignment.\n- Review calculus.'],
  ['### অগ্রাধিকার\n\n**আগে অ্যাসাইনমেন্ট শেষ করুন।**\n* তারপর পড়ুন।', 'অগ্রাধিকার\n\nআগে অ্যাসাইনমেন্ট শেষ করুন।\n- তারপর পড়ুন।'],
  ['One short paragraph.\n\nA second short paragraph.', 'One short paragraph.\n\nA second short paragraph.'],
  ['C# and #FOCUSO are literal text.', 'C# and #FOCUSO are literal text.'],
  ['2**3**2 = 512; 2 ** 3 ** 2 = 512.', '2**3**2 = 512; 2 ** 3 ** 2 = 512.'],
  ['Use `2**3` or `## title` as literal code.', 'Use `2**3` or `## title` as literal code.'],
  ['**Example:**\n```python\n# Compute powers\nprint(2**3**2)\n```', 'Example:\n```python\n# Compute powers\nprint(2**3**2)\n```'],
  ['GLM-4.7-Flash through Cloudflare Workers AI.', 'GLM-4.7-Flash through Cloudflare Workers AI.'],
  ['Payment and refund information is relevant to this question.', 'Payment and refund information is relevant to this question.'],
  [' First.\r\n\r\nSecond. ', 'First.\n\nSecond.'],
] as const
for (const [raw, expected] of formattingCases) {
  assert.equal(plainHudHudText(raw), expected)
  assert.equal(plainHudHudText(expected), expected, 'Plain-text cleanup must be idempotent.')
  assert.equal(completeHudHudReply(raw, false), expected)
}
assert.equal(completeHudHudReply('**Finish one task.** Then an incomplete', true), 'Finish one task.')
assert.equal(completeHudHudReply('**আগে একটি কাজ শেষ করুন।** তারপর অসম্পূর্ণ', true), 'আগে একটি কাজ শেষ করুন।')

const user = (content: string): HudHudChatMessage => ({ role: 'user', content })
const assistant = (content: string): HudHudChatMessage => ({ role: 'assistant', content })
interface QualityCase {
  prompt: string
  raw: string
  expected: string
  history?: HudHudChatMessage[]
  identity?: boolean
  generalAdvice?: boolean
}
const english: QualityCase[] = [
  { prompt: 'Who are you?', raw: "I'm HudHud, FOCUSO's AI productivity assistant.", expected: "I'm HudHud, FOCUSO's AI productivity assistant.", identity: true },
  { prompt: 'What model are you using?', raw: "I'm powered by **GLM-4.7-Flash** through Cloudflare Workers AI.", expected: "I'm powered by GLM-4.7-Flash through Cloudflare Workers AI.", identity: true },
  { prompt: 'powered by?', history: [user('What model are you using?'), assistant('GLM-4.7-Flash through Cloudflare Workers AI.')], raw: 'GLM-4.7-Flash, served through Cloudflare Workers AI.', expected: 'GLM-4.7-Flash, served through Cloudflare Workers AI.', identity: true },
  { prompt: 'Who made HudHud?', raw: 'FOCUSO built HudHud. The underlying model is GLM-4.7-Flash.', expected: 'FOCUSO built HudHud. The underlying model is GLM-4.7-Flash.', identity: true },
  { prompt: 'Are you Gemini?', raw: 'No. HudHud uses GLM-4.7-Flash through Cloudflare Workers AI.', expected: 'No. HudHud uses GLM-4.7-Flash through Cloudflare Workers AI.', identity: true },
  { prompt: 'Help me prioritize.', raw: 'Start with the task that has the biggest consequence if delayed. What tasks and deadlines are you working with?', expected: 'Start with the task that has the biggest consequence if delayed. What tasks and deadlines are you working with?', generalAdvice: true },
  { prompt: 'I have 3 tasks.', raw: 'What are the three tasks, and when are they due?', expected: 'What are the three tasks, and when are they due?', generalAdvice: true },
  { prompt: 'Which one should I do first?', history: [user('Accounting is due tonight; my calculus exam is Monday.'), assistant('Finish accounting, then study calculus.')], raw: 'Finish accounting first; it is due tonight. Then spend 45 minutes on calculus.', expected: 'Finish accounting first; it is due tonight. Then spend 45 minutes on calculus.', generalAdvice: true },
  { prompt: 'What should I do first?', raw: 'Pick the nearest high-consequence deadline and work on its first step for 25 minutes.', expected: 'Pick the nearest high-consequence deadline and work on its first step for 25 minutes.', generalAdvice: true },
  { prompt: 'Make that shorter.', history: [user('Give me an evening routine.'), assistant('Finish accounting, review calculus, then plan tomorrow.')], raw: '**Accounting first.** Calculus next. Then plan tomorrow.', expected: 'Accounting first. Calculus next. Then plan tomorrow.', generalAdvice: true },
  { prompt: 'How much is the planner?', raw: 'The FOCUSO Daily Planner is ৳250 per unit.', expected: 'The FOCUSO Daily Planner is ৳250 per unit.' },
  { prompt: 'Can I use FOCUS25?', raw: 'FOCUS25 gives 25% off the product subtotal; delivery is not discounted. Checkout confirms current eligibility.', expected: 'FOCUS25 gives 25% off the product subtotal; delivery is not discounted. Checkout confirms current eligibility.' },
  { prompt: 'How long does delivery take?', raw: 'FOCUSO has not published a confirmed delivery timeframe.', expected: 'FOCUSO has not published a confirmed delivery timeframe.' },
  { prompt: 'When is my exam?', history: [user('My exam is Monday.'), assistant('Study one chapter each session before Monday.')], raw: 'Your exam is on Monday.', expected: 'Your exam is on Monday.' },
]
const bangla: QualityCase[] = [
  { prompt: 'তুমি কে?', raw: 'আমি হুদহুদ, FOCUSO-এর AI প্রডাক্টিভিটি সহকারী।', expected: 'আমি হুদহুদ, FOCUSO-এর AI প্রডাক্টিভিটি সহকারী।', identity: true },
  { prompt: 'তুমি কোন মডেল ব্যবহার করো?', raw: 'আমি **GLM-4.7-Flash** ব্যবহার করি, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'আমি GLM-4.7-Flash ব্যবহার করি, Cloudflare Workers AI-এর মাধ্যমে।', identity: true },
  { prompt: 'কিসের মাধ্যমে চলে?', history: [user('তুমি কোন মডেল ব্যবহার করো?'), assistant('আমি GLM-4.7-Flash ব্যবহার করি।')], raw: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', identity: true },
  { prompt: 'হুদহুদ কে বানিয়েছে?', raw: 'FOCUSO হুদহুদ তৈরি করেছে। এর মডেল GLM-4.7-Flash।', expected: 'FOCUSO হুদহুদ তৈরি করেছে। এর মডেল GLM-4.7-Flash।', identity: true },
  { prompt: 'তুমি কি Gemini?', raw: 'না। হুদহুদ GLM-4.7-Flash ব্যবহার করে, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'না। হুদহুদ GLM-4.7-Flash ব্যবহার করে, Cloudflare Workers AI-এর মাধ্যমে।', identity: true },
  { prompt: 'কাজের অগ্রাধিকার ঠিক করে দিন।', raw: 'যে কাজ দেরি হলে সবচেয়ে বেশি সমস্যা হবে, সেটা আগে ধরুন। কোন কাজগুলো বাকি, আর কবে শেষ করতে হবে?', expected: 'যে কাজ দেরি হলে সবচেয়ে বেশি সমস্যা হবে, সেটা আগে ধরুন। কোন কাজগুলো বাকি, আর কবে শেষ করতে হবে?', generalAdvice: true },
  { prompt: 'আমার ৩টি কাজ আছে।', raw: 'কাজ তিনটি কী, আর কোনটা কবে শেষ করতে হবে?', expected: 'কাজ তিনটি কী, আর কোনটা কবে শেষ করতে হবে?', generalAdvice: true },
  { prompt: 'কোনটা আগে করব?', history: [user('অ্যাসাইনমেন্ট আজ রাতে জমা দিতে হবে, পরীক্ষা সোমবার।'), assistant('আগে অ্যাসাইনমেন্ট, তারপর পরীক্ষার পড়া।')], raw: 'অ্যাসাইনমেন্ট আগে শেষ করুন—আজ রাতেই জমা দিতে হবে। তারপর ৪৫ মিনিট পড়ুন।', expected: 'অ্যাসাইনমেন্ট আগে শেষ করুন—আজ রাতেই জমা দিতে হবে। তারপর ৪৫ মিনিট পড়ুন।', generalAdvice: true },
  { prompt: 'আরও ছোট করুন।', history: [user('সন্ধ্যার রুটিন দিন।'), assistant('অ্যাসাইনমেন্ট শেষ করুন, পড়ুন, তারপর কালকের কাজ ঠিক করুন।')], raw: '**অ্যাসাইনমেন্ট আগে।** তারপর পড়া, শেষে কালকের পরিকল্পনা।', expected: 'অ্যাসাইনমেন্ট আগে। তারপর পড়া, শেষে কালকের পরিকল্পনা।', generalAdvice: true },
  { prompt: 'প্ল্যানারের দাম কত?', raw: 'FOCUSO Daily Planner-এর দাম প্রতি ইউনিট ৳২৫০।', expected: 'FOCUSO Daily Planner-এর দাম প্রতি ইউনিট ৳২৫০।' },
  { prompt: 'FOCUS25 ব্যবহার করতে পারি?', raw: 'FOCUS25 পণ্যের দামে ২৫% ছাড় দেয়, ডেলিভারি চার্জে নয়। চেকআউটে এখন কোডটি প্রযোজ্য কি না দেখাবে।', expected: 'FOCUS25 পণ্যের দামে ২৫% ছাড় দেয়, ডেলিভারি চার্জে নয়। চেকআউটে এখন কোডটি প্রযোজ্য কি না দেখাবে।' },
  { prompt: 'ডেলিভারি পেতে কত দিন লাগবে?', raw: 'FOCUSO এখনো নিশ্চিত ডেলিভারি সময় জানায়নি।', expected: 'FOCUSO এখনো নিশ্চিত ডেলিভারি সময় জানায়নি।' },
  { prompt: 'আমার পরীক্ষা কবে?', history: [user('আমার পরীক্ষা সোমবার।'), assistant('সোমবারের আগে পড়া ভাগ করে নিন।')], raw: 'আপনার পরীক্ষা সোমবার।', expected: 'আপনার পরীক্ষা সোমবার।' },
]
const mixed: QualityCase = { prompt: 'powered by?', history: [user('তুমি কোন model ব্যবহার করো?'), assistant('GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।')], raw: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', identity: true }
const originalFetch = globalThis.fetch
let calls = 0
let activeCase: QualityCase
try {
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${'0'.repeat(32)}/ai/run/${CHAT_MODEL}`)
    const body = JSON.parse(String(init?.body))
    assert.equal(body.messages[0].role, 'system')
    assert.equal(body.messages[0].content, HUDHUD_SYSTEM_INSTRUCTION)
    assert.equal(body.max_completion_tokens, 350)
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false })
    assert.deepEqual(body.messages.slice(1), [...(activeCase.history || []), user(activeCase.prompt)])
    calls++
    return Response.json({ success: true, result: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: activeCase.raw } }] } })
  }
  for (const fixture of [...english, ...bangla, mixed]) {
    activeCase = fixture
    const before = calls
    const response = await generateHudHudReply(ChatBodySchema.parse({
      messages: recentHudHudContext(fixture.history || [], user(fixture.prompt)),
    }), { accountId: '0'.repeat(32), apiToken: 'offline-test-token' })
    assert.equal(calls, before + 1)
    assert.equal(response.model, CHAT_MODEL)
    assert.equal(response.reply, fixture.expected)
    assert.ok(response.reply.split(/\s+/u).length <= 120)
    assert.doesNotMatch(response.reply, /\*\*|^\s*#{2,3}\s|Great question|As an AI|comprehensive breakdown/im)
    if (fixture.identity) assert.doesNotMatch(response.reply, /invoice|order status|payment|delivery|refund|tracking|চালান|অর্ডার|পেমেন্ট|ডেলিভারি|রিফান্ড|ট্র্যাকিং/iu)
    if (fixture.generalAdvice) assert.doesNotMatch(response.reply, /FOCUSO|planner|প্ল্যানার/iu)
  }
} finally { globalThis.fetch = originalFetch }
console.log(`HudHud response-quality regressions passed: prompt contract, formatting/code preservation, ${english.length} English + ${bangla.length} Bangla + 1 mixed fixture, identity/context/relevance/conciseness/product-promotion checks and one-call transport. Fixtures do not prove live semantic quality.`)
