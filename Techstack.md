# allstudio — Technical Stack

> **Status:** Locked core + proposed implementation choices · **2026-10-24**  
> **Principle:** one code-aware editor, two runtimes (local/cloud); infrastructure can be replaced through clean interfaces.

## 1. Locked product/platform decisions

| Concern | Technology | Status |
|---|---|---|
| Product and domain | **allstudio / allstudio.dev** | Locked |
| Cloud infrastructure | **Railway** | Locked |
| User authentication (cloud only) | **Clerk** | Locked |
| Cloud database | **PostgreSQL deployed on Railway** | Selected with locked Railway decision |
| Cloud AI/model gateway | **OpenRouter** | Locked |
| Initial third-party integration | **GitHub** | Locked |
| Primary open-source code reuse | **Onlook's JSX/DOM visual editor** | Selected, conditional on extraction spike |
| Native offline operation | Local project files; no required account | Locked product requirement |

The stack table below is engineering design guidance, not a statement that these services have been provisioned or configured.

## 2. Application and editor

| Layer | Technology | Why / conditions |
|---|---|---|
| UI | React + TypeScript | Align with Onlook source and reusable editor logic |
| Web app | Next.js App Router | Authenticated cloud workspace and project UI; deploy on Railway |
| Design system | Tailwind CSS + custom accessible React components | Precise original visual identity, consistent inspector/components |
| Editor state | MobX **initially where extracted from Onlook** | Avoid needless rewrite during first spike; constrain behind editor facade |
| Parser / editor source | Onlook-derived Babel / JSX + TSX manipulation | Code-aware selection and transformations |
| Preview bridge | Versioned iframe/window transport, Onlook-derived instrumentation | DOM-to-source and live preview synchronization |
| Monorepo | Bun workspaces (initial source baseline uses Bun 1.3.1) | Minimize toolchain churn while extracting Onlook |
| Desktop | Electron (**proposed**) | Real local filesystem, preview processes and existing ecosystem |
| Local index | SQLite (**optional lightweight index**) | Recent projects, workspace metadata; NOT source-of-truth for code |
| Local user files | Native OS filesystem + atomic writes | Offline and source ownership |

V1 supported project stack: Next.js, React, TypeScript and Tailwind CSS. HTML-only or other frameworks require separate verified adapters; no blanket compatibility claim.

## 3. Cloud backend / persistence

| Layer | Technology | Notes |
|---|---|---|
| API | Node.js/TypeScript backend; tRPC or typed REST | tRPC matches Onlook's existing patterns, but enforce explicit authorization |
| Auth verification | Clerk server SDK + JWKS | Backend checks claims; use application membership tables for resource ACL |
| Native desktop cloud sign-in | Clerk Electron SDK (validate in spike) | No login for local-only mode |
| ORM / migrations | Drizzle ORM + SQL migrations | Matches Onlook familiarity, portable schema |
| Relational DB | Railway PostgreSQL | Backups/PITR, pooling and restore testing configured explicitly |
| Project archives / assets | Railway S3-compatible Buckets (**proposed**) | Content-addressed keys; presigned URL access; bucket lacks built-in versioning |
| Job queue | PostgreSQL-backed queue/outbox at low volume | Durable leases, retries, idempotent processing; Redis optional later |
| AI execution | Dedicated worker service on Railway | Orchestrator only; never run user code in its main container |
| Untrusted project execution | Isolated ephemeral sandbox provider (**TBD**) | Enforce namespace/VM separation, resource caps, process/network controls |
| Payments | Stripe | Subscription collection and webhook verification; allstudio ledger authoritative |
| Analytics | PostHog with disclosure/consent policy | No raw source/project content by default |
| Error reporting | Sentry | Avoid secret and prompt leakage |

## 4. AI, design systems, and agents

| Layer | Technology / approach |
|---|---|
| Provider client | Vercel AI SDK + OpenRouter provider adapter (check exact supported versions at implementation) |
| Orchestration | Allstudio `AgentExecutor` bounded state machine; reuse selected Onlook agent tools |
| Code edit tools | Workspace-port reads, AST patches, file diff validation, compile/lint checks |
| Art direction | Versioned `DESIGN.md` contract + structured design tokens + approved references |
| Visual critique | Playwright or browser screenshots + multimodal model evaluation + deterministic checks |
| Guardrails | Project-scoped tools, per-run budget, call/time limits, human approval for destructive actions |
| Local BYOK | External provider keys or approved installed agents; keychain for secrets |
| MCP | Official Model Context Protocol TypeScript SDK + Zod schemas, project-level scopes |

**Subscription warning:** consumer Claude/ChatGPT plans do not imply broad third-party API entitlements. Only integrate paid-plan connections using official permitted workflows; otherwise BYOK is a separate provider/API bill.

## 5. GitHub and deployment

- **GitHub App/OAuth:** repository permission scopes limited to approved repos; import read-only by default; user-approved commits/pushes only.
- **Railway:** distinct `web`, `api`, `agent-worker` services plus PostgreSQL; private service-to-service networking and env-var isolation. Preview sandboxes should not share API secrets.
- **CI/CD:** GitHub Actions for lint, TypeScript, unit/integration tests, security checks, and signed desktop artifacts. Railway deployments per environment; production DB migrations gated.
- **Local development:** dev Postgres via Docker Compose or Railway dev env; local project fixtures bundled; never use production secrets locally.

## 6. Testing and quality

| Level | Tool / goal |
|---|---|
| Unit | Vitest or package-native runner; AST transforms, utility functions, ledger math |
| Editor E2E | Playwright against Next.js/Tailwind fixtures; edit → code diff → screenshot |
| API integration | Test PostgreSQL migrations, ACL/IDOR, storage/signed URL, auth verification |
| Security | Sandbox boundary tests, path traversal, SSRF, webhook replay and auth bypass |
| Cloud generation | Fixture briefs, build success, responsive screenshots, design review benchmark |
| Desktop | Install/open/restart/offline/save/export smoke tests on supported OS |
| Billing | Concurrent reservations, retries, cancellations, partial settlements and refunds |

## 7. Package and version policy

Pin exact versions via lockfile after a successful upstream proof. Do not automatically lift the baseline repository's dependency versions into new production services without compatibility/security review. Prefer one TypeScript version and one React major version per monorepo; test extracted Onlook code under that version. Keep database and persisted project metadata schema migrations backward-compatible across supported releases.

## 8. Variables (names illustrative, never put secrets in source)

| Component | Example variable |
|---|---|
| web | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL` |
| api | `CLERK_SECRET_KEY`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| worker | `OPENROUTER_API_KEY`, `DATABASE_URL`, `OBJECT_STORAGE_*`, `SANDBOX_*` |
| object storage | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| telemetry | `SENTRY_DSN`, `POSTHOG_KEY` (privacy configuration required) |

Never expose `OPENROUTER_API_KEY`, Clerk secret keys, GitHub private keys, payment secrets, or object storage write credentials to client bundles or generated site sandboxes.

## 9. Open technical decisions

1. Exact desktop packaging and supported operating systems after first editor/offline spike.
2. Sandbox supplier/runtime and preview isolation/egress policy.
3. tRPC vs typed REST (either acceptable when access checks and schema contracts are enforced).
4. Queue implementation and load-based migration threshold.
5. Public open-source license and degree of cloud engine source publication.
6. Credit value, plans, and retention limits after real benchmark data.

## Sources

- Onlook README and package declarations: https://github.com/onlook-dev/onlook
- Railway platform services: https://docs.railway.com/services
- Railway PostgreSQL: https://docs.railway.com/databases/postgresql
- Railway storage buckets: https://docs.railway.com/storage-buckets
- Clerk docs (web + Electron support): https://clerk.com/docs
- Clerk manual session verification: https://clerk.com/docs/guides/sessions/manual-jwt-verification
