/**
 * FOCUSO Chatbot Model & Functionality Verification Suite
 *
 * Verifies:
 * 1. Configured model is strictly 'gemini-3.8-flash'
 * 2. Response returns model: 'gemini-3.8-flash'
 * 3. No fallback to other models
 * 4. Input validation and edge cases
 * 5. Rate limiting integrity
 */

import assert from 'node:assert/strict'

const BASE_URL = 'http://127.0.0.1:3000'

async function runChatbotTests() {
  console.log('===============================================================')
  console.log('FOCUSO Chatbot Model Verification Test Suite')
  console.log('===============================================================\n')

  // 1. Live Chatbot call to /api/chat
  console.log('--- 1. Testing /api/chat with valid user message ---')
  let res: Response | null = null
  let data: any = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `192.168.10.${Math.floor(Math.random() * 200) + 10}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            text: 'What is the price of the FOCUSO planner in BDT?',
          },
        ],
      }),
    })

    data = await res.json()
    if (res.status === 200) {
      break
    }
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      console.log(`Notice: Upstream capacity busy (HTTP ${res.status}). Waiting 2s before retry ${attempt + 1}...`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  console.log('HTTP status:', res?.status)
  console.log('Response body:', JSON.stringify(data, null, 2))

  assert.equal(res?.status, 200, `Expected HTTP 200, got ${res?.status}`)
  assert.equal(typeof data.reply, 'string', 'Expected reply string')
  assert.ok(data.reply.length > 0, 'Reply should not be empty')

  console.log('\nExact configured model returned by API:', data.model)
  assert.equal(
    data.model,
    'gemini-3.8-flash',
    `Expected model to be gemini-3.8-flash, but received ${data.model}`
  )
  console.log('✓ Model check passed: Response explicitly confirmed gemini-3.8-flash')

  // 2. Test Invalid / Empty Message Handling
  console.log('\n--- 2. Testing input validation on /api/chat ---')
  const emptyRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.10.99',
    },
    body: JSON.stringify({ messages: [] }),
  })
  assert.equal(emptyRes.status, 400, 'Empty messages array should return 400')
  console.log('✓ Empty message array properly rejected with HTTP 400')

  // 3. Test Rate Limiter (8 requests per minute)
  console.log('\n--- 3. Testing per-IP rate limiting (8 req/min) ---')
  const testIp = `10.99.88.${Math.floor(Math.random() * 250) + 1}`
  let hitRateLimit = false
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIp,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: `Test message ${i}` }],
      }),
    })
    if (r.status === 429) {
      hitRateLimit = true
      const rateData = await r.json()
      console.log(`✓ Request ${i + 1} hit rate limit as expected: HTTP 429 - ${rateData.error}`)
      break
    }
  }
  assert.ok(hitRateLimit, 'Rate limit should be triggered within 10 requests from the same IP')

  console.log('\n===============================================================')
  console.log('ALL CHATBOT TESTS PASSED: Model is strictly gemini-3.8-flash')
  console.log('===============================================================')
}

runChatbotTests().catch((err) => {
  console.error('Chatbot test suite failed:', err)
  process.exit(1)
})
