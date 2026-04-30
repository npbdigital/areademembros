# Design Reference — Academia NPB

Esta pasta contém o protótipo HTML/CSS/JS original feito pelo colega.
**Não é código rodando** — é referência visual e estrutural para o port em React/Tailwind.

Arquivos preservados:

- `index.html` — Home (course carousel, expansões, continue assistindo)
- `curso.html` — Página de curso (hero + módulos grid)
- `player.html` — Player (vídeo + lista lateral + breadcrumb + info + rating)
- `styles.css` — CSS do design system (tokens já portados em `tailwind.config.ts`)
- `app.js` — Lógica client-side original (lições, rating, favoritar)
- `data.js` — Mock de dados (substituído pelo Supabase)

## Tokens de design portados

Todos os tokens estão em `tailwind.config.ts` no namespace `npb-*`:

| Original CSS var | Tailwind class |
|---|---|
| `--gold` `#c9922a` | `text-npb-gold` / `bg-npb-gold` |
| `--gold-light` `#e8b84b` | `text-npb-gold-light` |
| `--gold-dim` `#7a5618` | `text-npb-gold-dim` |
| `--bg` `#0d0d0d` | `bg-npb-bg` |
| `--bg2` `#161616` | `bg-npb-bg2` |
| `--bg3` `#1e1e1e` | `bg-npb-bg3` |
| `--bg4` `#252525` | `bg-npb-bg4` |
| `--text` `#f0f0f0` | `text-npb-text` |
| `--text-muted` `#888` | `text-npb-text-muted` |

Gradientes:
- `bg-npb-gold-gradient` (135deg gold → gold-dim)
- `bg-npb-sidebar` (180deg sidebar dark → bg)
- `bg-npb-curso-hero` (135deg bg → dark gold)

Sombras:
- `shadow-npb-gold` (glow dourado)
- `shadow-npb-card-hover` (hover dos course cards)

## Quando o port React ficar pronto

Esta pasta pode ser deletada com segurança — o código React em `src/` será a fonte de verdade. Mantenha enquanto serve de referência visual.
