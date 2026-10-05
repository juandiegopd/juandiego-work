# Design reference: Net Worth Tracker

Derived from the juandiego.work UI kit (analyzed from the exported HTML). Tokens live in `docs/design-tokens.css`.
The `simple-designer` agent treats this as the source of truth.

## What the design is
Editorial, quiet, mostly monochrome. Cream paper + warm ink, like a well-set personal journal. One accent (blue), used sparingly.

## Layout
- Sticky 56px nav (mono, uppercase, dot markers), single centered column (680-920px), 3rem gutters.
- Page = mono eyebrow, serif title with an italic `<em>` phrase, optional italic serif subtitle, then hairline-divided rows.
- Home hero: small image/mark + big serif name + italic tagline + a row of mono section links under a hairline.

## Colors
Cream `#F8F7F4` / `#EFEDE8` / `#E0DDD7`; ink `#1C1B19` / `#4A4641` / `#6B6861` / `#9A9088`; blue `#1B4DD8` (tint `#E8EEFB`).

## Typography
DM Serif Display (headlines, italic emphasis, taglines), DM Sans (body), DM Mono (labels/meta, 11px uppercase, 0.1em tracking).

## Components to carry over
- Dot-marker nav items and section links
- Hairline list rows with cream hover wash (`.row`)
- Bordered 6px-radius cards (`.card`) with mono number + serif title + small body
- Mono meta strips ("Label · **Value**")
- Numbered lists with mono `01 02 03` counters
- Italic serif blockquote with 2px left rule

## Mapped to the net worth tracker
- Hero: serif net worth number, mono eyebrow, italic change line
- Accounts: hairline rows (mono type | name | right-aligned balance)
- Asset / liability groups: serif h2 with `<em>`, mono subtotal
- Range switcher: mono dot-items

## Avoid
Heavy shadows, gradients, multiple accents, pure black/white, generic SF/Inter styling, icon clutter.
