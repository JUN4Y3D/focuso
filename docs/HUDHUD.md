# HudHud assistant UI

## Current provider and conversation memory

HudHud uses Cloudflare Workers AI `@cf/zai-org/glm-4.7-flash`, not Gemini.
The server owns the system prompt and credentials; the browser sends only bounded
`user`/`assistant` messages with `content`. Six complete recent turns plus the
current user are retained within a 6,000-character request budget. Successful
turns are stored in versioned same-tab `sessionStorage` and restored after refresh
or remount. Errors, pending sends and the greeting are not AI context or persisted.
See [current setup, privacy and manual tests](HUDHUD_CLOUDFLARE.md).

The visible Bird call credit UI has been removed; the licensed sound and its
public attribution page remain. Historical implementation/QA notes below are
retained as history, not the current persistence/provider contract.

## Current creative flight and click sound

This section supersedes the historical session/delay/silence descriptions below.
Arrival now starts after two animation frames, takes 3,200ms plus 280ms landing,
and follows a measured Bezier with two tapered vertical arcs and subtle banking.
The original final position, artwork and wingbeat timing are unchanged.

There is no sessionStorage/localStorage arrival gate. A module-local flag prevents
route remounts within the loaded document from replaying arrival; browser refresh,
hard refresh and new document loads reset it. Reduced motion still skips flight.

`useHudHudSound.ts` controls one HTMLAudioElement. Only launcher activation invokes
playback (click/tap/Enter/Space), at volume 0.15; no autoplay, loop or arrival sound.
Repeated activations while playing are ignored, and unmount/hidden-page cleanup
pauses audio. Chat opens synchronously without waiting for sound or decode; rejected
playback is handled without affecting chat. A 220ms acknowledgement is omitted for
reduced-motion users. The WAV is 0.74 seconds, mono 32 kHz PCM, 47,404 bytes, with
preload disabled. No runtime package dependency was added.

Recording: Vladimir Yu. Arkhipov (Arkhivov), “Upupa epops”, 28 April 2004,
https://commons.wikimedia.org/wiki/File:Upupa_epops.ogg — CC BY-SA 3.0.
The 0.16–0.90s excerpt is anti-alias filtered/resampled and gently faded. The edited
audio is also CC BY-SA 3.0. Public attribution/change/license details are served at
`/audio/hudhud-call-license.html`; no credit link appears in the chat panel.

QA: timed screenshots at 1440×900, 768×1024, 375×812 and 812×375 showed flight and
the unchanged resting location without horizontal overflow. Browser refresh replayed
flight; audio stayed paused at time zero throughout automatic arrival. Click, Space
and Enter produced playback and an immediately open dialog; rapid reactivation left
only one player. Browser reported the correct 0.74s duration and no console errors.
Physical-speaker loudness and OS reduced-motion toggling still need device QA.
No remote Supabase tests, backend/model changes, commit or push were performed.

## Current mascot redesign

The active artwork is now `src/components/HudHud/HudHudBird.tsx`, an original
layered SVG interpretation of the three user-supplied Hoopoe photos. The legacy
`src/assets/hudhud-placeholder.svg` is retained but no longer imported. Historical
placeholder notes below describe the earlier implementation, not the current bird.

The new artwork separates body, head, crest, tail, legs, folded wing, and two flight
wings. Cinnamon (#C97843, #D9874E, #E49A62), buff (#D9B08C, #C98F67), charcoal
(#24211F) and ivory (#F5F1E8) replace the old green treatment. The long slender bill,
black-tipped fan crest and broad wing bands follow the supplied references. Flight
uses an angled body, tucked legs, compressed crest and independently animated
feathered wings; it retains the existing measured path and session lifecycle.

The launcher keeps its original transparent hit area and offsets, with a lighter
branch, no permanent name box, and a hover/focus tooltip plus visible focus ring.
The same SVG supplies the chat avatar. No chat, API, model or commerce code changed.

Redesign QA: desktop 1280×800 flight frames and perched state; tablet 768×1024,
mobile 375×812 and landscape 812×375 screenshots; no horizontal overflow. Enter
and Space opened chat; Escape closed it and restored launcher focus. Reduced-motion
styles retain the perched artwork and suppress flight wings (source-verified, not
OS-emulated). No dark theme exists. This is a lightweight, simplified vector mascot;
final brand approval and professional feather/anatomy refinement remain optional.

## Scope and files

The existing `src/components/FocusoCompanion.tsx` retains chat state, request payloads,
loading, rate-limit handling and `/api/chat`. No backend/model configuration changed.
`src/components/HudHud/HudHudTrigger.tsx` owns the accessible launcher and branch;
`useHudHudPresence.ts` owns arrival state; `hudhud.css` owns responsive styling/motion.

## Replaceable artwork

`src/assets/hudhud-placeholder.svg` is temporary, not an approved brand mascot.
Replace it with the official transparent HudHud asset, keeping its 96×96 framing,
or update the single import in HudHudTrigger. Check foot/branch alignment afterward.

## Motion and session lifecycle

Waiting (1,200ms) → flying (3,200ms measured Bezier path) → landing (280ms) → idle.
The flight uses native Web Animations transform samples with custom acceleration,
body pitch, gentle vertical motion and a landing flare. Its start is fully beyond
the viewport's left edge; its destination is measured from the existing button.
A resize during flight settles the bird at the new perch without replaying arrival.
An SVG wing overlay matches the temporary asset and folds away at landing; wingbeats
become slower and shallower during approach. Replace this overlay with the official
asset's wing articulation when the final illustration is supplied.
Idle movement is a slight rotation near the end of a 24-second cycle.
The sessionStorage flag `focuso_hudhud_arrived` prevents repeat arrivals in the same
tab session. An in-memory fallback handles blocked storage. Focus/click settles the
bird immediately. Timers and media listeners are cleaned up on unmount.
Reduced-motion preference skips arrival, uses a 180ms opacity-only bird fade, and
disables idle/panel/loading animation.
Nothing automatically opens the chat or plays sound. No animation dependencies added.

## Accessibility and mobile

A labelled native modal dialog contains focus, supports Escape, and returns focus to
the launcher. Initial focus goes to Close, avoiding unsolicited mobile keyboard
activation. Conversation updates use a polite live log. Inputs and controls have
English/Bangla labels. A synchronous send guard prevents duplicate rapid submissions.
The launcher shrinks on mobile; the panel uses dynamic viewport height, safe-area
bottom padding and a scrollable message region. Short landscape views hide starters.
`--hudhud-bottom-offset` and `--hudhud-right-offset` are layout adjustment points.
The application currently has a light-only theme; this change does not add dark mode.

## Persistence and validation limits

Historical QA of the earlier implementation: chat was component-memory-only;
close/reopen retained it but reload/remount cleared it. This is superseded by the
current versioned session storage implementation described above.
Desktop 1440×900, tablet 768×1024 and mobile 375×812 were visually checked, including
Escape/focus restoration and the static preview's graceful unavailable-API response.
Reduced-motion support is implemented in CSS and the hook; physical mobile keyboard
and OS reduced-motion toggling need device QA. A successful live Gemini reply and
remote Supabase/checkout integration are not verified by static preview testing.

Flight refinement QA: timed browser screenshots were inspected at desktop 1280×720,
tablet 768×1024, mobile 375×812 and landscape 812×375. The bird entered from beyond
the left edge, crossed the page and returned to the measured original perch. Mobile
had no horizontal overflow. Reloads in the same session showed the idle bird rather
than replaying arrival. Airborne artwork ignores pointer events, so it cannot capture
clicks intended for page CTAs. The wing remains an approximation of the placeholder,
not an anatomical or photorealistic bird animation.
