# Contributing to AgentKey

Thanks for your interest in contributing to AgentKey. We welcome bug reports, feature suggestions, and pull requests.

## Getting started

1. Fork the repository
2. Clone your fork and set up the dev environment:

```bash
cd app
cp .env.example .env.local
# Fill in DATABASE_URL, ENCRYPTION_KEY, and Clerk keys
npm install
npm run db:push
npm run dev
```

3. Create a branch for your change: `git checkout -b my-change`
4. Make your changes, test locally
5. Open a pull request against `main`

## What to contribute

Good first contributions:

- **Bug fixes** with a clear reproduction
- **Documentation improvements** — typos, unclear instructions, missing context
- **Integration examples** — snippets for agent frameworks (LangChain, CrewAI, AutoGPT, etc.)
- **UI improvements** — accessibility, responsiveness, dark mode refinements

Bigger contributions (please open an issue first to discuss):

- New API endpoints or schema changes
- New authentication methods
- Changes to the encryption or credential handling logic

## Guidelines

- Keep PRs focused — one change per PR
- Follow the existing code style (TypeScript, Tailwind, Drizzle ORM)
- Don't add dependencies without justification
- Security-sensitive changes (crypto, auth, credential handling) require extra review

## Security issues

If you discover a security vulnerability, **do not open a public issue**. Instead, email security@agentkey.dev. See our [responsible disclosure policy](https://agentkey.dev/security) for details.

## License

By contributing, you agree that your contributions will be licensed under the same [MIT license](LICENSE.md) that covers the project.
