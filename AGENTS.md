# Repository Guidelines

## Project Structure & Module Organization
- `app/` — Next.js App Router pages, layouts, and global styles (`app/globals.css`, `app/layout.tsx`, `app/page.tsx`).
- `components/` — Reusable React components (name files `PascalCase.tsx`).
- `lib/` — Non-UI helpers and config (name files `camelCase.ts`).
- `public/` — Static assets served at the site root (e.g., `/background.jpg`, `/photos/...`).
- Config: `next.config.js`, `tailwind.config.ts`, `tsconfig.json` (alias `@/*`), `.eslintrc.json`.

## Build, Test, and Development Commands
- `npm run dev` — Start the dev server with HMR.
- `npm run build` — Production build of the Next.js app.
- `npm run start` — Serve the production build.
- `npm run lint` — ESLint with Next Core Web Vitals rules.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer explicit types on exported APIs.
- Indentation: 2 spaces; keep diffs minimal and focused.
- React: `.tsx` components; default to server components. Use `'use client'` only when needed.
- Imports: prefer alias `@/` for absolute paths (e.g., `import Gallery from '@/components/Gallery'`).
- Styling: Tailwind utilities in JSX; global styles live in `app/globals.css`.

## Testing Guidelines
- No test framework is configured yet. If adding tests, colocate in `__tests__/` or alongside files, name `*.test.ts(x)`, and prefer Jest + React Testing Library. Keep logic in `lib/` for easier unit tests.

## Commit & Pull Request Guidelines
- No strict convention in history; adopt Conventional Commits going forward (e.g., `feat:`, `fix:`, `chore:`).
- PRs: clear description, linked issues, screenshots/GIFs for UI changes, note breaking changes, and run `npm run lint` before pushing. Include reproduction or manual QA steps where relevant.

## Security & Configuration Tips
- Use `.env.local` for secrets; public vars must be prefixed `NEXT_PUBLIC_`. Do not commit `.env*` files.
- Recommended runtime: Node 18+.
- Large images belong in `public/` and should be optimized before commit.

## Agent & Automation Notes
- Follow existing patterns in `components/` and `lib/`; avoid unnecessary refactors.
- Do not add or change dependencies without discussion.
- Update this document when conventions evolve.

