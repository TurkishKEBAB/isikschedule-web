# Design Handoff Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the production IşıkSchedule frontend into focused visual parity with the supplied design handoff without changing existing scheduler, upload, generation, sharing, export, or i18n behavior.

**Architecture:** Keep the existing Tailwind theme and component structure. Add one small shared brand component backed by the supplied torch-flame app icon, then apply narrowly scoped class changes to the existing screens. Use a lightweight source-contract test plus the production build and browser checks to protect the requested assets, print rules, reduced-motion rules, and real interactions.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, `next/image`, lucide-react, Node.js source-contract test.

---

### Task 1: Add a failing parity contract

**Files:**
- Create: `frontend/scripts/check-design-parity.mjs`
- Modify: `frontend/package.json`

- [ ] Add a Node script that checks the supplied brand asset exists, relevant screens use `BrandLogo`, brand placeholders are removed from logo positions, and print/reduced-motion CSS remains present.
- [ ] Add `test:design` to `frontend/package.json`.
- [ ] Run `npm run test:design` and verify it fails because the asset/component integration does not exist yet.

### Task 2: Add the supplied brand asset and shared logo

**Files:**
- Create: `frontend/public/brand/app-icon-calendar-flame.png`
- Create: `frontend/app/components/BrandLogo.tsx`

- [ ] Copy the supplied torch-flame app icon into the production public assets.
- [ ] Implement `BrandLogo` with responsive `sm`, `md`, and `lg` sizes using `next/image`.
- [ ] Keep the visible wordmark as live text for dark-background readability and accessibility.
- [ ] Run `npm run test:design`; expect remaining screen-integration failures.

### Task 3: Align shared navigation, landing, and authentication

**Files:**
- Modify: `frontend/app/components/Navbar.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/register/page.tsx`
- Modify: `frontend/app/globals.css`

- [ ] Replace logo-position `GraduationCap` placeholders with `BrandLogo`.
- [ ] Preserve all links, mobile navigation, auth redirects, validation, loading, and language behavior.
- [ ] Apply the handoff's floating glass navigation and aurora-backed auth surface using existing Tailwind utilities.
- [ ] Align only deviating shared values such as panel background, border softness, inset ring, and mono time labels; keep the Tailwind token system intact.
- [ ] Run `npm run test:design`.

### Task 4: Align scheduler and generated-results shells

**Files:**
- Modify: `frontend/app/scheduler/page.tsx`
- Modify: `frontend/app/components/GeneratedSchedulesView.tsx`

- [ ] Replace the scheduler logo placeholder and results header emblem with `BrandLogo`.
- [ ] Keep the existing three-column catalog/grid/build-panel layout and all current uncommitted preference/scoring work.
- [ ] Align rail fills, glass borders, header spacing, and results heading/card density to the handoff without transplanting prototype components.
- [ ] Preserve locks, history, filters, generation, variants, compare, favorites, share, QR, iCal, and print callbacks.
- [ ] Run `npm run test:design`.

### Task 5: Verify production, print, motion, and responsive behavior

**Files:**
- Review: all modified frontend files

- [ ] Run `npm run build`.
- [ ] Start the frontend and backend using the repository run skill.
- [ ] Browser-check landing, login, scheduler, and generated results at desktop and mobile widths.
- [ ] Emulate `prefers-reduced-motion: reduce` and confirm decorative animations are disabled.
- [ ] Emulate print media on the scheduler and confirm navigation/rails are hidden while the schedule remains legible.
- [ ] Check for Next.js error overlays and browser console errors.
- [ ] Review the final diff for accidental behavior changes and unrelated file churn.

No commit steps are included because the worktree already contains user-owned uncommitted changes in the same scheduler/results files.
