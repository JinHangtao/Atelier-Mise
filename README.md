<div align="center">

# Portfolio Sensei

**AI-powered portfolio advisor for art & design school applicants.**

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=flat-square&logo=vercel)](https://portfolio-sensei-ruby.vercel.app/en/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

[**Live Demo**](https://portfolio-sensei-ruby.vercel.app/en/) &nbsp;·&nbsp;
[**Report a Bug**](../../issues/new?template=bug_report.md) &nbsp;·&nbsp;
[**Request a Feature**](../../issues/new?template=feature_request.md) &nbsp;·&nbsp;
[**Documentation**](../../wiki)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Two Ways to Use](#two-ways-to-use)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

Getting into a competitive art or design program requires more than talent. Selection committees evaluate for coherence of practice, conceptual maturity, and clarity of intent — criteria that are rarely made explicit to applicants. Most candidates navigate this process without structured feedback.

**Portfolio Sensei** is an open-source, AI-assisted web application that gives every applicant access to the kind of rigorous, structured portfolio critique that used to require expensive consultants or institutional access. It is available immediately as a hosted web app, or self-hostable and fully customizable for developers who want to adapt it.

> Built by an art student, for art students.

---

## Two Ways to Use

### Option A — Use the Hosted Version

No installation. No configuration. Open the link and start working immediately.

[![Open App](https://img.shields.io/badge/Open_App-portfolio--sensei-black?style=for-the-badge&logo=vercel&logoColor=white)](https://portfolio-sensei-ruby.vercel.app/en/)

Suitable for applicants who want immediate access without any technical setup.

---

### Option B — Self-Host & Customize

Clone the repository, connect your own AI API keys, and adapt the project to your needs — custom models, additional languages, institution-specific prompts, or a fully rebranded deployment. Instructions in the [Getting Started](#getting-started) section.

---

## Features

| | Feature | Description |
|---|---|---|
| 🖼 | **Portfolio Review** | Structured AI critique covering composition, concept clarity, and series coherence |
| ✍️ | **Statement of Purpose** | Guided prompts to help applicants articulate their practice and creative intentions |
| 📁 | **Project Export Editor** | Organize, annotate, and export portfolio work with contextual framing |
| 🌐 | **Multilingual** | English supported; additional languages in progress |
| 🔌 | **Flexible AI Backend** | Compatible with Gemini API and OpenRouter — swap models without changing application logic |
| ⚙️ | **Self-Hostable** | Full source under MIT license; deploy to any Node-compatible platform |

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

- **Node.js** `>= 18.17.0` — [download](https://nodejs.org/)
- **Package manager** — npm, yarn, pnpm, or bun
- **API key** — [Google AI Studio](https://aistudio.google.com/), [OpenRouter](https://openrouter.ai/), [Groq](https://console.groq.com/keys) 

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/portfolio-sensei.git
cd portfolio-sensei
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your credentials:

```env
# Pick one AI provider

GEMINI_API_KEY=your_gemini_api_key_here

# or

OPENROUTER_API_KEY=your_openrouter_api_key_here

# or — recommended (free tier available, extremely fast inference)
# Get your key at: https://console.groq.com/keys

GROQ_API_KEY=your_groq_api_key_here
```

**4. Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/portfolio-sensei)

After deployment, set your environment variables in the Vercel project dashboard.

### Other Platforms

Portfolio Sensei is a standard Next.js application and can be deployed anywhere that supports Node.js:

| Platform | Method |
|---|---|
| **Railway** | `railway up` |
| **Render** | Connect GitHub repo — build: `npm run build`, start: `npm start` |
| **Docker** | [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) |
| **VPS (nginx / Caddy)** | `npm run build && npm start` |

---

## Roadmap

Contributions toward any of these are especially welcome.

- [ ] Image upload and visual portfolio analysis
- [ ] Institution-specific prompt sets (RISD, Parsons, Central Saint Martins, Accademia di Belle Arti di Roma, RCA, etc.)
- [ ] Statement of Purpose multi-draft version comparison
- [ ] Full Chinese language support (`zh-CN`)
- [ ] Mobile-optimized layout
- [ ] Portfolio PDF export
- [ ] Saved sessions and review history

See [open issues](../../issues) for the full list of proposed features and known issues.

---

## Contributing

Contributions are welcome and appreciated. Please follow these steps:

1. **Open an issue first** for significant changes — align before building
2. Fork the repository
3. Create a feature branch

```bash
git checkout -b feat/your-feature-name
```

4. Make your changes and commit using [Conventional Commits](https://www.conventionalcommits.org/)

```bash
git commit -m "feat: add institution-specific prompt selector"
```

5. Push and open a pull request against `main`

```bash
git push origin feat/your-feature-name
```

Issues labeled [`good first issue`](../../issues?q=label%3A%22good+first+issue%22) are a suitable starting point for new contributors.

---

## License

Distributed under the [MIT License](LICENSE). You are free to use, modify, and distribute this project. See `LICENSE` for full terms.

---

## Acknowledgements

- [Next.js](https://nextjs.org/) — React framework
- [Vercel](https://vercel.com/) — Hosting and deployment infrastructure
- [Google Gemini](https://ai.google.dev/) — AI inference
- [OpenRouter](https://openrouter.ai/) — Multi-model AI routing
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework
- [matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme) — README inspiration

---

<div align="center">

*Open source · Self-hostable · Built for applicants who take their work seriously.*

</div>
