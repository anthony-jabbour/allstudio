# Studio AI chat (Pro) — design, reuse research and delivery record

Status: IMPLEMENTED FOR REVIEW (founder request, 2026-11-02). Not a phase gate PASS.
Roadmap: the Chat / Agent workspace surface from `design.md` §6.2 (approved mockup `docs/design/chat-mockup.png`). Real model-backed agents remain Phase 5 (local BYOK) and Phases 8–10 (premium cloud agent, credits, billing).

## Founder request

Build the AI chat feature for paying users from the allstudio design folder, as a separate PR. Follow the supplied reference screenshot (sidebar with recents, illustrated character row, "What are we working on today?" greeting, suggestion cards, composer with context strip, model and mode controls), with hand-drawn characters in the Notion illustration style. Find open-source tools that help.

## What was built

- **Route** `#/chat` and `#/chat/:id` in `apps/studio`. Chat is now enabled in the Studio sidebar.
- **Welcome**: a row of six original characters (Alli plus five helpers), a personal greeting, and four suggestion cards. The layout follows the founder's reference screenshot; the content is our own.
- **Thread**, following `docs/design/chat-mockup.png`:
  - user bubbles and agent messages that show the name, an "AI agent" badge and the time;
  - a live **plan card** with done, active and pending steps;
  - **preview cards** that render the real generated board, with "Open in Studio".
- **Composer**:
  - a strip showing the current board;
  - an auto-growing input (Enter sends, Shift+Enter adds a new line);
  - quick actions: Plan, Generate, Refine, Add section, Make responsive;
  - a label for the agent that is answering, a Stop button, and a line that says what the agent is and where it runs.
- **Right panel**: Preview, Steps and Activity tabs. The live preview updates after every agent edit, and Latest activity is listed there too. The panel can be hidden.
- **Recents**: conversations persist locally and can be renamed or deleted. Deleting a chat keeps the board it made.
- **Pro gate**:
  - Free plan: you see the welcome and an "Upgrade to Pro" card, and the composer is locked.
  - "Preview Pro locally" unlocks chat on this device and is labelled that way everywhere.
  - Real entitlements belong in the private cloud (Clerk and billing). `entitlement.ts` is the single place they plug in.
- **Agent contract** (`ChatAgent` in `agent.ts`): a streaming event interface (message, activity, file) with abort support. The public build ships `LocalStudioAgent`:
  - It is deterministic and offline, and calls **no AI model and no network**.
  - It routes intent, picks a template, adds the brand, and produces **real, schema-valid boards**.
  - Refinements it supports: headline, dark/light, bolder, warmer, add a section, add a mobile frame.
  - The BYOK agent (Phase 5) and the premium cloud agent can implement the same contract without UI changes.

## Open-source candidates (checked 2026-11-02)

| Repository | Stars | License | Decision |
|---|---:|---|---|
| [dicebear/dicebear](https://github.com/dicebear/dicebear) (`@dicebear/core`, `@dicebear/notionists` 9.4.2) | ~10.0k (GitHub page) | MIT code; Notionists art by Zoish **CC0 1.0** | **Adopted.** Hand-drawn characters in the requested style, generated locally from a seed (no avatar service), openly licensed. Only the one style package is installed, not the full collection. |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | not verified (GitHub API blocked in this session) | MIT | Not adopted. Its thread/composer primitives are good, but it assumes its own runtime and styling. Our surface is small and must match the existing chrome. Worth reconsidering when the BYOK streaming runtime lands. |
| [vercel/ai](https://github.com/vercel/ai) (AI SDK) | not verified (same reason) | Apache-2.0 | Deferred to Phase 5. It is the likely transport for BYOK streaming behind `ChatAgent`; nothing calls a model yet. |
| [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown) | not verified | MIT | Not needed yet. The local agent emits plain text; add it when model output arrives. |

Notion's own illustrations are proprietary and were not used or imitated. The characters come from the independent CC0 Notionists set.

## Founder decisions needed

1. **Entitlement source and gate.** Today the plan is read from local storage, with a visible "Preview Pro locally". Should the public/local build hide chat entirely for free users, keep the preview, or offer BYOK chat for free (PRD P-009) with Pro reserved for the cloud agent?
2. **Agent naming.** "Alli" and the five helper names and roles are placeholders.
3. **Conversation storage.** Conversations are in browser localStorage (bounded: 200 chats, 400 messages each). Should desktop store them next to boards on disk (`.allstudio/chats`)?
4. **Adopting DiceBear** (new runtime dependency, about 870 kB unpacked across two packages, tree-shaken in the bundle). Approve, or replace with commissioned original characters?

## Delivery record

**Roadmap phase / acceptance criterion:** design.md §6.2 Chat / Agent workspace UI. Not a gate for Phases 5/8–10 (no model is connected).
**Founder approvals or unresolved decisions:** see the list above. The DiceBear adoption and the entitlement behaviour need sign-off.
**OSS candidates:** see the table above.
**REA:** not applicable. The reference is the founder's own screenshot plus the approved mockup; no third-party product was inspected.
**Files changed and visible result:**
- `apps/studio/src/chat/*`: model, agent, avatars, entitlement, page and CSS.
- `apps/studio/src/{app.tsx,router.ts,ui/icons.tsx,workspace/workspace-dashboard.tsx}`.
- `apps/studio/tests/chat.test.ts`, `scripts/e2e/studio-chat.e2e.mjs`, `NOTICE`.
- Screenshots in `docs/validation/evidence/studio-chat/`.
**Tests run:**
- `bunx vitest run`: 479 passed.
- `bun run typecheck`: exit 0.
- `bunx biome check apps/studio scripts/e2e`: 0 errors; 5 warnings, all on existing CSS plus the `<img>` used for avatars.
- `STUDIO_URL=http://localhost:5181/ node scripts/e2e/studio-chat.e2e.mjs`: 10 checks passed.
**Real-world proof:** the E2E drives the app end to end:
1. The free gate is shown.
2. The Pro preview is turned on.
3. The Lumen brief is sent and the live plan progresses.
4. A board is generated with desktop and mobile frames.
5. Refine (dark and bolder) is applied, then Add section.
6. A run is stopped.
7. After a reload, the 8 messages are still there.
8. Open in Studio shows the edited board.
9. In the dark theme, a suggestion card produces a mobile board.
**Negative/security/regression checks:**
- The E2E fails on any console error or any request to another origin; neither occurred.
- Corrupt chat storage is ignored per item.
- A reply interrupted by closing the tab is restored as "stopped".
- Prompt length is capped at 4,000 characters, and chat and message counts are bounded.
- Every agent output is checked with `parseBoardDocument`.
**Not run, failures, and risks:**
- No real model output. Refinement understands only the listed phrases and says so otherwise.
- Attachments are disabled.
- Star counts for assistant-ui, vercel/ai and react-markdown could not be re-verified because GitHub API access to those repositories is blocked here.
- The DiceBear count comes from the GitHub web page.
**Gate recommendation:** READY FOR HUMAN VALIDATION
