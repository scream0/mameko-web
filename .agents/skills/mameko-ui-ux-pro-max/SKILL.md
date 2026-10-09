---
name: mameko-ui-ux-pro-max
description: >-
  Flagship UI/UX "Pro Max" design standard, token system, tactile motion physics,
  typography scales, anti-flicker transitions, and audit checklist for the Mameko
  ecosystem (Android Jetpack Compose & Next.js Web). Use whenever designing, review,
  styling, or refining UI components and user journeys.
---

# Mameko UI/UX "Pro Max" Design & Engineering Standard

This skill defines the mandatory design principles, design tokens, micro-interaction physics, typography scales, accessibility rules, and quality audit checklist for **Mameko** across native Android (`mameko-app`) and modern Web (`mameko-web`).

Our goal is an **Editorial Luxury E-Commerce Experience** that feels instantly premium, tactile, fluid, and delightful — drawing inspiration from high-end retail flagships (Apple, SSENSE, Aesop, Byredo).

---

## 1. The Seven Pillars of "Pro Max" Design

### Pillar 1: Harmonious 60-30-10 Color Architecture
Never use generic or jarring primaries. Adhere to our curated palette:
- **60% Canvas Dominant**:
  - *Light Mode*: Frosted Quartz (`#F8FAFC`).
  - *Dark Mode*: Deep Volcanic Obsidian (`#0D0F12`).
- **30% Structural Surfaces**:
  - *Light Mode*: Clean Slate Card (`#FFFFFF`) with 1px hairline border (`#E2E8F0`).
  - *Dark Mode*: Crisp Titanium Slate (`#15181E`) with 1px border (`#222732`).
- **10% Action / Accent**:
  - *Volcanic Amber Gold* (`#D97706` in Light, `#F59E0B` in Dark) for primary CTAs, star ratings, active indicators, and high-urgency badges.

#### Strict Prohibition: Zero Hardcoded Colors (TIDAK BOLEH ADA HARDCODE SAMA SEKALI)
- **DILARANG KERAS** menuliskan warna harfiah seperti `Color.White`, `Color.Black`, `Color.Red`, atau `Color(0xFF...)` di file UI/Composable.
- **Mandat Pasangan Kontras (Container-Content Pairing)**:
  Setiap komponen berlatar warna (Badge, Button, Surface, Chip) WAJIB menggunakan pasangan warnanya dari `MaterialTheme.colorScheme` atau `MaterialTheme.semanticColors`:
  - `containerColor = MaterialTheme.colorScheme.primary` WAJIB dipasangkan dengan `contentColor = MaterialTheme.colorScheme.onPrimary`.
  - `containerColor = MaterialTheme.colorScheme.secondary` WAJIB dipasangkan dengan `contentColor = MaterialTheme.colorScheme.onSecondary`.
  - `containerColor = MaterialTheme.colorScheme.error` WAJIB dipasangkan dengan `contentColor = MaterialTheme.colorScheme.onError`.
  - **Larangan Keras**: Jangan pernah memasangkan `containerColor = primary` dengan `Color.White` karena di Dark Mode `primary` adalah slate terang (`#F1F5F9`) sehingga teks putih menjadi 100% invisible!

### Pillar 2: Curated Editorial Typography
Typography is the voice of the brand.
- **Hierarchy Rules**:
  - **Display (36sp–57sp)**: Hero branding, flash sale percentages, and high-impact stat figures.
  - **Headline (24sp–32sp)**: Top screen titles, product detail titles, and primary modal headers.
  - **Title (14sp–22sp)**: Card headings, section dividers, bottom sheet titles.
  - **Body (12sp–16sp)**: Editorial descriptions, product notes, reviews, form field values.
  - **Label (10sp–14sp)**: Status badges, chips, action button text, countdown timers.
- **Tracking & Leading**:
  - Headlines use slightly tighter letter spacing (`-0.01em` to `-0.02em`) for a sharp, modern editorial feel.
  - Labels and small badges use uppercase with open tracking (`+0.05em`) for clarity and prestige.

### Pillar 3: Fluid Motion & Tactile Spring Physics
Digital elements should respond with natural physical weight:
- **Tactile Bouncy Click (`bouncyClickable`)**:
  - On press: Scale down smoothly to `0.97f` (stiffness `StiffnessMediumLow`, damping `0.75f`).
  - On release: Snap back with natural elasticity and trigger gentle haptic feedback.
  - Never allow buttons or cards to feel like static, unresponsive plastic.
- **Shimmer Sweeps**:
  - Shimmer loaders must flow at a 20-degree tilt over 1200ms with a soft alpha gradient (`0.1f` to `0.4f`).
  - Avoid harsh, flashing white bars.

### Pillar 4: Layered Depth & Modern Glassmorphism
- **4-Tier Elevation Model**:
  - **Level 0 (Canvas)**: Background.
  - **Level 1 (Card/List)**: Flat card surface with crisp 1px border.
  - **Level 2 (Navigation/Floating)**: TopAppBar and BottomDock with `backdrop-filter: blur(16px)` and translucent tint.
  - **Level 3 (Modal/Overlay)**: BottomSheet, Dialogs, and Toasts with smooth scrim dimming.

### Pillar 5: Thumb-Zone Ergonomics & 48dp Minimum Touch Targets
- All clickable items (icons, checkboxes, stepper buttons `+`/`-`) MUST satisfy a minimum touch target of **48dp x 48dp** (`minTouchTarget`) on mobile and **44px x 44px** on web.
- Critical purchase actions ("Beli Langsung", "Tambah ke Keranjang", "Bayar Sekarang") MUST reside in the bottom dock, reachable with one hand by the user's thumb.

### Pillar 6: Anti-Flicker & Zero Layout Shift (CLS)
- Skeletons must exactly match the aspect ratio and geometry of final content:
  - Product images: 1:1 square ratio (`.aspectRatio(1f)`).
  - Promo banners: 16:9 or 21:9 landscape ratio.
  - Avatars: Circle shape.
- Use `Crossfade` or `AnimatedContent` during state transitions (loading → content / empty state) to eliminate jarring white flashes.

### Pillar 7: Universal Accessibility (WCAG 2.1 AAA)
- Text contrast must exceed **4.5:1** for regular text and **3.0:1** for large bold titles against their background.
- Semantic icons and images must provide localized, descriptive `contentDescription` for screen readers (TalkBack / NVDA).

---

## 2. Design Tokens Reference

### Spacing Tokens (4-Point / 8-Point Grid)
```text
extraSmall : 4dp    // Micro gap between text and small icon
small      : 8dp    // Standard gap between items inside a row or card
semiMedium : 12dp   // Compact list and grid spacing
medium     : 16dp   // Standard screen padding & card padding
semiLarge  : 20dp   // Form input vertical gap
large      : 24dp   // Section divider margin
extraLarge : 32dp   // Modal header spacing & hero clearance
huge       : 48dp   // Bottom dock safe padding
```

### Corner Radius Tokens
```text
badge     : 6dp     // Status & discount badges
chip      : 8dp     // Filter chips, tag pills
button    : 12dp    // Primary CTA buttons & form inputs
card      : 16dp    // Standard product cards
cardLarge : 20dp    // Feature cards, hero cards
dialog    : 24dp    // Bottom sheets & alert dialogs
full      : 999dp   // Circle badges, avatars
```

---

## 3. Implementation Code Examples

### A. Compose Tactile Spring Modifier
```kotlin
// In Android Jetpack Compose:
Modifier
    .bouncyClickable { onProductClick(product.id) }
    .clip(RoundedCornerShape(Dimens.CardCorner))
    .background(MaterialTheme.colorScheme.surface)
    .border(Dimens.BorderThin, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(Dimens.CardCorner))
```

### B. Shimmer Skeleton Loading
```kotlin
Box(
    modifier = Modifier
        .fillMaxWidth()
        .aspectRatio(1f)
        .shimmerLoading(shape = RoundedCornerShape(Dimens.CardCorner))
)
```

---

## 4. UI/UX "Pro Max" Quality Audit Checklist

- [ ] **Palette Harmony**: Are background, surface, and amber accents compliant with the 60-30-10 rule?
- [ ] **Zero Hardcoded Colors & Pairing**: Are all colors sourced from `MaterialTheme.colorScheme` / `semanticColors` (strictly NO `Color.White` or `Color.Black` hardcode), and are all container colors paired with their matching `onColor`?
- [ ] **Zero Hardcoded Strings**: Are all UI labels and messages referenced from `R.string.*` via `stringResource` or `UiText`?
- [ ] **Zero Hardcoded Dimensions**: Are all paddings, heights, corners, and elevations referenced from `Dimens.*`?
- [ ] **Dark Mode Fidelity**: Does the screen look stunning and legible in dark mode without bleached-out text?
- [ ] **Typography Scale**: Are titles, body, and labels using official Material 3 typography tokens?
- [ ] **Touch Target Safety**: Do all interactive buttons, steppers, and icons measure at least 48dp x 48dp?
- [ ] **Tactile Feedback**: Do primary interactive cards and CTA buttons incorporate tactile press animations?
- [ ] **Zero Layout Shift**: Are loading skeletons proportionally identical to the loaded content?
- [ ] **Contrast Verification**: Does body text meet WCAG contrast guidelines against the surface color?
