# Git Forest

A cozy pixel-art web app that turns any public GitHub profile into an explorable forest. Every repository becomes a tree.

## Features

- `/[username]` routes — no login required
- Deterministic world seed from username hash
- PixiJS forest with pan, zoom, and keyboard movement
- Tree traits mapped from GitHub data (language, stars, forks, issues, archived)
- Seasons, weather, wildlife, and a day/night cycle
- Repository popup with stats and GitHub link

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · PixiJS · Zustand · Framer Motion

## Setup

```bash
npm install
cp .env.example .env.local   # optional: add GITHUB_TOKEN for higher rate limits
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Repo → tree mapping

| Trait | Source |
|--------|--------|
| Species | Dominant language |
| Height | Repo size + stars (log scale) |
| Flowers | Stars |
| Saplings | Forks |
| Bird nests | Open issues |
| Fireflies | Activity (stars + forks), at night |
| Dead tree | Archived repo |

## Scripts

- `npm run dev` — development server (Turbopack)
- `npm run build` — production build
- `npm start` — serve production build
