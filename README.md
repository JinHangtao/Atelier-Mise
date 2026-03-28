<div align="center">

# Portfolio Sensei

**AI-powered portfolio advisor for competitive art & design school applicants.**

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)](https://portfolio-sensei-ruby.vercel.app/en/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**[Live Demo](https://portfolio-sensei-ruby.vercel.app/en/) · [Report Bug](../../issues) · [Request Feature](../../issues) · [Documentation](../../wiki)**

</div>

---

## Overview

Breaking into a competitive art or design program requires more than talent — it requires a portfolio that communicates intent, coherence, and artistic identity under institutional pressure. Most applicants navigate this process without structured feedback, relying on word-of-mouth or costly private consultants.

**Portfolio Sensei** is an open-source, AI-assisted web application that democratizes access to high-quality portfolio critique and application guidance. It offers structured review workflows, statement of purpose tooling, and project export utilities — all deployable in minutes, or usable immediately via the hosted version.

> Built by an art student in the program, for art students in the process.

---

## Two Ways to Use

### Option A — Use the Hosted Version

No installation. No configuration. Open the app and start working.

[![Open App](https://img.shields.io/badge/Open_App-portfolio--sensei-black?style=for-the-badge&logo=vercel&logoColor=white)](https://portfolio-sensei-ruby.vercel.app/en/)

Suitable for applicants who want immediate access to the tool without any technical setup.

---

### Option B — Self-Host & Customize

Clone the repository, connect your own AI API keys, and adapt the application to your specific workflow — custom models, additional languages, institution-specific prompts, or a fully rebranded deployment.

Full setup instructions in the [Getting Started](#getting-started) section below.

---

## Features

| Feature | Description |
|---|---|
| 🖼 **Portfolio Review** | Structured AI critique covering composition, concept clarity, and series coherence |
| ✍️ **Statement of Purpose** | Guided prompts to help applicants articulate their practice and intentions |
| 📁 **Project Export Editor** | Organize, annotate, and export portfolio work with contextual framing |
| 🌐 **Multilingual Interface** | English supported; additional languages in progress |
| 🔌 **Flexible AI Backend** | Compatible with Gemini API and OpenRouter — swap models without changing application logic |
| ⚙️ **Self-Hostable** | Full source available under MIT license; deploy to any Node-compatible environment |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) — App Router |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| AI Providers | [Google Gemini](https://ai.google.dev/) · [OpenRouter](https://openrouter.ai/) |
| Font System | [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) + Geist |
| Deployment | [Vercel](https://vercel.com/) |

---

## Getting Started

### Prerequisites

- Node.js `>= 18.17.0`
- npm, yarn, pnpm, or bun
- A valid API key from [Google AI Studio](https://aistudio.google.com/) or [OpenRouter](https://openrouter.ai/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/portfolio-sensei.git
cd portfolio-sensei

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Choose one provider
GEMINI_API_KEY=your_gemini_api_key_here
# or
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

```bash
# 4. Start the development server
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
portfolio-sensei/
├── app/
│   ├── [locale]/              # i18n route segments (en, zh, ...)
│   │   ├── page.tsx           # Landing page
│   │   ├── review/            # Portfolio review workflow
│   │   └── statement/         # Statement of purpose tooling
│   └── api/                   # AI route handlers
├── components/                # Shared UI components
├── lib/
│   ├── ai.ts                  # AI provider abstraction layer
│   └── utils.ts               # Shared utilities
├── public/                    # Static assets
├── .env.example               # Environment variable reference
└── next.config.ts             # Next.js configuration
```

---

## Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/portfolio-sensei)

Set your environment variables in the Vercel dashboard after deployment.

### Other Platforms

This is a standard Next.js application compatible with any Node.js-capable host:

| Platform | Command / Method |
|---|---|
| **Railway** | `railway up` |
| **Render** | Connect GitHub repo; build command: `npm run build` |
| **Docker** | See [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) |
| **VPS (nginx/Caddy)** | `npm run build && npm start` |

---

## Motivation

Art school admissions are opaque by design. Selection committees evaluate work through criteria that are rarely made explicit to applicants — coherence of practice, conceptual maturity, evidence of intent. Most candidates have no systematic way to stress-test their portfolios against these standards before submission.

Portfolio Sensei applies AI reasoning to this problem: not as a replacement for human mentorship, but as an always-available, structured thinking partner that asks the same questions a rigorous faculty reviewer would.

> *"If you're a student today, you'd be an idiot not to learn this."*  
> — Rick Dakan, AI Task Force, Ringling College of Art and Design

---

## Roadmap

- [ ] Image upload and visual portfolio analysis
- [ ] Institution-specific prompt sets (RISD, Parsons, Central Saint Martins, Accademia di Belle Arti di Roma, etc.)
- [ ] Statement of Purpose multi-draft version comparison
- [ ] Full Chinese language support (`zh-CN`)
- [ ] Mobile-optimized layout
- [ ] Portfolio PDF export
- [ ] Saved sessions and review history

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes.

```bash
# Fork the repository, then:
git checkout -b feat/your-feature-name

# Commit with a clear, conventional message
git commit -m "feat: describe the change concisely"

git push origin feat/your-feature-name
# → Open a pull request against main
```

Issues tagged [`good first issue`](../../issues?q=label%3A%22good+first+issue%22) are suitable entry points for new contributors.

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for full terms.

---

## Acknowledgements

- [Next.js](https://nextjs.org/) — React framework
- [Vercel](https://vercel.com/) — Hosting and deployment infrastructure
- [Google Gemini](https://ai.google.dev/) — AI inference
- [OpenRouter](https://openrouter.ai/) — Multi-model AI routing
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first styling

---

<div align="center">

**[portfolio-sensei-ruby.vercel.app/en](https://portfolio-sensei-ruby.vercel.app/en/)**

*Open source · Self-hostable · Built for applicants who take their work seriously.*

</div>
