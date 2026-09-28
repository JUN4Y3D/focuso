# HudHud — Minimum-Sufficient Answers and Progressive Disclosure

## Why over-answering was happening

The previous server-owned prompt prohibited irrelevant topics, but did not clearly
separate related facts from requested facts. Broad planner questions could therefore
be interpreted as permission to share the available feature, price and delivery
knowledge. Greetings had no dedicated scope. The default allowed 1–4 sentences and
40–120 words of advice, and a creator-answer example volunteered the model name.
Context guidance did not explicitly forbid repeating adjacent facts from earlier
turns. These are source-level causes; no production response logs were inspected.

## System prompt changes

The highest response-style rule is now MINIMUM SUFFICIENT ANSWER, subject to existing
grounding and safety: determine the current intent, give only necessary information,
omit related but unrequested facts, then stop. The internal selection process must
not be shown. Progressive disclosure expands only for requested detail, an explicit
list/explanation/comparison, or information genuinely needed to avoid misunderstanding.
Explicit multi-part questions are still answered in full. Optional follow-up offers
are rare rather than an automatic footer.

Soft word targets are greeting 5–15, simple fact 5–30, overview 25–60, benefits 20–60,
and normal productivity advice 40–100. These are not minimums: short sufficient
answers must not be padded. The existing 350-token ceiling remains unchanged.

Product facts were checked against current runtime copy in
[i18n.tsx](/Users/md.junayed/Desktop/focuso/src/i18n.tsx:63) and checkout constants in
[pricing.ts](/Users/md.junayed/Desktop/focuso/server/domain/pricing.ts:13).
The former prompt's “daily Qur'an reading space” conflicts with the current daily
page description of a short Qur'an verse; the prompt now uses the current wording
and does not infer an extra reading/reflection space. Monthly/weekly feature names
also follow the current copy. Unconfirmed paper, page-count, binding and cover
specifications must not be inferred from historical briefs.

The storefront's static “+ ৳60 delivery charge” purchase note is less complete than
the authoritative checkout's zone pricing (৳60 Chattogram / ৳100 other valid districts).
The assistant retains the checkout pricing constants as authority. No storefront
copy or pricing logic was changed in this task.

## Intent-scoping changes

- Greetings: greeting and brief offer of help only; no name, FOCUSO, capabilities,
  limitations, model or provider introduction.
- Planner overview: what it is and its purpose, in 1–3 short sentences; no commercial
  facts, full feature list or delivery-time disclaimer.
- Benefits: main practical benefits only, not a feature catalogue or sales pitch.
- Price: direct unit price, without automatic delivery/coupon/payment additions.
- Delivery: requested delivery pricing only. Unknown timeframe is relevant only to
  a timeframe question, not a delivery-charge question.
- Coupon: coupon behavior only. Explaining that delivery is not discounted is
  coupon scope; separate delivery prices/payment instructions are not.
- Identity: name/role when asked; model/provider only when explicitly requested,
  including contextual “powered by?”. The creator example names FOCUSO without
  volunteering the underlying model.
- Context: “How much?” after an overview means price only. Recent history identifies
  intent; it does not authorize repeating old features, commercial details or identity.

Safety, grounding, English/Bangla language preference and useful requested detail
remain in force. No response-level semantic regex filter or extra provider call was
added; existing formatting cleanup is unchanged.

## Tests added

The existing response-quality suite now includes 30 English, 23 Bangla and one mixed
fixture, including the required greeting, overview, benefit, price, delivery, coupon,
explicit model and overview → “How much?” cases. Additional cases cover all four
English greetings, contextual expansion, “why?”/“how?”, model-to-product/advice topic
switches, explicit feature lists, multi-part price/delivery questions, and a requested
order-tracking limitation.

Prompt-contract assertions cover every new scope and length policy. Test-only scope
checks reject unrequested commercial facts, model disclosure, limitation footers and
unsolicited lists. Six negative fixtures prove those checks reject supplied bad
patterns, including a repeated overview in a price follow-up and Bangla over-answering.

All fixtures traverse the real chat service with mocked fetch, verifying that the
server-owned prompt and bounded history reach the unchanged Cloudflare request and
that each send makes exactly one provider call. They are offline contract/transport
tests, not evidence that a live model will always obey the prompt. Existing memory,
sessionStorage, formatting/code preservation, errors, schema and rate-limit tests
remain enabled.

## Validation results

- `npm run validate`: passed (TypeScript, Vite build, pricing, integration safety,
  offline admin return/refund, HudHud and response-quality tests).
- Direct `node --import tsx server/services/hudhudResponseQuality.test.ts`: passed.
- `git diff --check`: passed.

The first sandboxed validation attempt completed TypeScript/build but could not open
tsx's local IPC socket. The authorized rerun passed. No remote Supabase tests or live
provider inference was performed. Live English/Bangla semantic behavior still needs
a real-provider spot-check; prompt rules cannot guarantee every generated answer.

Preserved: `@cf/zai-org/glm-4.7-flash`, Cloudflare integration/configuration,
350-token ceiling, one-call behavior, same-chat/sessionStorage memory, language
behavior, rate limits, security/grounding, UI and commerce logic. No credential,
database or production-data changes, commit, push or deployment.

## Changed files

- [hudhudChat.ts](/Users/md.junayed/Desktop/focuso/server/services/hudhudChat.ts): server-owned prompt and source comments only.
- [hudhudResponseQuality.test.ts](/Users/md.junayed/Desktop/focuso/server/services/hudhudResponseQuality.test.ts): expanded offline policy/scope/context tests.
- [HUDHUD.md](/Users/md.junayed/Desktop/focuso/docs/HUDHUD.md): current response-policy documentation.
- [This report](/Users/md.junayed/Desktop/focuso/HUDHUD_MINIMUM_SUFFICIENT_ANSWERS_REPORT.md).
