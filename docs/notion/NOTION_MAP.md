# Notion map

Private HQ: https://app.notion.com/p/4040b5f7282081f7add6d425233aafb0

These pages live in the founder’s private Notion workspace. They are **not** publicly shared Notion sites. Access requires an authorized Notion account.

| Page / database | Use |
| --- | --- |
| [Start Here / Agent Map](https://app.notion.com/p/4040b5f7282081508d6fde75eb3ba91a) | First fetch for agents |
| [Wiki](https://app.notion.com/p/4040b5f7282081508c66eab0ce93006b) | How it is today |
| [Docs Index](https://app.notion.com/p/4040b5f7282081b3becdf4ff4eaa2969) | Repo Markdown inventory |
| [Engineering Board](https://app.notion.com/p/3acb296008bc473893a307240ec32e3a) | Manual active-work board (not live-synced) |
| [Decisions (ADRs)](https://app.notion.com/p/75b388ef52524ea2bda7539d53097b75) | Why; interview explanations |
| [Features](https://app.notion.com/p/31615e525d5342c6af1145d3a057ed05) | Capability vs roadmap; status ≠ validation |
| [Changelog](https://app.notion.com/p/6a9d4d5f84524bbe97a70fc82aeeb770) | Merged/released changes only |
| [Mistakes & Wins](https://app.notion.com/p/99bde39f8c0044148727c7278f4ef01b) | Lessons |
| [System Catalog](https://app.notion.com/p/89689e167326447b8e5494c69aa80bcf) | Tools (env **names** only) |
| [Runbooks](https://app.notion.com/p/703a03d32c9a49d7adcbbab46b93c0b9) | How to do or fix X |
| [Debug Log](https://app.notion.com/p/2e77e5ee639a4d078f64e56f232ef38c) | Incidents and long debug sessions |
| [Glossary](https://app.notion.com/p/621b1ac545f642b691b04ae7440101fa) | Vocabulary |

## Query, do not dump

Filter by `ID`, `Status`, `Roadmap phase`, `Tags`, or `Repo paths`. Do not read the entire HQ on every task.

## After a merge

Add a Changelog row (SHA required). Update the Feature. Update Wiki/spec links if behavior changed. Add an ADR only for a real decision. Tick **Docs updated?** only when the update is done. Unmerged work is not Shipped.

## Weekly audit (manual)

See runbook RUN-003. Compare merged GitHub SHAs to Changelog. Do not schedule automation without founder approval.

## Drift

If Notion and the repo disagree: name it, link both, mark **Drift**, recommend a correction, ask the founder before changing a requirement. Code and tests win.
