# Security

Report security issues privately to the founder. Do not open public GitHub issues for secrets, credential leaks, or privilege-escalation reports until a public process is published.

## Public repository rules

- Never commit `.env` files, API keys, Clerk/Stripe/OpenRouter secrets, or private cloud source.
- Local editing must work without allstudio cloud credentials.
- Untrusted project previews must not receive privileged Electron IPC. Electron is not in this scaffold yet.
- Run `bun run validate:public-boundary` before opening a pull request once Git exists.
