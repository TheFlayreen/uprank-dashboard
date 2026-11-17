# Engineering conventions

These rules apply to everyone who changes this repo, human or AI. When a rule and the code disagree, fix the code or change the rule in the same PR. Don't leave them out of sync.

## 1. Architecture

```
src/
  app/                 Next.js routes only: page.tsx, layout.tsx, api/*/route.ts
  components/
    ui/                Generic, data-agnostic building blocks (Section, StatTile, Tooltip…)
    dashboard/<area>/  Feature components, one folder per dashboard area
  lib/                 Framework-free helpers shared by server and client (formatting)
  server/
    sources/           HTTP clients for external APIs (one file per API)
    sync/              ETL: API → Postgres
    facts/             Join of the two systems → ClientFact[] (the only reconciliation point)
    metrics/           Pure metric functions + their *.test.ts
    dashboard.ts       Assembles metrics into the display-ready payload
    db.ts              Prisma client singleton
  generated/           Prisma client output (never edit, never commit)
prisma/                Schema + migrations
scripts/               CLI entry points (sync, exploration)
```

**Dependency direction is one-way:** `app → components → lib` and `app → server`.
- `components/` never imports runtime code from `server/`. Type-only imports (`import type`) are fine.
- `server/metrics/` never imports Prisma, `fetch`, or Next.js. It takes `ClientFact[]` plus a reference date and returns plain data.
- Only `server/facts/` knows how billing and product records relate. If you need a new joined field, add it to `ClientFact`. Don't re-join in a metric.

**Pure and I/O code live in different files.** A module that computes things (`buildDashboard.ts`, `briefing.ts`, `metrics/*`) never imports `db.ts`, so tests can import it without a database. The I/O wrapper (`dashboard.ts`, `facts/index.ts`) loads the data and calls the pure function.

**Route handlers and pages stay thin.** They call one server function, handle errors, and return or render. Business logic doesn't belong in `app/`.

## 2. Data and metric rules

- **"Today" is the reference date** from the API (`X-Mock-Reference-Date`, stored per sync). Never call `new Date()` or `Date.now()` in metric code; take `ref: Date` as a parameter.
- **Money is in integer cents** until it's displayed. Convert with `dollars()` at the edge of the metric.
- **Months are `"YYYY-MM"` strings in UTC.** Use the helpers in `server/facts/time.ts` (`addMonths`, `lastFullMonth`, `monthsBetween`). Never hand-roll date maths.
- **Missing ≠ zero.** Never zero-fill gaps in source data.
- **Every by-group comparison shows its sample size** and uses `sampleConfidence()`. Groups with n < 5 make no claims.
- **One rule, one function.** If the live dashboard and an analysis (e.g. the backtest) use the same rule, they call the same function (see `leadWarningAt`).
- **Thresholds and weights are named constants** at the top of their module (`HEALTH_RULES`, `LEAD_RULES`…), never inline magic numbers.
- **Every metric definition change is mirrored in `METRICS.md`** in the same change.

## 3. Components

### One component per file
- A file exports **exactly one** React component, and the file is named after it (`ChurnTrendChart.tsx` → `export function ChurnTrendChart`).
- No private helper components in the same file. If a piece of JSX deserves a name, it deserves a file. Small non-component helpers (pure functions, constants, types) used only by that component may stay in the file.
- A feature area with several components gets its own folder under `components/dashboard/<area>/`, with a `<Area>View.tsx` that composes the parts.

### Naming
- Components and their files are `PascalCase`. Hooks are `useSomething.ts`. Helpers are `camelCase.ts`.
- Suffix by role: `…Chart` (draws data), `…Table`, `…List`, `…View` (composes a section), `…Panel`, `…Tile`.
- Props interfaces are `<Component>Props`, declared right above the component.

### Server vs. client
- **Server Components are the default.** Add `"use client"` only for state, effects, event handlers or browser APIs, and keep that boundary as low in the tree as possible (e.g. `CallList`, `RefreshButton`, `SectionSidebar`, not the whole page).
- The dashboard is deliberately **one page** (the brief asks for one view, and the sections tell one story). Navigation is a scroll-spy table of contents: `SectionSidebar` on lg+, `SectionTabs` below. A new section is added to `dashboardSections.ts` with an id matching its `Section`.
- Client components receive **plain serialisable props** that are already computed. They never fetch or compute metrics.
- Pages that read live data call `await connection()` inside a `<Suspense>` boundary. `cacheComponents` is on, so don't use `export const dynamic`.

### Rendering must be deterministic
- Don't use `Intl` or `toLocale*` for anything that renders in a client component. Node and browsers format differently, and that breaks hydration. Use `lib/format.ts`.
- No `Date.now()`, `Math.random()` or `typeof window` branches during render. The only exception is `ui/InlineScript` (pre-paint script pattern from the Next.js docs).
- Theme: System / Light / Dark via `ThemeToggle`. The choice lives in `localStorage` and is applied as `data-theme` on `<html>` by a pre-paint script, so there's no flash. Dark tokens in `globals.css` exist twice (media query + `[data-theme="dark"]`); change both.

### Props and composition
- Keep props minimal: pass the slice of data the component draws, not the whole dashboard.
- Prefer composition (`children`, small components) to boolean props that switch layouts.
- No default exports, except where Next.js requires them (`page.tsx`, `layout.tsx`).

## 4. Styling and data-viz

- Tailwind utilities only, with colours from the design tokens in `globals.css` (`bg-surface`, `text-ink-2`, `bg-series-1`…). **Never use raw hex in components.** If a colour is missing, add a token for both light and dark.
- **Visual style is minimal / Swiss.** Zinc neutrals, one typeface (Plus Jakarta Sans via `next/font`), no shadows or gradients. Sections have no card chrome: a top hairline and whitespace separate them. Borders are reserved for things you can act on or compare (KPI grid, action cards, call-list cards, tables).
- **`accent` is for links and focus rings only**, never a data series. Every interactive element gets the global `:focus-visible` outline and a 150–250ms colour transition; motion is disabled under `prefers-reduced-motion`. Tap targets are at least 40px tall.
- **Status colours** (`critical`, `serious`, `warning`, `good`) mean state, and always appear with a text label or icon. They are never used as series colours or decoration.
- **Series colours** are `series-1`, then `series-2`, in that order. "Not enough data" is shown with the `.hatch` texture or `series-off`, not with a new colour.
- Charts use one y-axis, thin marks, hairline solid gridlines and selective direct labels (not a number on every point). Every chart has a text caption explaining how to read it, and a tooltip or `<title>` for exact values.
- Layout works from 375px wide with no horizontal page scroll. A wide table becomes cards on mobile when it's a primary workflow (the call list); otherwise it scrolls inside its own container.
- SVG charts scale with their viewBox, so text shrinks on small screens. Charts take a `width` prop and are rendered twice, narrow (`sm:hidden`) and wide (`hidden sm:block`), so text stays at least ~11px on screen. Minimum text size in HTML is 12px (`text-xs`).
- Text colours must reach at least 4.5:1 contrast on the surface they sit on, in both themes. Check new tokens before adding them.

## 5. Accessibility

- Every section has a heading, and `Section` wires up `aria-labelledby`.
- Charts are `role="img"` with an `aria-label` summarising them. Tables have a `<caption>` (it can be `sr-only`).
- Interactive things are real `<button>` and `<a>` elements with visible focus styles. Toggles expose `aria-expanded`.
- Colour is never the only carrier of meaning.

## 6. Testing

- Every function in `server/metrics/` and `server/facts/` has unit tests next to it (`*.test.ts`, Vitest).
- Build test data with the factories in `server/test/fixtures.ts`. Don't hand-write full objects in each test.
- When a test fails, first decide whether the **test** or the **code** is wrong, and say which in the commit.
- Analyses that look at history (like the backtest) need a test proving they don't use future data.

## 7. Code style

- TypeScript strict. No `any`. Prefer `unknown` + narrowing.
- Comments explain **why** (a business rule or a data quirk), not what the next line does.
- Named exports only (except Next.js special files).
- Keep functions short and pure where possible. A function that needs more than ~3 levels of nesting should be split.

## 8. Before you call it done

```bash
npm run typecheck && npm run lint && npm test
```

Then open the page, in both light and dark mode, and at both mobile and desktop width, and check the console for hydration errors.
