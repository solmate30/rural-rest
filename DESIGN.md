# Design System: Rural Rest
**Project ID:** `projects/3517571550003660935`

## 1. Visual Theme & Atmosphere
**"Warm Heritage Minimalism"**
The interface aims to evoke the feeling of a peaceful, sun-drenched afternoon in a wooden Hanok. It balances the warmth of natural textures (wood, beige paper) with the clean lines of modern design. The atmosphere is **calm, restorative, and sophisticated**. It avoids stark whites in favor of "Warm Beige" (`#fcfaf7`) to reduce eye strain and feel more organic.

## 2. Color Palette & Roles
*   **Primary Green (#17cf54):** Used for primary actions (buttons), active states, and "The Story" badges. Represents nature and vitality.
*   **Warm Beige (#fcfaf7):** The main background color (`bg-background-light`). Soft and welcoming.
*   **Deep Wood (#4a3b2c):** Used for primary text (headings) and branding. Replaces harsh black.
*   **Warm Gray (#7a7267):** Used for secondary text, placeholders, and icons.
*   **Night Forest (#112116):** The dark mode background. Deep and enveloping.

## 3. Typography Rules
*   **Font Family:** `Plus Jakarta Sans`. Modern, geometric, but with friendly curves.
*   **Headings:** Bold (`font-bold`), tight tracking (`tracking-tight`). Used for "Rural Rest" and property titles.
*   **Body:** Medium or Regular. Comfortable line height for storytelling.
*   **Labels:** Uppercase, tracking widest (`tracking-widest`) for small labels like "DISCOVER".

## 4. Component Stylings
*   **Buttons:**
    *   **Primary/Secondary/Action:** `rounded-xl` (ROUND_TWELVE). **Global Rule:** Every button in the platform, including Login, Save, and Preview, must share this exact curvature to maintain brand consistency. Active state scales down (`active:scale-95`).
    *   **Icon Buttons:** `rounded-full`, `bg-white`, `shadow-sm`, `border`.
*   **Cards (Properties):**
    *   **Shape:** Generously rounded (`rounded-3xl`).
    *   **Elevation:** Soft, diffuse shadow (`shadow-[0_10px_30px_rgba(0,0,0,0.04)]`).
    *   **Behavior:** Scale up on hover (`group-hover:scale-105` on image).
*   **Categories:**
    *   **Shape:** `rounded-2xl` (Squircle).
    *   **State:** Default `bg-stone-100`, Active/Hover `bg-primary/10` with `text-primary`.
*   **Inputs:**
    *   **Search:** `rounded-xl`, `bg-white`, `shadow-[0_4px_20px_rgba(0,0,0,0.05)]`. No border (`border-none`).

## 5. Layout Principles
*   **Spacing:** Generous padding (`px-6` default container).
*   **Whitespace:** `space-y-8` between sections to allow content to breathe.
*   **Navigation:** Fixed bottom bar with `backdrop-blur-xl`.
*   **Immersive Media:** Full-width or large aspect-ratio images (`aspect-[4/3]`) to highlight the architecture.
