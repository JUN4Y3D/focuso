import assert from 'node:assert/strict'

// Offline regression tests. Every HTTP request is intercepted before importing
// the service; no real Supabase credentials or database are used.
process.env.SUPABASE_URL = 'https://offline-tests.invalid'
process.env.SUPABASE_SECRET_KEY = 'offline-test-key'

const requests: { path: string; body: Record<string, unknown> }[] = []
let response: unknown
let status = 200
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  assert.equal(new URL(url).hostname, 'offline-tests.invalid')
  requests.push({ path: new URL(url).pathname, body: JSON.parse(String(init?.body || '{}')) })
  return new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } })
}

const { returnOrder, refundBkashPayment, MutationSetupError, MutationConflictError, MutationValidationError } =
  await import('./adminMutationService.js')
const admin = { id: '00000000-0000-0000-0000-000000000002', email: 'offline@example.invalid' }
const orderId = '00000000-0000-0000-0000-000000000001'

response = { orderId, from: 'delivered', to: 'returned', reason: 'Customer return' }
const returned = await returnOrder(orderId, ' Customer return ', ' Internal note ', admin)
assert.equal(returned.orderStatus, 'returned')
assert.equal(requests.at(-1)?.path, '/rest/v1/rpc/admin_return_order')
assert.equal(requests.at(-1)?.body.p_reason, 'Customer return')
assert.equal(requests.at(-1)?.body.p_admin_note, 'Internal note')
assert.equal('paymentStatus' in returned, false)
assert.equal('p_payment_status' in requests.at(-1)!.body, false)

status = 404
response = { code: 'PGRST202', message: 'Function missing in schema cache' }
await assert.rejects(returnOrder(orderId, 'Customer return', undefined, admin), MutationSetupError)

status = 400
response = { code: 'P0001', message: 'INVALID_TRANSITION: Returns can only be recorded for shipped or delivered orders' }
await assert.rejects(returnOrder(orderId, 'Customer return', undefined, admin), MutationConflictError)

status = 200
response = { orderId, paymentStatus: 'refunded', orderStatus: 'returned', alreadyRefunded: false }
const refunded = await refundBkashPayment(orderId, ' Customer refund ', 'abcd123456', admin)
assert.equal(refunded.paymentStatus, 'refunded')
assert.equal(refunded.orderStatus, 'returned')
assert.equal(requests.at(-1)?.body.p_refund_transaction_id, 'ABCD123456')

response = { orderId, paymentStatus: 'refunded', orderStatus: 'returned', alreadyRefunded: true }
assert.equal((await refundBkashPayment(orderId, 'Customer refund', 'ABCD123456', admin)).alreadyRefunded, true)

status = 400
response = { code: 'P0001', message: 'INVALID_PAYMENT_STATUS: Only paid payments can be refunded' }
await assert.rejects(refundBkashPayment(orderId, 'Customer refund', 'ABCD123456', admin), MutationConflictError)

const callsBeforeInvalid = requests.length
await assert.rejects(refundBkashPayment(orderId, 'Customer refund', 'bad-id', admin), MutationValidationError)
await assert.rejects(refundBkashPayment(orderId, ' ', 'ABCD123456', admin), MutationValidationError)
assert.equal(requests.length, callsBeforeInvalid)
console.log('Offline admin return/refund regression tests passed.')
