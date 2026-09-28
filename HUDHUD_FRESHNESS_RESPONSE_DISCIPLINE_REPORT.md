# HudHud — Freshness, Memory, Language and Response Discipline

## Current-State Audit

The working tree was clean at the start. HudHud already used the server-owned prompt,
Cloudflare REST model `@cf/zai-org/glm-4.7-flash`, one request per send, 350 output
tokens, thinking disabled, a 25-second provider timeout, and safe errors. Minimum-
sufficient answers, progressive disclosure and plain-text formatting were present.
The old prompt had general grounding/language rules but no explicit freshness,
correction, memory/privacy-answer or sensitive-productivity policy. The public-
exposure refusal described in the brief was not explicitly codified in the prompt;
it is now included rather than assumed to be enforced by the base model.

`src/lib/hudhudConversation.ts` and `FocusoCompanion.tsx` confirm up to six complete recent
turns plus the current message within 6,000 characters, completed-turn sessionStorage,
refresh restoration, and an in-page fallback for blocked storage. Neither the browser
payload nor the server has a live-search or long-term account-memory tool. The chat
route limits remain 8 requests/minute and 30/hour per IP.

Product wording was checked against current `src/i18n.tsx`; authoritative price/zone
values come from `server/domain/pricing.ts`. The earlier unsupported reading-space
wording was already removed. No new feature claims were added. The existing static
storefront “+ ৳60 delivery charge” note is less complete than checkout's zone rates
(৳60 Chattogram / ৳100 other valid districts); that previously reported inconsistency
is unchanged. No unrelated storefront/product data was rewritten.

## Freshness / Current-Fact Fix

The prompt distinguishes authoritative FOCUSO facts, timeless/general knowledge and
time-sensitive external facts. Current officeholders, news, election results, latest
devices, exchange rates and weather must not be asserted from training memory.
Verified application context is the only allowed basis for a current claim; previous
assistant answers and unverified user assertions are not such context.

Recency terms and implicit current-officeholder questions are explicit signals.
Meaning controls behavior: “explain photosynthesis now,” “plan today,” user-supplied
deadlines and “current planner price” must not receive irrelevant live-access disclaimers.
Uncertain unnecessary facts are omitted; requested unverifiable facts get a short
limitation. No political names, search integration, keyword blocker or extra provider
request was added.

## Correction Handling

Disagreement triggers reassessment of the referenced claim. Unverifiable current
facts get a concise acknowledgment of verification limits, not repetition or defense
of a stale answer. User-proposed external facts are not automatically endorsed.
Timeless/FOCUSO corrections are checked against grounding; a bare “no” rejecting a
plan is not automatically treated as a freshness question. Repeated apologies and
unrequested language changes are discouraged.

## Memory Honesty

First-turn name questions without a supplied name use “You haven't told me your name
in this chat yet.” A retained user-supplied name is answered directly, without privacy
boilerplate. Personal corrections are accepted. Names must not be inferred from
friends, prompt examples or assistant guesses.

If context may have been pruned, the answer refers to missing recent context rather
than claiming the fact was never shared. Tests demonstrate that storage can still
retain an older name while the six-turn provider context no longer contains it, and
that the character budget can evict a name even before the six-turn limit is reached.
No storage, schema, context budget or UI-state logic was changed.

## Privacy Wording

Privacy/storage is discussed only when asked. The prompt accurately describes recent
context, normal same-tab completed-turn storage, blocked-storage fallback and absence
of long-term account/cross-session memory. If processing/privacy is asked about, it
acknowledges FOCUSO server → Cloudflare processing rather than claiming messages stay
only in the browser. It does not promise zero retention, deletion, encryption or
other unsupported guarantees.

## Language Consistency

English stays English, Bangla stays natural Bangla, and mixed messages use the dominant
language. Short ambiguous corrections inherit established language. Explicit switches
and requests for translations are respected; duplicated bilingual answers are not
automatic. Existing English/Bangla brevity and product/model grounding remain intact.

## Sensitive Productivity Guidance

The prompt prohibits viewing schedules, time-block optimization, distraction-removal
tips, adult-site recommendations and other facilitation for prolonged pornography
consumption/compulsive binges. It prefers brief nonjudgmental redirection, discourages
public exposure, and resolves contextual “best site” requests against recent turns.
No shaming, moralizing, diagnosis or medical/mental-health claims are instructed.
Ordinary rest/leisure and non-graphic health education are not conflated with those
requests. No client-side blocker or semantic regex filter was added.

## Minimum-Sufficient Answer Preservation

Existing greeting, overview, benefit, price, delivery, coupon, identity and follow-up
scope rules are unchanged. Freshness/privacy/safety information is conditional on the
actual request, not a footer. Product and AI identity facts are not proactively added.
The 350-token limit remains a ceiling, not a target; formatting cleanup is unchanged.

## Tests Added / Updated

New `hudhudResponseDiscipline.test.ts` runs automatically from the existing main HudHud
suite without changing npm scripts. It checks the prompt contract, 67 synthetic reply
fixtures, five rejected bad-pattern fixtures, actual storage restoration/pruning,
server-owned prompt delivery, unchanged Cloudflare controls and exactly one request.
The mock rejects any unexpected endpoint. No real credentials or external services
are used in the automated suites.

Existing response-quality/minimum-sufficient fixtures, code/formatting preservation,
rate-limit, actual loopback Express-route, safe-error, strict-schema, bounded-context
and malformed/blocked-storage tests still run. These are application regressions,
not measurements of live model compliance.

## English Tests

45 fixtures cover both requested officeholders and implicit/current external queries;
corrections after safe and deliberately fictional stale history; unverified user
replacement claims; photosynthesis/Pomodoro/planning/FOCUSO contrasts; plan rejection;
name absence/recall/correction/non-inference; session refresh and evicted-name context;
privacy/processing/cross-session questions; sensitive planning/public display/sites;
ordinary leisure/learning-site/non-graphic consent-education contrasts; and the existing
greeting/overview/price/model behavior. Negative checks catch a repeated stale claim, bilingual leakage,
generic memory boilerplate and optimized viewing instructions.

## Bangla Tests

18 fixtures cover current officeholders/weather, corrections, timeless knowledge,
day planning and FOCUSO-price contrasts, missing/supplied names, a friend's name,
privacy, prolonged viewing, public exposure and contextual adult-site recommendations.
Three mixed fixtures check dominant/explicit language choices; one explicitly requested
bilingual fixture checks that a requested translation is still allowed. Language
assertions distinguish Bangla letters from the taka symbol used in English prices.

## Validation Results

- `npm run validate`: passed, including TypeScript, Vite production build, 20 pricing
  cases, integration safety, offline admin return/refund, main HudHud, response-quality
  and new response-discipline suites.
- Direct `node --import tsx server/services/hudhudResponseDiscipline.test.ts`: passed
  (45 English, 18 Bangla, 3 mixed and 1 requested bilingual fixture).
- Direct `node --import tsx server/services/hudhudResponseQuality.test.ts`: passed
  (existing 30 English, 23 Bangla and 1 mixed fixture).
- `git diff --check`: passed.

Full validation used authorized local IPC/loopback sockets; all upstream calls were
mocked. Provider model/configuration, errors, rate limits, memory and UI behavior are
unchanged. No credential, database, production-data, commit, push or deployment changes.

## Changed Files

- [Server prompt](/Users/md.junayed/Desktop/focuso/server/services/hudhudChat.ts): prompt text only; provider/configuration and response pipeline unchanged.
- [New discipline tests](/Users/md.junayed/Desktop/focuso/server/services/hudhudResponseDiscipline.test.ts).
- [Main HudHud tests](/Users/md.junayed/Desktop/focuso/server/services/hudhudChat.test.ts): import the new suite.
- [HudHud documentation](/Users/md.junayed/Desktop/focuso/docs/HUDHUD.md).
- [This report](/Users/md.junayed/Desktop/focuso/HUDHUD_FRESHNESS_RESPONSE_DISCIPLINE_REPORT.md).

## Remaining Limitations

Prompt rules reduce risk but cannot guarantee that every GLM answer follows them.
Offline fixtures verify prompt delivery, transport, presentation and memory mechanics,
not live answer semantics. The local environment does not have configured Cloudflare
account/token values, so a real-provider spot-check could not be performed. No secrets
were printed or credentials changed. A future authorized live check should repeat the
brief's English/Bangla current-fact, correction, name, language and sensitive cases.

Recent context can prune older personal facts even while browser storage retains more
turns. Storage continuity is not a server account-memory guarantee or a provider data-
retention policy. No live search, new model, RAG, news API, database change, remote
Supabase test, deployment, commit or push was performed.

HUDHUD FRESHNESS AND RESPONSE DISCIPLINE STATUS: SUCCESS
