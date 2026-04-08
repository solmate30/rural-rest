# Design System: Rural Rest
**Project ID:** `projects/3517571550003660935`

## 1. Visual Theme & Atmosphere
**"Warm Heritage Minimalism"**

The interface evokes the feeling of a peaceful, sun-drenched afternoon in a wooden Hanok. It balances the warmth of natural textures (wood, beige paper) with the clean lines of modern design. The atmosphere is **calm, restorative, and sophisticated**.

Two distinct visual languages coexist intentionally:
- **Hospitality layer** (Brown tones) — browsing stays, booking, traveler experience
- **Crypto layer** (Green tones) — on-chain actions: token purchase, dividend claim, DAO vote

This dual identity reflects Rural Rest's nature as both a travel platform and a DeFi investment product.

---

## 2. Color Palette & Roles

### Hospitality (Primary)
| Token | HEX | Role |
|-------|-----|------|
| `--primary` | `#8D6E63` | Primary UI — buttons, active states, brand accent |
| `--background` | `#FAF9F6` | Main background. Warm off-white, never pure white |
| `--foreground` | `#3E2723` | Primary text. Deep charcoal-brown, replaces black |
| `--muted-foreground` | `#7a6e60` | Secondary text, placeholders, captions |
| `--secondary` | `#D7CCC8` | Soft Clay — dividers, subtle fills |
| `--accent` | `#FFAB91` | Terracotta — highlights, warm accent moments |
| `--border` | `hsl(35 15% 88%)` | Warm-toned borders, never cool gray |

### Crypto (Action)
| Token | HEX | Role |
|-------|-----|------|
| Crypto Green | `#17cf54` | On-chain actions only: token purchase, dividend claim, DAO vote, wallet connect |
| Crypto Green hover | `#14b847` | Hover state for crypto green buttons |

### Dark Mode
| Token | Value | Role |
|-------|-------|------|
| `--background` (dark) | `#0a0a0a` | Near-black, not pure black |
| `--foreground` (dark) | `hsl(0 0% 98%)` | Off-white text |
| `--primary` (dark) | `#8D6E63` | Same warm brown, unchanged |

**Rule:** Never use `stone-*` or `gray-*` — always use `stone-*` for warm undertones. Avoid cool grays entirely.

---

## 3. Typography Rules

| Property | Value |
|----------|-------|
| Font family | `Pretendard`, `Noto Sans KR`, `sans-serif` |
| Heading weight | `font-bold` with `tracking-tight` |
| Body weight | `font-medium` or `font-normal` |
| Small labels | `uppercase tracking-widest text-xs` |
| Line height | Comfortable — `leading-relaxed` for body, default for headings |

**Hierarchy:**
- Page title: `text-3xl md:text-4xl font-bold`
- Section heading: `text-xl font-bold`
- Card title: `text-base font-semibold`
- Body: `text-sm` or `text-base font-medium`
- Caption / label: `text-xs uppercase tracking-widest`

---

## 4. Component Stylings

### Buttons
| Type | Style |
|------|-------|
| Primary (hospitality) | `bg-primary text-white rounded-xl px-6 h-10 shadow-sm` |
| Primary (crypto action) | `bg-[#17cf54] text-white rounded-xl px-6 h-10 shadow-sm hover:bg-[#14b847]` |
| Secondary / outline | `border border-input rounded-xl bg-background px-6 h-10` |
| Ghost | `rounded-xl hover:bg-muted` |
| Icon button | `rounded-full bg-white shadow-sm border` |
| Active state | `active:scale-95` or `active:scale-[0.98]` |
| Hover state | `hover:scale-[1.02]` for primary CTAs |

**Rule:** All buttons use `rounded-xl`. No exceptions for brand consistency.

### Cards
| Type | Style |
|------|-------|
| Property card | `rounded-2xl shadow-md overflow-hidden` |
| Investment card | `rounded-2xl shadow-md border border-border` |
| Stat / summary card | `rounded-xl shadow-sm bg-card p-4` |
| Image hover | `hover:scale-105 transition-transform duration-300` |

### Inputs
| Type | Style |
|------|-------|
| Default | `rounded-xl border border-input bg-background px-4 h-10` |
| Search | `rounded-xl bg-white shadow-md border-none` |
| Focus ring | `ring-2 ring-primary/30` |

### Badges / Chips
| Type | Style |
|------|-------|
| Status (active) | `bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold` |
| Status (crypto) | `bg-[#17cf54]/10 text-[#17cf54] rounded-full px-3 py-1 text-xs font-semibold` |
| Category chip | `rounded-2xl px-4 py-2 text-sm font-medium` — default `bg-muted`, active `bg-primary/10 text-primary` |

### Navigation
- **Mobile:** Fixed bottom bar with `backdrop-blur-xl bg-background/80`
- **Desktop:** Top header, sticky

---

## 5. Layout Principles

- **Container padding:** `px-6` default, `sm:px-8` on larger screens
- **Section spacing:** `space-y-8` or `py-12` between major sections
- **Property grid:** `grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3`
- **Max width:** `max-w-7xl mx-auto` for page content
- **Images:** Always `object-cover` with fixed `aspect-[4/3]` — never distort
- **Immersive media:** Full-width hero images to highlight architecture and nature

---

## 6. Depth & Elevation

| Level | Class | Use case |
|-------|-------|----------|
| Flat | (no shadow) | In-page chips, nav items |
| Low | `shadow-sm` | Inputs, icon buttons, inline cards |
| Mid | `shadow-md` | Property cards, investment cards |
| High | `shadow-2xl` | Modals, sheets, floating panels |
| CTA glow | `shadow-xl shadow-primary/20` | Primary action buttons (hospitality) |
| Crypto glow | `shadow-lg shadow-[#17cf54]/20` | Crypto action buttons |

**Rules:**
- All shadows are diffuse — no visible X/Y offset
- Dark mode: use opacity layers on `#0a0a0a`, not pure black surfaces
- Never stack multiple shadow utilities on one element

---

## 7. Do's and Don'ts

**Do:**
- Use Brown (`#8D6E63`) for all general UI actions — navigation, booking, search
- Use Green (`#17cf54`) exclusively for on-chain / crypto actions
- Keep backgrounds warm: `#FAF9F6` (light), `#0a0a0a` (dark)
- Use `rounded-2xl` for cards, `rounded-xl` for buttons and inputs, `rounded-full` for avatars and icon buttons
- Use `stone-*` for warm-toned grays — never `gray-*` or `zinc-*`
- Animate hover: `hover:scale-[1.02]`, `active:scale-[0.98]` for tactile feedback
- Show property images at `aspect-[4/3]` — wide enough to convey space and architecture
- Use `tracking-widest uppercase text-xs` for section labels and status badges

**Don't:**
- Don't use pure white `#ffffff` as page background — breaks the warm atmosphere
- Don't use Green for non-crypto UI elements — the color is a semantic signal
- Don't use cool grays (`gray-*`, `zinc-*`, `slate-*`) anywhere
- Don't add borders to filled primary buttons — shadow provides elevation
- Don't use more than 2 font weights in the same card or section
- Don't use custom arbitrary shadow values — stick to the elevation scale above
- Don't mix the hospitality and crypto visual languages in the same component

---

## 8. Responsive Behavior

| Breakpoint | Width | Key changes |
|------------|-------|-------------|
| Base (mobile) | < 640px | 1-col grid, bottom nav, compact padding |
| `sm` | 640px+ | 2-col grid starts, horizontal CTAs |
| `md` | 768px+ | Top header replaces bottom nav, larger type |
| `lg` | 1024px+ | 3-col property grid |
| `xl` | 1280px+ | Max content width locked at `max-w-7xl` |

- **Touch targets:** Minimum `h-10` (40px) for all interactive elements
- **Bottom nav:** Hidden on `md+` (`md:hidden`)
- **Typography scale:** `text-2xl md:text-4xl` pattern — always mobile-first
- **Images:** Fixed `aspect-[4/3]` at all breakpoints, never let images reflow
- **Cards:** Full-width on mobile, fixed grid on desktop — no horizontal scroll

---

## 9. Agent Prompt Guide

### Color quick reference
```
Primary (hospitality): #8D6E63  — brown, general UI
Crypto action:         #17cf54  — green, on-chain only
Background (light):    #FAF9F6  — warm off-white
Background (dark):     #0a0a0a  — near-black
Text primary:          #3E2723  — deep charcoal-brown
Text secondary:        #7a6e60  — warm gray
Border:                hsl(35 15% 88%)
Accent:                #FFAB91  — terracotta, highlights
```

### Tailwind tokens
```
bg-primary          → #8D6E63 brown
bg-background       → #FAF9F6 warm beige
bg-foreground       → #3E2723 deep brown
bg-muted            → warm light gray
bg-accent           → #FFAB91 terracotta
bg-[#17cf54]        → crypto green (use directly, not via token)
```

### Instant-use prompts
- **General page:** "Use Rural Rest design system: warm beige background (#FAF9F6), brown primary (#8D6E63) for buttons and active states, Deep Wood (#3E2723) for headings, Pretendard font, rounded-xl buttons, rounded-2xl cards."
- **Property card:** "Property card: aspect-[4/3] image with hover:scale-105, rounded-2xl card, shadow-md, stone color palette, brown badge for status."
- **Crypto / on-chain button:** "On-chain action button: bg-[#17cf54] text-white rounded-xl, hover:bg-[#14b847], shadow-lg with green glow. Used only for token purchase, dividend claim, DAO vote."
- **Admin table:** "Admin table: stone-50 header, stone-200 borders, Deep Wood text, brown primary buttons for general actions, green buttons for on-chain settlement actions."
- **Dark mode:** "Dark mode: swap background to #0a0a0a, text to stone-100, borders to stone-800. Keep brown and green colors unchanged."
