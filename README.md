# 🎨 Portfolio Sensei

> **AI-powered mentor for art school applicants — from blank canvas to acceptance letter.**

Live at → **[portfolio-sensei-ruby.vercel.app/en](https://portfolio-sensei-ruby.vercel.app/en)**

---

## What is this?

Getting into art school is hard. Your portfolio has to speak before you do.

**Portfolio Sensei** is a Next.js web app that uses AI to help applicants build stronger, more intentional portfolios for competitive fine art and design programs. Think of it as a brutally honest mentor who's seen thousands of portfolios — available at 3am when your submission deadline is tomorrow.

Built by an art student, for art students. No generic advice. No padding.

---

## Features

- 🖼 **Portfolio Review** — AI feedback on composition, coherence, and concept clarity
- ✍️ **Statement of Purpose Assistant** — structured prompts to help you articulate your practice
- 📁 **Project Export Editor** — organize and export your work with context and intent intact
- 🌐 **Multilingual** — English + more coming
- ⚡ **Powered by Gemini / OpenRouter** — fast, context-aware AI responses

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Gemini API / OpenRouter |
| Font | [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) + Geist |
| Deploy | [Vercel](https://vercel.com/) |

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/JinHangtao/portfolio-sensei.git
cd portfolio-sensei

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# → Fill in your API keys

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```env
GEMINI_API_KEY=your_key_here
# or
OPENROUTER_API_KEY=your_key_here
```

---

## Project Structure

```
app/
├── [locale]/          # i18n routing (en, zh, ...)
│   ├── page.tsx       # Landing page
│   └── review/        # Portfolio review flow
├── api/               # AI route handlers
components/            # Shared UI
lib/                   # AI client, utils
public/                # Static assets
```

---

## Why This Exists

> "Even the most angry illustration faculty have said: if you're a student today, you'd be an idiot not to learn this."
> — Rick Dakan, AI Task Force, Ringling College of Art and Design

Art school applications are opaque. Most applicants have no access to real feedback before submission. Portfolio Sensei exists to change that — giving every applicant the kind of structured, honest critique that used to require expensive consultants or insider connections.

---

## Roadmap

- [ ] Image upload + visual portfolio analysis
- [ ] School-specific guidance (RISD, Parsons, Central Saint Martins, Accademia di Belle Arti...)
- [ ] Statement of Purpose multi-draft comparison
- [ ] Chinese language full support (zh-CN)
- [ ] Mobile-first redesign

---

## Contributing

PRs welcome. Open an issue first if it's a big change.

```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: describe what you did"
git push origin feat/your-feature
# → open a PR
```

---

## Deploy

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/JinHangtao/portfolio-sensei)

---

## License

MIT — do whatever you want, just don't resell it as-is.

---

<p align="center">Made with frustration and caffeine · <a href="https://portfolio-sensei-ruby.vercel.app/en">Try it live</a></p>
