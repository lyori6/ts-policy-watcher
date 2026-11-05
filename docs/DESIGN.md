# Design and accessibility guidelines

The dashboard targets **WCAG 2.2 Level AA**, the standard used for ADA web accessibility. Every new screen or component should keep it there. This file is the source of truth for colors, interaction patterns and the accessibility rules behind them. Update the changelog at the bottom whenever a token or pattern changes.

All styles live in [`dashboard/style.css`](../dashboard/style.css). One token set on `:root` drives every component. Never hard-code a color in a component or in a `script.js` template; use a token.

## Color tokens

Contrast ratios are for normal-size text. AA needs 4.5:1 for text under 18.66px bold / 24px regular, 3:1 for large text, icons, borders of inputs and focus rings.

### Text

| Token | Value | Use | On white | On `--surface-3` |
|---|---|---|---|---|
| `--text` | `#101828` | Body text, headings | 17.7:1 | 16.0:1 |
| `--text-2` | `#475467` | Secondary text, descriptions | 7.7:1 | 6.9:1 |
| `--text-3` | `#667085` | Meta text, timestamps | 5.0:1 | 4.48:1 (fails; use `--text-2` on `--surface-3`) |
| `--text-4` | `#626a7d` | Faintest text (placeholders, hints) | 5.4:1 | 4.9:1 |

`--text-3` also fails on `--accent-soft` (4.44:1). Inside a selected or accent-soft item, use `--text-2` for meta text.

### Brand

| Token | Value | Use |
|---|---|---|
| `--accent` | `#2f5bea` | Links, primary buttons, focus ring (5.5:1 on white) |
| `--accent-hover` | `#2348c9` | Hover state |
| `--accent-soft` | `#eef2ff` | Selected and highlighted backgrounds |
| `--accent-ring` | `rgba(47,91,234,.22)` | Input focus halo (always paired with the accent border) |
| `--ink`, `--ink-2` | `#0b1324`, `#131d33` | Header background |

### Status

Status text is always paired with its soft background (badges, labels). All pairs pass 4.5:1.

| Token | Value | With `-soft` background |
|---|---|---|
| `--success` / `--success-soft` | `#067647` / `#ecfdf3` | 5.4:1 |
| `--warning` / `--warning-soft` | `#b54708` / `#fffaeb` | 5.2:1 |
| `--danger` / `--danger-soft` | `#b42318` / `#fef3f2` | 6.0:1 |

Never use color as the only signal: status badges always carry a text label ("Tracked", "Pending", "Success").

## Focus

- Every focusable element shows `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Do not remove outlines. If a component needs a custom ring (inputs, selects), keep one that is at least 2px and 3:1 against its background, and keep an outline in `forced-colors` mode.
- `html { scroll-padding-top: 7.5rem }` keeps focused items clear of the sticky nav and platform bar (WCAG 2.4.11). If the sticky header grows, raise this value.
- Anything that is invisible must also be out of the tab order (`visibility: hidden`, `display: none` or `inert`). Opacity alone is not enough. See `.widget-form`.

## Interaction patterns

| Pattern | Rule |
|---|---|
| Buttons vs links | `<button type="button">` for actions, `<a href>` for navigation. Never put `onclick` on a `div`, `span` or `tr` without the keyboard support below. |
| Clickable cards and rows | Prefer a real `<button>` inside the card (see `.a11y-text-button`, which looks like plain text). If the whole element must be clickable and it has no nested controls, give it `role="button"`, `tabindex="0"` and Enter/Space handling. `a11y.js` does this for `.policy-pill` and the matrix accordion rows. |
| Icon-only controls | Must have `aria-label` (or a `title` that `a11y.js` copies). Decorative `<i class="fa-…">` icons get `aria-hidden="true"`. |
| New-tab links | `target="_blank" rel="noopener"` and "(opens in a new tab)" in the accessible name. |
| Toggles | Section and filter buttons expose `aria-pressed`; nav tabs expose `aria-current`; expanders expose `aria-expanded`. |
| Dialogs | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title. Focus moves in on open, Tab is trapped, Escape closes, focus returns to the opener. The close button is a `<button aria-label="Close">`. Handled centrally in `a11y.js`. |
| Forms | Every input and select has a `<label>` (use `.sr-only` if it should not be visible). Errors use `role="alert"` and are linked with `aria-describedby`. Email fields use `autocomplete="email"`. |
| Tables | `<caption>` (can be `.sr-only`) and `<th scope="col">`. |
| Charts | The SVG gets `role="img"` and a summary `aria-label`, followed by an `.sr-only` data table with the same numbers. |
| Headings | One `h1` per page, no skipped levels. Cards inside an `h2` section use `h3` (or `aria-level="3"`). |
| Pagination | Wrapped in a labelled group; prev/next labelled; current page has `aria-current="page"`. |
| Motion | Animations respect `prefers-reduced-motion`. |
| Target size | Controls are at least 24×24px, or spaced so a 24px circle around each does not overlap another. |

## Utilities

- `.sr-only`: visually hidden, still read by screen readers.
- `.skip-link`: first focusable element on every page, jumps to `#main-content`.
- `.a11y-text-button`: a `<button>` that inherits the surrounding text style.

## `dashboard/a11y.js`

Most dashboard markup is built from template strings in `script.js`. `a11y.js` watches the DOM and adds the semantics above (names, roles, states, dialog behavior, chart alternative) after each render, without changing anything visually. When you add a new component, either write the correct markup in the template directly (preferred) or extend `a11y.js`.

## Before shipping a UI change

1. Run axe-core on every tab and open modal at 1280px and 320px; expect 0 violations.
2. Tab through the change with the keyboard only: everything reachable, focus always visible, Escape closes overlays.
3. Check there is no horizontal page scroll at 320px wide.
4. Update this file if you added or changed a token or pattern.

## Accessibility statement

The public statement is [`dashboard/accessibility.html`](../dashboard/accessibility.html), linked from the footer. Update its "Last updated" date and "What we have done" list when accessibility work ships.

## Changelog

| Date | Change |
|---|---|
| 2026-11-05 | WCAG 2.2 AA pass. Darkened `--success` (`#079455` → `#067647`), `--warning` (`#dc6803` → `#b54708`), `--danger` (`#d92d20` → `#b42318`) and `--text-4` (`#98a2b3` → `#626a7d`) to meet 4.5:1. Added `.sr-only`, `.skip-link`, `.a11y-text-button`, `scroll-padding-top`, `a11y.js` and the accessibility statement page. |
