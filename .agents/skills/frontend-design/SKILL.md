---
name: frontend-design
description: >-
  Create distinctive, production-grade frontend interfaces with high design quality.
  Use this skill when the user asks to build, refactor, or audit web components, pages,
  artifacts, posters, or applications in the Mameko ecosystem.
---

# Mameko Frontend Design Standard (Anti-AI-Slop & Editorial Artisanal Luxury)

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details, creative choices, and strict compliance with Mameko's architectural laws (`mameko-ui-ux-pro-max` & `mameko-values-and-database-integrity`).

---

## 1. Design Thinking

Before coding, understand the context and commit to a **BOLD aesthetic direction**:
- **Purpose**: What problem does this interface solve? Who uses it? (In Mameko: Artisanal Craftsmanship flagship retail & high-precision order/chat management).
- **Tone**: Commit to **Editorial Artisanal Luxury & Tactile Minimalism** (drawing from *Aesop, SSENSE, Byredo, Apple*): generous breathing room, crisp `1px` hairline structural borders, open-tracked uppercase serif display typography (`Tenor Sans`), warm *Volcanic Amber Gold* accents, and responsive spring physics.
- **Constraints**: Next.js 15 App Router, React 19, CSS Modules (`*.module.css`), 100% Zero Hardcode (all copy in `src/data/ui/*Config.json`, all colors via semantic CSS tokens in `src/app/globals.css`), WCAG 2.1 AAA contrast, and 48px minimum touch targets.
- **Differentiation**: What makes this UNFORGETTABLE? Subtle micro-grain film overlays (`0.035` opacity), warm volcanic amber radial spotlights (`rgba(var(--secondary-rgb), ...)`), staggered entrance choreography, and tactile spring press physics (`scale(0.97)` with `cubic-bezier(0.34, 1.56, 0.64, 1)`).

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

---

## 2. Frontend Aesthetics Guidelines

Focus on:
- **Typography**:
  - Choose fonts that are beautiful, unique, and interesting.
  - **NEVER** use generic overused fonts (`Inter`, `Roboto`, `Arial`, `system-ui`, or raw `monospace` / `Courier New`) or undefined CSS font variables (such as `--font-cormorant`).
  - Use Mameko's curated font tokens:
    - `var(--font-serif)` (`Tenor Sans`) for Display, Headlines, and Editorial Section Titles with deliberate letter-spacing (`0.06em`–`0.12em`).
    - `var(--font-sans)` (`Lato`) for clean body copy, forms, and high-density UI controls.
    - `var(--font-mono)` with `font-variant-numeric: tabular-nums` for Order IDs, tracking codes, voucher codes, and financial figures.
- **Color & Theme**:
  - Commit to a cohesive aesthetic using CSS variables from `src/app/globals.css` (`60%` Frosted Quartz / Deep Volcanic Obsidian canvas, `30%` Slate/Titanium surface with `1px` border, `10%` Volcanic Amber Gold `--secondary` accent).
  - **NEVER** use cliched AI-generated color schemes — particularly **purple/violet gradients on white backgrounds** (`rgba(147, 51, 234, ...)`, `rgba(139, 92, 246, ...)`).
  - **NEVER** hardcode literal `#hex` or `rgba(R, G, B, A)` status/accent colors in `*.module.css`. Always use semantic tokens (`var(--danger-bg)`, `var(--danger-border)`, `var(--success-bg)`, `var(--warning-bg)`, `var(--info-bg)`, `var(--secondary-container)`, or `rgba(var(--secondary-rgb), <alpha>)`) so Light Mode and Dark Mode both maintain razor-sharp contrast.
- **Motion**:
  - Use animations for effects and micro-interactions. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (`.reveal-editorial`, `.stagger-1`..`.stagger-4`) creates more delight than scattered, noisy micro-interactions.
  - Respect `prefers-reduced-motion: reduce` for accessibility.
- **Spatial Composition**:
  - Unexpected editorial layouts, asymmetry, controlled overlap, generous negative space on storefront pages, and crisp tabular density on Admin/User dashboards.
- **Backgrounds & Visual Details**:
  - Create atmosphere and depth rather than defaulting to flat solid colors. Combine subtle SVG noise grain, `backdrop-filter: blur(16px)` glassmorphism (`rgba(var(--surface-primary-rgb), 0.78)`), and warm amber/slate radial illumination.

---

## 3. Pre-Commit Aesthetic & Token Verification

Before completing any frontend task, run these checks to verify zero regressions:

```powershell
# 1. Verify no cliched purple gradients or undefined font tokens exist
Select-String -Path "src\**\*.module.css" -Pattern "147,\s*51,\s*234|139,\s*92,\s*246|--font-cormorant|\bInter\b|\bRoboto\b|\bArial\b"

# 2. Verify TypeScript & Unit Tests
npx tsc --noEmit
npm test
```

