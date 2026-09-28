/**
 * FOCUSO Chatbot Knowledge & Business Rules Verification Suite
 *
 * Tests the 6 required queries:
 * 1. "How much is the planner?"
 * 2. "Delivery charge in Chattogram?"
 * 3. "Delivery charge in Dhaka?"
 * 4. "What is FOCUS25?"
 * 5. "Can I pay with bKash?"
 * 6. "How long will delivery take?"
 *
 * Also verifies:
 * - Configured model is strictly gemini-3.8-flash
 * - No invented timeframe for #6
 * - Correct Chattogram (৳60) vs Dhaka (৳100) delivery charges
 * - FOCUS25 25% discount on product subtotal only
 * - Manual bKash Send Money & pending verification (not automated gateway)
 */

import assert from 'node:assert/strict'

const BASE_URL = 'http://127.0.0.1:3000'

async function askChatbot(promptText: string): Promise<{ reply: string; model: string }> {
  // Use unique IP per query to prevent rate-limiting between test cases
  const uniqueIp = `172.16.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`

  let res: Response | null = null
  let data: any = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': uniqueIp,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: promptText }],
      }),
    })

    data = await res.json()
    if (res.status === 200) {
      break
    }
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      console.log(`Notice: Upstream busy (HTTP ${res.status}). Waiting 2s before retry...`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  assert.equal(res?.status, 200, `Expected HTTP 200 for prompt "${promptText}", got ${res?.status}: ${JSON.stringify(data)}`)
  assert.equal(data.model, 'gemini-3.8-flash', `Expected model gemini-3.8-flash, got ${data.model}`)
  return { reply: data.reply, model: data.model }
}

async function runKnowledgeTests() {
  console.log('===============================================================')
  console.log('FOCUSO Chatbot Authoritative Knowledge Verification Suite')
  console.log('===============================================================\n')

  // Query 1: How much is the planner?
  console.log('--- Query 1: "How much is the planner?" ---')
  const q1 = await askChatbot('How much is the planner?')
  console.log('Response:\n', q1.reply.trim())
  console.log('Model:', q1.model)
  assert.ok(q1.reply.includes('250'), 'Q1 reply must state ৳250')
  console.log('✓ Q1 Passed: Stated ৳250 price.\n')

  // Query 2: Delivery charge in Chattogram?
  console.log('--- Query 2: "Delivery charge in Chattogram?" ---')
  const q2 = await askChatbot('Delivery charge in Chattogram?')
  console.log('Response:\n', q2.reply.trim())
  console.log('Model:', q2.model)
  assert.ok(q2.reply.includes('60'), 'Q2 reply must state ৳60 for Chattogram')
  console.log('✓ Q2 Passed: Stated ৳60 delivery charge for Chattogram.\n')

  // Query 3: Delivery charge in Dhaka?
  console.log('--- Query 3: "Delivery charge in Dhaka?" ---')
  const q3 = await askChatbot('Delivery charge in Dhaka?')
  console.log('Response:\n', q3.reply.trim())
  console.log('Model:', q3.model)
  assert.ok(q3.reply.includes('100'), 'Q3 reply must state ৳100 for Dhaka')
  console.log('✓ Q3 Passed: Stated ৳100 delivery charge for Dhaka.\n')

  // Query 4: What is FOCUS25?
  console.log('--- Query 4: "What is FOCUS25?" ---')
  const q4 = await askChatbot('What is FOCUS25?')
  console.log('Response:\n', q4.reply.trim())
  console.log('Model:', q4.model)
  assert.ok(q4.reply.includes('25%') || q4.reply.includes('25 percent'), 'Q4 reply must state 25% discount')
  assert.ok(
    q4.reply.toLowerCase().includes('subtotal') || q4.reply.toLowerCase().includes('product'),
    'Q4 reply should clarify it applies to the product/subtotal'
  )
  console.log('✓ Q4 Passed: Correctly explained FOCUS25.\n')

  // Query 5: Can I pay with bKash?
  console.log('--- Query 5: "Can I pay with bKash?" ---')
  const q5 = await askChatbot('Can I pay with bKash?')
  console.log('Response:\n', q5.reply.trim())
  console.log('Model:', q5.model)
  const q5Lower = q5.reply.toLowerCase()
  assert.ok(q5Lower.includes('bkash'), 'Q5 reply must address bKash')
  assert.ok(
    q5Lower.includes('manual') || q5Lower.includes('send money') || q5Lower.includes('transaction id') || q5Lower.includes('trxid'),
    'Q5 reply must describe manual Send Money / TrxID'
  )
  assert.ok(
    !q5Lower.includes('gateway') || q5Lower.includes('not') || q5Lower.includes('no gateway'),
    'Q5 reply must NOT claim an automated bKash Payment Gateway'
  )
  assert.ok(
    q5Lower.includes('pending') || q5Lower.includes('verif'),
    'Q5 reply must mention pending verification'
  )
  console.log('✓ Q5 Passed: Accurately described manual bKash Send Money & pending verification.\n')

  // Query 6: How long will delivery take?
  console.log('--- Query 6: "How long will delivery take?" ---')
  const q6 = await askChatbot('How long will delivery take?')
  console.log('Response:\n', q6.reply.trim())
  console.log('Model:', q6.model)
  const q6Lower = q6.reply.toLowerCase()
  assert.ok(
    !q6Lower.includes('2-3 business days') && !q6Lower.includes('2–3 business days') && !q6Lower.includes('2 to 3 days'),
    'Q6 reply must not invent a 2–3 business days timeframe'
  )
  assert.ok(
    q6Lower.includes('not') || q6Lower.includes('specified') || q6Lower.includes('unspecified') || q6Lower.includes('exact timeframe'),
    'Q6 reply must indicate exact delivery timeframe is not currently specified'
  )
  console.log('✓ Q6 Passed: Did not invent timeframe; confirmed unspecified.\n')

  console.log('===============================================================')
  console.log('ALL 6 AUTHORITATIVE KNOWLEDGE TESTS PASSED')
  console.log('Model confirmed on all responses: gemini-3.8-flash')
  console.log('===============================================================')
}

runKnowledgeTests().catch((err) => {
  console.error('Chatbot knowledge test suite failed:', err)
  process.exit(1)
})
