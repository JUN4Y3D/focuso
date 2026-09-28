# HudHud Cloudflare setup and acceptance

## Provider contract

The existing Express `POST /api/chat` calls only `@cf/zai-org/glm-4.7-flash` through
Cloudflare Workers AI. No Worker deployment, SDK, gateway, second backend, fallback,
database memory, or extra model calls are needed. The current Vercel routing stays
unchanged. The browser and server must deploy together because client messages now
use `{ role: 'user' | 'assistant', content: string }`, not the old `model`/`text` shape.

The server prepends its authoritative system message and makes one REST request:

```text
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/zai-org/glm-4.7-flash
Authorization: Bearer <server-only API token>
Content-Type: application/json
```

```json
{
  "messages": [
    { "role": "system", "content": "<server-owned HudHud instruction>" },
    { "role": "user", "content": "My exam is on Monday." },
    { "role": "assistant", "content": "Plan study sessions before Monday." },
    { "role": "user", "content": "When is my exam?" }
  ],
  "max_completion_tokens": 350,
  "chat_template_kwargs": { "enable_thinking": false },
  "stream": false
}
```

Cloudflare documents these generation controls in its [GLM input schema](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/sync-input.json).
This is a documented boolean reasoning switch, not a translation of Gemini's low
thinking level. The output is parsed from the REST envelope's
`result.choices[0].message.content`, with `finish_reason` used for length handling,
following the [model output schema](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/sync-output.json)
and [REST response envelope](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).
Only visible assistant text is returned; raw response metadata/reasoning is neither
returned to the browser nor saved. Unexpected output fails safely.

## Cloudflare configuration

1. In the Cloudflare dashboard, select the intended account and open Workers AI.
   Confirm that Workers AI is available for that account and review its usage/quota.
2. Copy the account ID from the Workers AI REST setup or account overview.
3. In profile API Tokens, create an account-scoped custom token with **Account →
   Workers AI → Read**, restricting resources to that one account. The execute-model
   [API reference](https://developers.cloudflare.com/api/resources/ai/methods/run/)
   accepts Workers AI Read or Write; Read is the least privilege for this call.
   The dashboard's Workers AI template is another supported setup path, but review
   its broader prefilled permissions. No Global API key, zone/DNS access, or Worker
   script deployment permission is needed for this integration.
4. Save the token directly in a password manager/environment configuration. Do not
   paste it into source code, chat, screenshots, shell command arguments, or logs.

## Local and Vercel environment variables

The two new variables are **server-only**:

```dotenv
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

For local full-server development, fill them in the ignored local `.env`, together
with the existing Supabase and bKash configuration. `.env.example` lists all names.
Never use `VITE_CLOUDFLARE_*`; neither value belongs in the browser bundle.

In Vercel's existing `focuso` project → Settings → Environment Variables, add both
names with their secure values for **Preview** and **Production**. Check any
branch-specific Preview overrides: the intended development branch must receive
both values. Keep all existing Supabase, admin, bKash, origins and frontend variables.
Do not delete the old deployment's Gemini key until that deployment no longer needs
it; the new revision has no Gemini dependency.

After configuration, deploy/redeploy this revision to **Preview only** when ready,
without promoting it to Production. Environment changes do not retrofit an existing
function deployment. Leave Production on its current revision until Preview passes
and you explicitly approve a Production rollout.

The repository already fails startup if critical server configuration is missing;
that strategy is preserved. Therefore add both Cloudflare values **before** deploying
this revision. `npm run validate` and the offline HudHud suite need no real credentials.

## Memory, privacy and bounds

Completed exchanges are held in a synchronous React ref, rendered through React
state, and saved under `sessionStorage['focuso:hudhud:chat:v1']` as version 1. Only
role, content, UI ID and optional local timestamp are saved. Closing/reopening,
rerenders and same-origin/same-tab refresh/remount preserve the transcript.

Storage is tab-session-scoped, not account memory. No localStorage/Supabase chat
storage is added. Browser session restore or duplicating a tab can restore/copy its
sessionStorage according to browser behavior; this is not guaranteed secure erasure
on closing a tab. Different Preview origins have separate histories. Avoid sharing
PINs, OTPs, payment credentials or other sensitive information in chat.

The display/storage retains at most 20 completed exchanges within 24,000 content
characters. Each AI request gets at most 6 completed exchanges plus the current user
within 6,000 total content characters. User messages are capped at 400; replies at
2,400 characters and a 350-token generation ceiling. Oldest exchanges are removed
whole. The current user appears exactly once and is never pruned by context budgeting.

The greeting, errors, failed user sends and pending sends are not persisted or sent
as AI context. Refreshing an in-flight request restores only previously completed
turns. Malformed/version-mismatched/oversized stored data resets only the HudHud key;
blocked storage falls back to in-memory behavior. Retries are user-driven, reuse the
latest failed bubble, and make one new provider call without injecting failure text.

## Safe errors and existing limits

| Failure | Application response | Safe code |
| --- | --- | --- |
| Missing/invalid credentials or upstream 401/403 | 503 | `hudhud_configuration` |
| Upstream 429 | 429 | `hudhud_quota` |
| Upstream 5xx | 503 | `hudhud_availability` |
| 25-second server timeout | 504 | `hudhud_timeout` |
| Network failure | 503 | `hudhud_network` |
| Other upstream request rejection | 502 | `hudhud_request` |
| Malformed/empty/unusable provider output | 502 | `hudhud_response` |
| Application 8/minute or 30/hour limit | 429 | `rateLimited: true` |
| Invalid client conversation | 400 | Generic validation message |

The client timeout remains 30 seconds; there are no automatic retries. Diagnostics
contain only model, classification and HTTP status. Provider bodies, account IDs,
tokens, conversation text and stack traces are not logged. In-memory per-IP limits
remain unchanged; they are per process/function instance, not a distributed limiter.

## Preview manual test plan

Use one browser tab on the new Preview, no production orders or remote database tests:

1. Confirm `/api/health` is `200 {"status":"ok"}`. This is an application health check,
   **not** a Cloudflare credential/model check.
2. Open HudHud: “I have an exam on Monday and 3 chapters left.”
3. “How many chapters did I say I have left?” → expected **3**.
4. “When is my exam?” → expected **Monday**, without asking again.
5. “I also need to finish an assignment tonight.” Then “Which of those should I
   focus on first?” → the answer should refer to the assignment and exam and use
   deadlines; it must not invent a new task list.
6. “Give me a 3-step evening routine.” Then “Make the second step shorter.” → it
   should edit its own earlier routine, not ask you to repeat it. Oldest turns may
   now leave the six-turn context window; that is expected bounded behavior.
7. Close/reopen: transcript remains. Refresh the same tab, reopen, and ask a follow-up
   referring to a recent turn: transcript and recent context remain.
8. Repeat a short sequence in Bangla: “আমার পরীক্ষা সোমবার, ৩টি অধ্যায় বাকি।” →
   “কতটি অধ্যায় বাকি?” → “পরীক্ষা কোন দিন?” Include a mixed follow-up such as
   “Which chapter first, আমার সময় কম?” Check natural language and retained context.
9. For failures, use the offline test suite or a controlled non-production fixture;
   do not break shared Production configuration. Retry should show one user bubble,
   no duplicate loading bubble, and no previous error notice in subsequent context.
10. Check desktop/tablet/mobile, keyboard Enter/Space, Escape/focus return, starters,
    mascot flight and click sound, and verify Bird Call Credit is absent.

Pause appropriately between sequences so the unchanged eight-per-minute limit does
not obscure quality testing. Live model availability, language quality, grounding,
latency, and real contextual reasoning still need this Preview acceptance check.
