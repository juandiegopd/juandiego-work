# juandiego.work

Personal website for JD Peñaherrera — operator, builder, systems thinker.

Live at [juandiego.work](https://juandiego.work)

---

## Stack

- **Pure HTML/CSS/JS** — no frameworks, no build tools
- **Vercel** — auto-deploys from `main` on push
- **Fonts** — DM Serif Display, DM Mono, DM Sans (Google Fonts)

---

## Structure

```
/                   → Homepage (index.html)
/experience         → Career timeline and closing sections
/viventis           → Unlisted company-specific page
research/           → Local-only source documents (gitignored)
```

### Design tokens

| Token | Value |
|---|---|
| `--cream` | `#F8F7F4` |
| `--ink` | `#1C1B19` |
| `--serif` | DM Serif Display |
| `--mono` | DM Mono |
| `--sans` | DM Sans |

---

## Content workflow

1. Draft content in Claude Chat (voice refinement, source doc consolidation)
2. Output a `.md` file
3. Hand off to Claude Code → builds or updates the HTML

---

## Rules

- Company-specific pages (`/viventis`, etc.) are **unlisted** — no nav links, no sitemap, `robots.txt` disallows them
- No sensitive metrics published without explicit approval
- Keep `research/` gitignored — source documents stay local only

---

## Deploy

Vercel auto-deploys on every push to `main`. No manual step needed.
