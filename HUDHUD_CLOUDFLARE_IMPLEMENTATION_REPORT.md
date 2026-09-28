# HudHud Cloudflare GLM-4.7-Flash implementation report

Implementation and offline verification are complete. Live provider/Preview
acceptance remains blocked by missing Cloudflare credentials. No commit, push,
deployment, database changes, production orders or remote Supabase tests were made.

## Current-State Audit

The source of truth before this change was Gemini `gemini-3.5-flash-lite`, not the
older 3.8 report. One Express `/api/chat` endpoint used `@google/genai`, a 350-token
ceiling, low thinking, a 25-second timeout and one SDK attempt. The prompt already
covered concise productivity judgment, FOCUSO grounding and English/Bangla behavior.

The React companion used a native modal, bilingual starters, optimistic messages,
a synchronous send lock, and an eleven-message/five-exchange context slice. It
retained component state on panel close but did not persist conversation anywhere.
The API accepted `user`, legacy `model` and `assistant` roles with `text`, up to 41
messages and no aggregate content budget. The existing limits were eight requests
per minute and thirty per hour per IP, with a 20 KB JSON body limit. All commerce,
admin, Supabase, pricing and Vercel routing were left in place.

## Root Cause of Lost Context

The confirmed application-level causes were state lifetime and context eviction:
refresh/remount recreated the greeting-only `useState` array, losing the transcript;
facts older than the five recent exchanges were intentionally removed from requests.
Panel close itself did not clear history in the existing component.

There was also a reliability gap: request history was built from a render-captured
`messages` snapshot while optimistic, success and failure updates were separate
state operations. The implementation now uses a synchronous canonical ref and
commits each completed pair together, so it does not depend on React committing an
earlier render before the next send. This is a robustness fix, not a claim that a
timing race was reproduced in the old deployment.

The earlier implementation already sent prior messages inside its window. Without
old live provider traces, it is not possible to attribute every reported same-panel
semantic failure to frontend data loss rather than model behavior. The new tests
prove the correct user facts, assistant text and task references reach the provider;
live model reasoning still needs acceptance testing.

## Provider Migration

The only model is exactly `@cf/zai-org/glm-4.7-flash`. Gemini generation, low-thinking
configuration and fallback possibilities are absent. No replacement SDK was added.

## Cloudflare API Architecture

The existing browser → Express `/api/chat` flow now makes one server-side REST POST
to Cloudflare's account-scoped `/ai/run/@cf/zai-org/glm-4.7-flash` endpoint with Bearer
authentication. A server-owned system message precedes genuine chronological
user/assistant history. Only the sanitized `{ reply, model }` response reaches the UI.

Request controls are `max_completion_tokens: 350`, `stream: false` and documented
`chat_template_kwargs: { enable_thinking: false }`. The latter prevents spending
the small completion budget on hidden reasoning; it is not an invented low-thinking
level. [Official input schema](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/sync-input.json).

The parser validates `success: true` and the REST envelope's
`result.choices[0].message.content` / `finish_reason`. It never returns reasoning,
usage or tools; inline thought tags, unexpected finishes and empty/malformed output
fail safely. [Official output schema](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/sync-output.json),
[REST envelope](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).

## Required Environment Variables

`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are new required server-only values.
Neither has a `VITE_` prefix or enters the browser bundle. Supabase and bKash variables
remain unchanged. Startup checks require a 32-character hexadecimal account ID and
a nonempty single-line token, with safe errors containing variable names only.

Both real Cloudflare values are absent from the current shell and there is no local
repository `.env`. No secret values were printed, copied into source, or invented.

## Conversation Memory Architecture

Successful exchanges live in a synchronous ref and React state, and are persisted
under versioned `sessionStorage` key `focuso:hudhud:chat:v1`. Closing/reopening,
rerenders, remounts and refresh in the same tab/origin preserve completed exchanges.
Only role/content/id/optional timestamp are stored; no account/DB/indefinite memory.

Storage and display are bounded to forty messages, with stored content additionally
capped at 24,000 characters. Requests contain at most six complete exchanges plus
one current user (thirteen messages), within 6,000 total content characters. Whole
oldest turns are removed; current input is never pruned by context budgeting.

Greeting, pending requests, UI notices and failed user sends are neither persisted
nor sent as context. Retry reuses the immediately failed bubble and removes its
notice, preserving one current user and one loading indicator. Blocked storage
falls back to memory; malformed sessions reset only this key.

## Context Validation / Security

Strict API schemas accept only `user`/`assistant`, nonempty bounded `content`, an
alternating complete-turn sequence ending in a user, thirteen messages and 6,000
characters. Unknown fields, client `system`/`model` roles, empty content and invalid
sequences are rejected before any provider request. The existing 20 KB body ceiling
is unchanged. Server instructions, credentials and provider endpoints are not client
configurable. React continues rendering plain text rather than raw HTML.

Stored JSON is checked for version, structure, field whitelist, unique bounded IDs,
timestamps, roles, chronological turn shape, count and size before restoration.
Ordinary user content remains untrusted; a role schema is not a guarantee against
every prompt-injection technique. HudHud still has no transaction/order-write tools.

## System Prompt / Intelligence

The existing authoritative prompt is preserved: direct shortest complete answers,
2–6 sentences or 3–5 concise steps, at most one useful clarification, practical
deadline/consequence/dependency-based priorities, realistic time blocks and next
actions. English, natural Bangla, dominant mixed-language behavior and explicit
language preferences remain part of the instruction.

Facts remain grounded in checkout pricing constants: planner ৳250, quantity 1–9,
Chattogram ৳60 / other valid districts ৳100, FOCUS25 25% on product subtotal only
with floored BDT discount, COD/manual bKash, no automated payment claims or invented
delivery timeframe. No live stock, order-status, refund-policy or payment lookup is
claimed. Unknown facts, credentials and professional-advice boundaries are unchanged.

## Token Efficiency

One normal message makes one Cloudflare call, without classification, summaries,
tools, retries or second models. A 350-token ceiling is a maximum, not an answer
target; 2,400 visible characters is an additional defensive cap. Six-turn and total
character budgets prevent indefinitely increasing input costs. No cost/free-tier
or daily-user-capacity guarantee is made.

## Error Handling

Upstream 401/403 and missing credentials map to application 503/configuration;
429 maps to 429/quota; 5xx maps to 503/availability; timeout maps to 504; network
failure maps to 503; other rejected requests and malformed replies map to 502.
Availability failures are no longer mislabeled quota errors. User-facing messages
remain safe and bilingual; server diagnostics contain only model/category/status.
Provider error bodies are not read into logs or returned. There are no automatic
retries, so auth or quota failures cannot trigger extra model calls.

Rate-limit thresholds and accounting are unchanged. The cleanup timer is now
unreferenced, allowing a closed local test/server process to exit without waiting
for the ten-minute cleanup; its schedule and limit logic are unchanged.

## Gemini Cleanup

Repository-wide inspection found no other feature using `@google/genai`. It and
its exclusively required transitive dependencies were removed from package.json
and the existing Bun lockfile. GEMINI_API_KEY was replaced in current environment
examples, validation and deployment docs. The obsolete Gemini capability marker
was removed from metadata.json, without inventing a replacement platform flag.

Two obsolete live Gemini-specific suites were deleted and their transport/context
coverage replaced by offline Cloudflare regressions. These tracked files remain
recoverable through Git history. Remaining old Gemini mentions are explicitly
historical or migration explanations; the old report is marked superseded.

## Tests

The offline suite covers exact endpoint/model/auth headers, documented controls,
system ownership, reply extraction and hidden-reasoning exclusion; fourteen English
and fourteen Bangla prompts plus mixed language; earlier English/Bangla user facts,
task references and previous assistant responses; complete-turn and size budgets;
strict invalid-request rejection; session restore/malformed/blocked storage;
notice/pending exclusion; 401/403/429/5xx/request/timeout/network failures; complete
English/Bangla sentences; safe logs; startup variables; actual Express route and
both existing rate-limit thresholds. No live provider/database calls are made.

Browser smoke testing used a temporary loopback Express fixture with synthetic
Cloudflare responses, not the real model. At desktop 1440×900, tablet 768×1024 and
mobile 375×812: context carried exam/task facts and assistant edits; close/reopen
and refresh restored the transcript; a follow-up after refresh retained the fact;
retry produced one user bubble and no error context; language switching and Bangla
controls worked; Escape restored launcher focus; no horizontal overflow, credit
UI or console errors were observed. Mascot/sound/motion files were unchanged.

## Validation Results

- `npm run validate`: passed (TypeScript, production Vite build, twenty pricing
  cases, integration safety guard, offline return/refund and HudHud suites).
- Direct `node --import tsx server/services/hudhudChat.test.ts`: passed.
- `git diff --check`: passed.
- Bun lockfile frozen verification: passed.
- Browser bundle scan: no Cloudflare credential names/model/system instruction.
- No remote Supabase integration tests or live Cloudflare calls were run.

## Changed Files

Runtime: [chat service](/Users/md.junayed/Desktop/focuso/server/services/hudhudChat.ts),
[Express endpoint](/Users/md.junayed/Desktop/focuso/server/app.ts),
[environment validator](/Users/md.junayed/Desktop/focuso/server/lib/envValidation.ts),
[companion UI](/Users/md.junayed/Desktop/focuso/src/components/FocusoCompanion.tsx),
[shared conversation/session helpers](/Users/md.junayed/Desktop/focuso/src/lib/hudhudConversation.ts).

Config/cleanup: [.env.example](/Users/md.junayed/Desktop/focuso/.env.example),
[.env.test.example](/Users/md.junayed/Desktop/focuso/.env.test.example),
[package.json](/Users/md.junayed/Desktop/focuso/package.json),
[bun.lock](/Users/md.junayed/Desktop/focuso/bun.lock),
[metadata.json](/Users/md.junayed/Desktop/focuso/metadata.json),
[Supabase client security comment](/Users/md.junayed/Desktop/focuso/src/lib/supabaseClient.ts).

Tests: [offline HudHud](/Users/md.junayed/Desktop/focuso/server/services/hudhudChat.test.ts),
[Step 7](/Users/md.junayed/Desktop/focuso/server/services/step7.test.ts),
[Step 8C](/Users/md.junayed/Desktop/focuso/server/services/step8c.test.ts),
[Step 8D](/Users/md.junayed/Desktop/focuso/server/services/step8d.test.ts),
[Step 9A](/Users/md.junayed/Desktop/focuso/server/services/step9a.test.ts).
Deleted obsolete suites: `/Users/md.junayed/Desktop/focuso/server/services/chatbot.test.ts`
and `/Users/md.junayed/Desktop/focuso/server/services/chatbot_knowledge.test.ts`.

Documentation: [deployment contract](/Users/md.junayed/Desktop/focuso/docs/DEPLOYMENT.md),
[HudHud UI notes](/Users/md.junayed/Desktop/focuso/docs/HUDHUD.md),
[Cloudflare setup/manual acceptance](/Users/md.junayed/Desktop/focuso/docs/HUDHUD_CLOUDFLARE.md),
[archived Gemini report notice](/Users/md.junayed/Desktop/focuso/HUDHUD_GEMINI_3_8_IMPLEMENTATION_REPORT.md),
and this report. The temporary UI fixture is outside the repository and is removed
after use. No commerce, database schema, payment logic or Vercel architecture files changed.

## Cloudflare + Vercel Setup I Must Do

Use Cloudflare Workers AI on the intended account; create a token scoped to only
that account with Workers AI Read permission, accepted by the
[execute-model API](https://developers.cloudflare.com/api/resources/ai/methods/run/).
Copy the account ID and store both values securely in the existing Vercel `focuso`
project for Preview and Production, checking branch-specific overrides. No `VITE_`
variables, global API key, Worker deployment or extra app permissions are required.
Configure before deploying because existing startup validation remains fail-fast.

When ready, deploy this revision to Preview only, without promoting Production.
Keep the old deployment's Gemini configuration until it no longer needs it.
Exact steps, privacy caveats and safe error codes are in the
[setup guide](/Users/md.junayed/Desktop/focuso/docs/HUDHUD_CLOUDFLARE.md).
No Cloudflare/Vercel account mutation or deployment was performed here.

## Preview Manual Test Plan

In one Preview tab: “I have an exam on Monday and 3 chapters left.” → “How many
chapters did I say I have left?” (3) → “When is my exam?” (Monday) → “I also need
to finish an assignment tonight.” → “Which of those should I focus on first?”
(references existing tasks/deadlines). Close/reopen and refresh the same tab; verify
messages and recent follow-up context remain. Test editing the second step of an
earlier routine. Repeat in Bangla and mixed language. Respect eight requests/minute.
Confirm actual responses/latency, not just the endpoint's model label. The setup
guide contains the complete script and responsive/accessibility checks.

## Remaining Limitations

Live model access, real English/Bangla reasoning quality, quota and latency are
unverified until secure Cloudflare configuration and a new Preview deployment are
available. Health 200 checks Express, not provider access. Older facts leave context
after six turns or earlier if the character budget is reached; there is no long-term
memory. Session storage is same-origin/tab-scoped and may survive browser session
restoration; blocked storage cannot preserve refresh history. In-flight/failed turns
are intentionally not restored. Limits are per function process, not distributed.
Physical-device keyboard, OS motion preferences and speaker loudness remain device QA.

HUDHUD CLOUDFLARE GLM-4.7-FLASH STATUS: BLOCKED
