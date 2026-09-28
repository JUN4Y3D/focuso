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
  'MINIMUM SUFFICIENT ANSWER — highest response-style priority',
  "Answer only the specific information required to satisfy the user's current question.",
  'Do not provide adjacent facts simply because they are available.',
  'Stop once the question is fully answered.',
  'silently identify the exact intent, the minimum information needed, and related but unrequested facts',
  'Use progressive disclosure: start with the smallest useful answer.',
  'explicitly requests a list/explanation/comparison',
  'Do NOT anticipate every possible follow-up.',
  'Respect explicitly requested multi-part questions without adding other topics.',
  'Only disclose model/provider when explicitly asked',
  'simple greeting only',
  'Do not introduce HudHud, FOCUSO, model/provider, capabilities or limitations unless asked.',
  'only what it is and its main purpose',
  'A broad overview is NOT a request for every feature.',
  'only the main practical benefits',
  'Price ("How much is the planner?"): price directly',
  'Delivery ("How much is delivery?"): delivery pricing only',
  'Coupon ("Can I use FOCUS25?"): coupon behavior only',
  'do not append a follow-up question to every response.',
  'Answer the question. Use only relevant recent context. Stop when the answer is complete.',
  'Mention a limitation only when the user asks for a fact or action you cannot provide',
  'greeting 5–15 words', 'simple fact 5–30 words', 'product overview 25–60 words',
  'benefits 20–60 words', 'normal productivity advice 40–100 words',
  'These are NOT minimums: never pad an already sufficient answer.',
  '1–3 short sentences', '2–4 compact bullets',
  'No **bold**, ## headings, ### sections',
  'short paragraphs separated by a blank line',
  'Do not mention FOCUSO or the planner in general productivity advice unless',
  'relevant recent user AND assistant messages, not as isolated questions',
  'Context identifies intent; it is NOT permission to repeat unrelated information from earlier turns.',
  '"How much?" means price only: do not repeat the overview',
  'Relevance must never suppress necessary safety guidance.',
  'Never request PINs, OTPs, passwords, or credentials.',
  'No confirmed delivery timeframe is published.',
  'floor fractional BDT discounts; delivery is never discounted.',
  'no translated-sounding or overly formal Bangla',
  'a short Qur\'an verse on the daily page',
  'Do not infer an extra reading/reflection space',
]) assert.ok(HUDHUD_SYSTEM_INSTRUCTION.includes(rule), `Missing response-quality instruction: ${rule}`)
assert.doesNotMatch(HUDHUD_SYSTEM_INSTRUCTION, /daily Qur'an reading space|40–120 words|1–4 short sentences/)

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
  modelRequested?: boolean
  limitationRequested?: boolean
  scope?: 'greeting' | 'overview' | 'benefits' | 'price' | 'delivery' | 'coupon' | 'features'
}
const english: QualityCase[] = [
  { prompt: 'Who are you?', raw: "I'm HudHud, FOCUSO's AI productivity assistant.", expected: "I'm HudHud, FOCUSO's AI productivity assistant.", identity: true },
  { prompt: 'What model are you using?', raw: "I'm powered by **GLM-4.7-Flash** through Cloudflare Workers AI.", expected: "I'm powered by GLM-4.7-Flash through Cloudflare Workers AI.", identity: true, modelRequested: true },
  { prompt: 'powered by?', history: [user('What model are you using?'), assistant('GLM-4.7-Flash through Cloudflare Workers AI.')], raw: 'GLM-4.7-Flash, served through Cloudflare Workers AI.', expected: 'GLM-4.7-Flash, served through Cloudflare Workers AI.', identity: true, modelRequested: true },
  { prompt: 'Who made HudHud?', raw: 'FOCUSO built the HudHud assistant experience.', expected: 'FOCUSO built the HudHud assistant experience.', identity: true },
  { prompt: 'Are you Gemini?', raw: 'No. HudHud uses GLM-4.7-Flash through Cloudflare Workers AI.', expected: 'No. HudHud uses GLM-4.7-Flash through Cloudflare Workers AI.', identity: true, modelRequested: true },
  { prompt: 'Help me prioritize.', raw: 'Start with the task that has the biggest consequence if delayed. What tasks and deadlines are you working with?', expected: 'Start with the task that has the biggest consequence if delayed. What tasks and deadlines are you working with?', generalAdvice: true },
  { prompt: 'I have 3 tasks.', raw: 'What are the three tasks, and when are they due?', expected: 'What are the three tasks, and when are they due?', generalAdvice: true },
  { prompt: 'Which one should I do first?', history: [user('Accounting is due tonight; my calculus exam is Monday.'), assistant('Finish accounting, then study calculus.')], raw: 'Finish accounting first; it is due tonight. Then spend 45 minutes on calculus.', expected: 'Finish accounting first; it is due tonight. Then spend 45 minutes on calculus.', generalAdvice: true },
  { prompt: 'What should I do first?', raw: 'Pick the nearest high-consequence deadline and work on its first step for 25 minutes.', expected: 'Pick the nearest high-consequence deadline and work on its first step for 25 minutes.', generalAdvice: true },
  { prompt: 'Make that shorter.', history: [user('Give me an evening routine.'), assistant('Finish accounting, review calculus, then plan tomorrow.')], raw: '**Accounting first.** Calculus next. Then plan tomorrow.', expected: 'Accounting first. Calculus next. Then plan tomorrow.', generalAdvice: true },
  { prompt: 'How much is the planner?', raw: 'The FOCUSO Daily Planner is ৳250 per unit.', expected: 'The FOCUSO Daily Planner is ৳250 per unit.', scope: 'price' },
  { prompt: 'Can I use FOCUS25?', raw: 'FOCUS25 gives 25% off the product subtotal; delivery is not discounted. Checkout confirms current eligibility.', expected: 'FOCUS25 gives 25% off the product subtotal; delivery is not discounted. Checkout confirms current eligibility.', scope: 'coupon' },
  { prompt: 'How long does delivery take?', raw: 'FOCUSO has not published a confirmed delivery timeframe.', expected: 'FOCUSO has not published a confirmed delivery timeframe.', limitationRequested: true },
  { prompt: 'When is my exam?', history: [user('My exam is Monday.'), assistant('Study one chapter each session before Monday.')], raw: 'Your exam is on Monday.', expected: 'Your exam is on Monday.' },
]
const bangla: QualityCase[] = [
  { prompt: 'তুমি কে?', raw: 'আমি হুদহুদ, FOCUSO-এর AI প্রডাক্টিভিটি সহকারী।', expected: 'আমি হুদহুদ, FOCUSO-এর AI প্রডাক্টিভিটি সহকারী।', identity: true },
  { prompt: 'তুমি কোন মডেল ব্যবহার করো?', raw: 'আমি **GLM-4.7-Flash** ব্যবহার করি, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'আমি GLM-4.7-Flash ব্যবহার করি, Cloudflare Workers AI-এর মাধ্যমে।', identity: true, modelRequested: true },
  { prompt: 'কিসের মাধ্যমে চলে?', history: [user('তুমি কোন মডেল ব্যবহার করো?'), assistant('আমি GLM-4.7-Flash ব্যবহার করি।')], raw: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', identity: true, modelRequested: true },
  { prompt: 'হুদহুদ কে বানিয়েছে?', raw: 'FOCUSO হুদহুদ তৈরি করেছে।', expected: 'FOCUSO হুদহুদ তৈরি করেছে।', identity: true },
  { prompt: 'তুমি কি Gemini?', raw: 'না। হুদহুদ GLM-4.7-Flash ব্যবহার করে, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'না। হুদহুদ GLM-4.7-Flash ব্যবহার করে, Cloudflare Workers AI-এর মাধ্যমে।', identity: true, modelRequested: true },
  { prompt: 'কাজের অগ্রাধিকার ঠিক করে দিন।', raw: 'যে কাজ দেরি হলে সবচেয়ে বেশি সমস্যা হবে, সেটা আগে ধরুন। কোন কাজগুলো বাকি, আর কবে শেষ করতে হবে?', expected: 'যে কাজ দেরি হলে সবচেয়ে বেশি সমস্যা হবে, সেটা আগে ধরুন। কোন কাজগুলো বাকি, আর কবে শেষ করতে হবে?', generalAdvice: true },
  { prompt: 'আমার ৩টি কাজ আছে।', raw: 'কাজ তিনটি কী, আর কোনটা কবে শেষ করতে হবে?', expected: 'কাজ তিনটি কী, আর কোনটা কবে শেষ করতে হবে?', generalAdvice: true },
  { prompt: 'কোনটা আগে করব?', history: [user('অ্যাসাইনমেন্ট আজ রাতে জমা দিতে হবে, পরীক্ষা সোমবার।'), assistant('আগে অ্যাসাইনমেন্ট, তারপর পরীক্ষার পড়া।')], raw: 'অ্যাসাইনমেন্ট আগে শেষ করুন—আজ রাতেই জমা দিতে হবে। তারপর ৪৫ মিনিট পড়ুন।', expected: 'অ্যাসাইনমেন্ট আগে শেষ করুন—আজ রাতেই জমা দিতে হবে। তারপর ৪৫ মিনিট পড়ুন।', generalAdvice: true },
  { prompt: 'আরও ছোট করুন।', history: [user('সন্ধ্যার রুটিন দিন।'), assistant('অ্যাসাইনমেন্ট শেষ করুন, পড়ুন, তারপর কালকের কাজ ঠিক করুন।')], raw: '**অ্যাসাইনমেন্ট আগে।** তারপর পড়া, শেষে কালকের পরিকল্পনা।', expected: 'অ্যাসাইনমেন্ট আগে। তারপর পড়া, শেষে কালকের পরিকল্পনা।', generalAdvice: true },
  { prompt: 'প্ল্যানারের দাম কত?', raw: 'FOCUSO Daily Planner-এর দাম প্রতি ইউনিট ৳২৫০।', expected: 'FOCUSO Daily Planner-এর দাম প্রতি ইউনিট ৳২৫০।', scope: 'price' },
  { prompt: 'FOCUS25 ব্যবহার করতে পারি?', raw: 'FOCUS25 পণ্যের দামে ২৫% ছাড় দেয়, ডেলিভারি চার্জে নয়। চেকআউটে এখন কোডটি প্রযোজ্য কি না দেখাবে।', expected: 'FOCUS25 পণ্যের দামে ২৫% ছাড় দেয়, ডেলিভারি চার্জে নয়। চেকআউটে এখন কোডটি প্রযোজ্য কি না দেখাবে।', scope: 'coupon' },
  { prompt: 'ডেলিভারি পেতে কত দিন লাগবে?', raw: 'FOCUSO এখনো নিশ্চিত ডেলিভারি সময় জানায়নি।', expected: 'FOCUSO এখনো নিশ্চিত ডেলিভারি সময় জানায়নি।', limitationRequested: true },
  { prompt: 'আমার পরীক্ষা কবে?', history: [user('আমার পরীক্ষা সোমবার।'), assistant('সোমবারের আগে পড়া ভাগ করে নিন।')], raw: 'আপনার পরীক্ষা সোমবার।', expected: 'আপনার পরীক্ষা সোমবার।' },
]
const mixed: QualityCase = { prompt: 'powered by?', history: [user('তুমি কোন model ব্যবহার করো?'), assistant('GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।')], raw: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', expected: 'GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।', identity: true, modelRequested: true }
const scoped = (prompt: string, reply: string, options: Omit<QualityCase, 'prompt' | 'raw' | 'expected'>): QualityCase =>
  ({ prompt, raw: reply, expected: reply, ...options })
const overview = 'The FOCUSO Daily Planner is an undated 60-day planner designed to help you organize your days, focus on priorities, and build consistent habits.'
const benefits = 'It helps you turn your priorities into a clear daily plan and stay consistent with the habits that matter. The 60-day format keeps the system focused and manageable.'
const bnOverview = 'FOCUSO Daily Planner একটি তারিখবিহীন ৬০ দিনের প্ল্যানার। দিনের কাজ গুছিয়ে নিতে, অগ্রাধিকার ঠিক করতে আর নিয়মিত অভ্যাস গড়তে সাহায্য করে।'
const minimumEnglish: QualityCase[] = [
  ...['Hi', 'Hello', 'Hey'].map(prompt => scoped(prompt, 'Hi 👋 How can I help?', { scope: 'greeting' })),
  scoped('Assalamu Alaikum', 'Wa Alaikum Assalam 👋 How can I help?', { scope: 'greeting' }),
  scoped('Tell me about the planner.', overview, { scope: 'overview' }),
  scoped('Why should I use the planner?', benefits, { scope: 'benefits' }),
  scoped('How much is delivery?', 'Delivery is ৳60 in Chattogram and ৳100 in other valid Bangladesh districts.', { scope: 'delivery' }),
  scoped('How much?', 'The FOCUSO Daily Planner is ৳250.', { scope: 'price', history: [user('Tell me about the planner.'), assistant(overview)] }),
  scoped('What about price?', 'The FOCUSO Daily Planner is ৳250.', { scope: 'price', history: [user('Tell me about the planner.'), assistant(overview), user('How much is delivery?'), assistant('Delivery is ৳60 in Chattogram and ৳100 elsewhere in Bangladesh.')] }),
  scoped('Tell me more.', 'Monthly, weekly and daily pages connect your goals to daily priorities, tasks and habits.', { scope: 'features', history: [user('Tell me about the planner.'), assistant(overview)] }),
  scoped('Why?', 'A clear daily plan reduces the need to decide what to work on each time you sit down.', { scope: 'benefits', history: [user('Why should I use the planner?'), assistant(benefits)] }),
  scoped('How?', 'Choose one priority for today, schedule a focused block for it, and review your progress tonight.', { generalAdvice: true, history: [user('Why should I use the planner?'), assistant(benefits)] }),
  scoped('Tell me about the planner.', overview, { scope: 'overview', history: [user('What model are you using?'), assistant('GLM-4.7-Flash through Cloudflare Workers AI.')] }),
  scoped('List the key planner features.', '- Monthly, weekly and daily planning\n- Daily priorities, tasks and schedule\n- Habit and Salah tracking\n- A short daily Qur\'an verse', { scope: 'features' }),
  scoped('How much is the planner and delivery?', 'The planner is ৳250. Delivery is ৳60 in Chattogram and ৳100 in other valid Bangladesh districts.', {}),
  scoped('Can you track my order?', 'I cannot track orders from this chat.', { limitationRequested: true }),
]
const minimumBangla: QualityCase[] = [
  scoped('হাই', 'হাই 👋 কীভাবে সাহায্য করতে পারি?', { scope: 'greeting' }),
  scoped('আসসালামু আলাইকুম', 'ওয়া আলাইকুম আসসালাম 👋 কীভাবে সাহায্য করতে পারি?', { scope: 'greeting' }),
  scoped('প্ল্যানার সম্পর্কে বলো।', bnOverview, { scope: 'overview' }),
  scoped('প্ল্যানার কেন ব্যবহার করব?', 'অগ্রাধিকারগুলোকে দিনের স্পষ্ট পরিকল্পনায় সাজাতে আর গুরুত্বপূর্ণ অভ্যাসে নিয়মিত থাকতে সাহায্য করে। ৬০ দিনের কাঠামো পরিকল্পনাটা ছোট ও সামলানো সহজ রাখে।', { scope: 'benefits' }),
  scoped('ডেলিভারি চার্জ কত?', 'চট্টগ্রামে ডেলিভারি ৳৬০, বাংলাদেশের অন্য বৈধ জেলায় ৳১০০।', { scope: 'delivery' }),
  scoped('দাম কত?', 'FOCUSO Daily Planner-এর দাম ৳২৫০।', { scope: 'price', history: [user('প্ল্যানার সম্পর্কে বলো।'), assistant(bnOverview)] }),
  scoped('আরও বলো।', 'মাসিক, সাপ্তাহিক ও দৈনিক পাতায় লক্ষ্য থেকে দিনের কাজ সাজাতে পারবেন। অগ্রাধিকার, কাজ, অভ্যাস ও নামাজ ট্র্যাক করার ব্যবস্থা আছে।', { scope: 'features', history: [user('প্ল্যানার সম্পর্কে বলো।'), assistant(bnOverview)] }),
  scoped('কীভাবে?', 'আজকের একটি জরুরি কাজ বেছে নিন, সেটার জন্য সময় রাখুন, আর রাতে কতটুকু হলো দেখুন।', { generalAdvice: true, history: [user('প্ল্যানার কীভাবে সাহায্য করে?'), assistant('দিনের অগ্রাধিকার ঠিক করে কাজের সময় রাখুন।')] }),
  scoped('প্ল্যানার সম্পর্কে বলো।', bnOverview, { scope: 'overview', history: [user('কোন মডেল ব্যবহার করো?'), assistant('GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।')] }),
  scoped('আগে কী করব?', 'আজ রাতে জমা দেওয়ার কাজটি আগে শেষ করুন।', { generalAdvice: true, history: [user('কোন মডেল ব্যবহার করো?'), assistant('GLM-4.7-Flash, Cloudflare Workers AI-এর মাধ্যমে।'), user('আজ রাতে অ্যাসাইনমেন্ট, পরীক্ষা সোমবার।'), assistant('অ্যাসাইনমেন্ট আগে করুন।')] }),
]

// Test-only scope checks: fail on adjacent facts, not a production regex filter.
// Fixtures specify desired answers; these checks do not measure live model obedience.
function assertMinimumSufficientFixture(reply: string, fixture: QualityCase) {
  const commerce = /৳|FOCUS25|coupon|delivery|shipping|payment|bKash|cash on delivery|কুপন|ডেলিভারি|পেমেন্ট|বিকাশ|ছাড়/iu
  const features = /undated|60-day|monthly|weekly|habit|Salah|Qur'an|তারিখবিহীন|অভ্যাস|সাপ্তাহিক|মাসিক|নামাজ|কুরআন/iu
  if (!fixture.modelRequested) assert.doesNotMatch(reply, /GLM|Cloudflare|Gemini|ChatGPT|OpenAI/iu, 'No proactive model/provider disclosure.')
  if (!fixture.limitationRequested) assert.doesNotMatch(reply,
    /cannot (?:track|verify|provide)|can't (?:track|verify|provide)|not published|not confirmed|unpublished|timeframe|সময় জানায়নি|যাচাই করতে পারি না|ট্র্যাক করতে পারি না/iu,
    'No unrequested limitation/footer.')
  switch (fixture.scope) {
    case 'greeting':
      assert.ok(reply.split(/\s+/u).length <= 15)
      assert.doesNotMatch(reply, commerce)
      assert.doesNotMatch(reply, /HudHud|FOCUSO|planner|assistant|capabilit|limitation|\bAI\b|হুদহুদ|প্ল্যানার|সহকারী/iu)
      break
    case 'overview': case 'benefits':
      assert.ok(reply.split(/\s+/u).length <= 60)
      assert.ok((reply.match(/[.!?।](?=\s|$)/gu) || []).length <= 3)
      assert.doesNotMatch(reply, commerce)
      assert.doesNotMatch(reply, /^\s*(?:[-*]|\d+[.)])\s/m, 'No unsolicited feature list.')
      break
    case 'price':
      assert.ok(reply.split(/\s+/u).length <= 30)
      assert.match(reply, /৳(?:250|২৫০)/u)
      assert.doesNotMatch(reply, /FOCUS25|coupon|delivery|shipping|payment|bKash|কুপন|ডেলিভারি|পেমেন্ট|বিকাশ/iu)
      assert.doesNotMatch(reply, features)
      break
    case 'delivery':
      assert.ok(reply.split(/\s+/u).length <= 30)
      assert.match(reply, /৳(?:60|৬০)/u)
      assert.match(reply, /৳(?:100|১০০)/u)
      assert.doesNotMatch(reply, /FOCUSO|planner|FOCUS25|coupon|payment|bKash|প্ল্যানার|কুপন|পেমেন্ট|বিকাশ/iu)
      assert.doesNotMatch(reply, features)
      break
    case 'coupon':
      assert.match(reply, /FOCUS25/u)
      assert.doesNotMatch(reply, /৳|payment|bKash|পেমেন্ট|বিকাশ/iu)
      assert.doesNotMatch(reply, features)
      break
    case 'features': assert.doesNotMatch(reply, commerce); break
  }
}
// Prove the fixture assertions catch the supplied bad patterns and follow-up leakage.
for (const [reply, fixture] of [
  ["Hi. I'm HudHud, FOCUSO's AI productivity assistant. I'm powered by GLM-4.7-Flash through Cloudflare Workers AI.", minimumEnglish[0]],
  [`${overview} The price is ৳250, delivery ৳60.`, minimumEnglish[4]],
  [`${overview} Delivery timeframe is not published.`, minimumEnglish[4]],
  [`${benefits} Pay with bKash.`, minimumEnglish[5]],
  [`${overview} The price is ৳250.`, minimumEnglish[7]],
  [`${bnOverview} ডেলিভারি ৳৬০।`, minimumBangla[2]],
] as const) assert.throws(() => assertMinimumSufficientFixture(reply, fixture), assert.AssertionError)
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
  for (const fixture of [...english, ...bangla, mixed, ...minimumEnglish, ...minimumBangla]) {
    activeCase = fixture
    const before = calls
    const response = await generateHudHudReply(ChatBodySchema.parse({
      messages: recentHudHudContext(fixture.history || [], user(fixture.prompt)),
    }), { accountId: '0'.repeat(32), apiToken: 'offline-test-token' })
    assert.equal(calls, before + 1)
    assert.equal(response.model, CHAT_MODEL)
    assert.equal(response.reply, fixture.expected)
    assert.ok(response.reply.split(/\s+/u).length <= 120)
    assertMinimumSufficientFixture(response.reply, fixture)
    assert.doesNotMatch(response.reply, /\*\*|^\s*#{2,3}\s|Great question|As an AI|comprehensive breakdown/im)
    if (fixture.identity) assert.doesNotMatch(response.reply, /invoice|order status|payment|delivery|refund|tracking|চালান|অর্ডার|পেমেন্ট|ডেলিভারি|রিফান্ড|ট্র্যাকিং/iu)
    if (fixture.generalAdvice) assert.doesNotMatch(response.reply, /FOCUSO|planner|প্ল্যানার/iu)
  }
} finally { globalThis.fetch = originalFetch }
console.log(`HudHud response-quality regressions passed: prompt contract, formatting/code preservation, ${english.length + minimumEnglish.length} English + ${bangla.length + minimumBangla.length} Bangla + 1 mixed fixture, minimum-sufficient intent scope, progressive disclosure, identity/context/relevance/conciseness/product-promotion checks and one-call transport. Fixtures do not prove live semantic quality.`)
