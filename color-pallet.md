Below is a **cohesive, production-ready color palette** built around your four core colors:

* `#2684FF` (Primary Blue)
* `#0052CC` (Deep Blue)
* `#BB0A1E` (Red Accent)
* `#091522` (Dark Navy / Background)

This palette is suitable for **modern SaaS, developer tooling, or enterprise web applications**, with clear semantic roles and contrast discipline.

---

## Core Palette (Provided)

| Role           | Color     | Usage                                   |
| -------------- | --------- | --------------------------------------- |
| Primary Action | `#2684FF` | CTAs, links, active states              |
| Primary Dark   | `#0052CC` | Hover states, headers, emphasis         |
| Accent / Alert | `#BB0A1E` | Errors, destructive actions, highlights |
| Base Dark      | `#091522` | Primary background, dark mode base      |

---

## Supporting Neutrals (Balanced for Contrast)

| Role             | Color     | Usage                                |
| ---------------- | --------- | ------------------------------------ |
| Surface Light    | `#F4F5F7` | Cards, panels on dark base           |
| Surface Dark     | `#111E2E` | Elevated surfaces on dark background |
| Border Subtle    | `#2A3B55` | Dividers, outlines                   |
| Disabled / Muted | `#7A869A` | Secondary text, icons                |

---

## Text Colors (WCAG-aware)

| Context                  | Color     |
| ------------------------ | --------- |
| Primary Text (Dark BG)   | `#FFFFFF` |
| Secondary Text (Dark BG) | `#C7D1E0` |
| Primary Text (Light BG)  | `#091522` |
| Muted Text (Light BG)    | `#5E6C84` |

---

## Interaction States

| Element            | Default   | Hover     | Active    |
| ------------------ | --------- | --------- | --------- |
| Primary Button     | `#2684FF` | `#0052CC` | `#003A8C` |
| Destructive Button | `#BB0A1E` | `#9A0818` | `#7C0613` |
| Links              | `#2684FF` | `#0052CC` | `#003A8C` |

---

## Gradients (Optional, Brand-Forward)

### Primary Gradient

```
linear-gradient(180deg, #2684FF 0%, #0052CC 100%)
```

### Accent Gradient

```
linear-gradient(180deg, #BB0A1E 0%, #7C0613 100%)
```

---

## Example Usage Map

* **Background:** `#091522`
* **Cards:** `#111E2E`
* **Primary CTA:** `#2684FF`
* **Secondary CTA:** outline with `#2684FF`
* **Errors / Warnings:** `#BB0A1E`
* **Links:** `#2684FF`

---

## Why This Works

* Cool blues establish trust and technical credibility
* Red is tightly constrained to avoid visual noise
* Dark navy prevents pure-black harshness
* Neutrals support readability and hierarchy

If you want, I can convert this into:

* A **CSS variables file**
* A **Tailwind config**
* A **Figma color styles system**
* Or validate **WCAG AA/AAA** compliance per component
