# HANDOFF — Área de Membros Academia NPB

> **Documento vivo de transferência de contexto.** Use isto pra continuar o trabalho em qualquer máquina (sua, do colega, ou em outra sessão do Claude). Mantenha atualizado conforme o projeto avança.

**Última atualização:** após Etapa 4 (layouts sidebar + topbar)
**Último commit no main:** `b6e503a` (HANDOFF.md) — Etapa 4 será o próximo
**Vercel:** https://npb-area-de-membros.vercel.app
**GitHub:** https://github.com/npbdigital/areademembros
**Supabase project:** `hblyregbowxaxzpnerhf` (org "No Plan B", região sa-east-1)

---

## 🎯 O que é

SaaS de área de membros multi-curso, multi-turma, com:
- Painel do aluno (biblioteca, player, comunidade, perfil)
- Painel admin (CRUD cursos/aulas/turmas/alunos, relatórios, integração YouTube)
- Drip content (liberação por data ou X dias após matrícula)
- Webhook de matrícula automática a partir das vendas em `public.transactions_data`
- Whitelabel (logo, cores, e-mail remetente)

**Cliente final:** Felipe Sempe (NPB Digital).
**Spec completa:** `SPEC_AREA_DE_MEMBROS.md` na raiz do repo.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14.2.35 (App Router, Server Actions) |
| Language | TypeScript |
| UI | Tailwind 3.4 + shadcn/ui + Lucide icons |
| Database | PostgreSQL via Supabase (schema `membros` isolado) |
| Auth | Supabase Auth (e-mail/senha + magic link p/ recovery) |
| Storage | Supabase Storage (capas, avatars, anexos) |
| Email | Resend (ainda não conectado) |
| YouTube | Google YouTube Data API v3 (ainda não conectado) |
| Deploy | Vercel (Git integration, auto-deploy do `main`) |
| Forms | react-hook-form + zod (instalados, ainda não usados massivamente) |
| Toasts | sonner |

---

## ✅ Etapas concluídas

### Etapa 1 — Setup Next.js + Supabase clients (commit `c35963d`)
- `npx create-next-app@14` com TS, Tailwind, ESLint, App Router, src/, alias `@/*`
- Instalado `@supabase/supabase-js` + `@supabase/ssr`
- shadcn/ui inicializado (Button criado)
- Helpers Supabase em `src/lib/supabase/`:
  - `client.ts` — browser client (Client Components)
  - `server.ts` — SSR client + admin client com service_role
  - `middleware.ts` — `updateSession()` que renova sessão e redireciona auth
- `src/middleware.ts` — Next middleware ativando o `updateSession`
- `.env.local` + `.env.example` com 9 vars do spec

### Etapa 1.5 — Design system Academia NPB (commit `10641a5`)
- Repo do colega (`npbdigital/areademembros`) tinha protótipo HTML/CSS/JS puro com brand Academia NPB (dark + gold #c9922a)
- Portados todos os tokens pra `tailwind.config.ts` no namespace `npb-*`:
  - Cores: `npb-gold`, `npb-gold-light`, `npb-gold-dim`, `npb-bg`, `npb-bg2/3/4`, `npb-text`, `npb-text-muted`, `npb-border`
  - Gradientes: `bg-npb-gold-gradient`, `bg-npb-sidebar`, `bg-npb-curso-hero`
  - Sombras: `shadow-npb-gold`, `shadow-npb-card-hover`
- 17 imagens (capas LTA 2, m20k, dtd) copiadas pra `public/imagens/`
- HTMLs/CSS/JS originais preservados em `_design-reference/` (referência visual, não rodam)
- `globals.css` reescrito com paleta dark forçada + Segoe UI

### Etapa 2 — Schema do banco em `membros` (Supabase migration)
- Schema isolado `membros.*` (zero impacto no `public.*` da operação)
- 22 tabelas criadas (20 do spec + `product_cohort_map` + helper extras):
  ```
  users · courses · modules · lessons · lesson_attachments
  cohorts · cohort_courses · enrollments
  lesson_progress · lesson_ratings · lesson_notes · lesson_favorites
  banners · community_galleries · community_topics · community_replies · community_likes
  platform_settings · notifications · access_logs · webhook_logs
  product_cohort_map
  ```
- `membros.users.id` é FK pra `auth.users.id` (link 1:1 com Supabase Auth)
- 14 índices de performance
- RLS habilitada em TODAS as tabelas com policies "own data" + helper `membros.is_admin()`
- Trigger `set_updated_at` automático em todas as tabelas com `updated_at`
- **Reversível com:** `DROP SCHEMA membros CASCADE;`

### Etapa 2.5 — Admin bootstrap
- E-mail: `noplanbdigital@gmail.com`
- `auth.users.id` = `94ceb337-9af7-46e3-9876-8d6a1b65e1b4` (já existia no projeto, não criamos novo)
- Adicionado em `membros.users` com `role='admin'` e `project_id` Felipe Sempe
- **Senha:** preservada da que você já usa pras outras ferramentas NPB no Supabase. Se esquecer, reseta via Supabase Dashboard → Authentication → Users → "Send password recovery"

### Etapa 3 — Autenticação completa (commit `2b2e4ae`)
- `src/app/(auth)/`:
  - `layout.tsx` — wrapper centralizado com glow dourado + Toaster
  - `login/page.tsx` — tela de login (e-mail + senha)
  - `forgot-password/page.tsx` — pede e-mail e dispara link via Supabase
  - `reset-password/page.tsx` — define nova senha (após callback)
  - `actions.ts` — Server Actions: `signInAction`, `forgotPasswordAction`, `resetPasswordAction`, `signOutAction`
- `src/app/auth/callback/route.ts` — Route Handler que faz `exchangeCodeForSession` e redireciona
- `src/components/npb-logo.tsx` — logo escudo + wordmark reutilizável
- `src/components/submit-button.tsx` — botão de submit com pending state via `useFormStatus`
- Middleware atualizado pra liberar `/auth/callback`
- Mensagens de erro amigáveis em PT-BR ("E-mail ou senha incorretos", etc.)
- Toda a UI usa os tokens `npb-*` (consistente com o design)

### Etapa 4 — Layouts sidebar + topbar
- **Route groups:**
  - `src/app/(student)/layout.tsx` — sidebar 64px (Início/Favoritos/Comunidade/Perfil/Suporte) + topbar 56px
  - `src/app/(admin)/layout.tsx` — sidebar 240px (Dashboard, Cursos, Banners, Comunidade, Alunos, Turmas, Relatórios, YouTube, Configurações + voltar p/ aluno) + topbar 56px
- **Páginas movidas/criadas:**
  - `/dashboard` agora vive em `src/app/(student)/dashboard/page.tsx` (placeholder simplificado, header passou pro layout)
  - `src/app/(admin)/admin/dashboard/page.tsx` — placeholder do painel admin
  - `src/app/dashboard/page.tsx` antigo foi removido (route group resolve no mesmo path)
- **Componentes novos em `src/components/`:**
  - `student-sidebar.tsx` — client comp, 5 ícones com active state via `usePathname()`, replica `_design-reference/styles.css` (.sidebar)
  - `admin-sidebar.tsx` — client comp, agrupamento por seção (Visão geral, Conteúdo, Pessoas, Análises, Sistema)
  - `topbar.tsx` — server comp, busca opcional + Notificações + Avatar
  - `user-dropdown.tsx` — client, click-outside próprio, mostra nome/e-mail/badge admin + links + signOut form
  - `notifications-dropdown.tsx` — client, badge de não lidas + placeholder "Em breve" (Etapa 14 conecta a tabela `notifications`)
- **Layouts buscam o `membros.users.full_name/avatar_url/role` do user logado e passam pro Topbar.**
- **Toaster** subiu pra cada layout (auth/student/admin) — antes estava só no `(auth)`.
- **Bug fix do middleware:** `src/lib/supabase/middleware.ts` checava `from("users")` (schema public). Corrigido pra `.schema("membros").from("users")` — sem isso a guarda de role admin nunca encontrava o profile e mandava todo mundo pra `/dashboard`.
- **Lucide note:** o ícone `Youtube` (logo de marca) foi removido das versões recentes do `lucide-react`. Usei `PlaySquare` no link do `/admin/youtube`. Trocar pro logo oficial depois com SVG inline se for prioridade visual.
- Build valida 11 rotas (`/`, `/_not-found`, `/admin/dashboard`, `/auth/callback`, `/dashboard`, `/forgot-password`, `/login`, `/reset-password`).

---

## 🚧 Pendente (próximos passos)

### Etapa 5 — CRUD Cursos/Módulos/Aulas (admin) — PRÓXIMO
- `/admin/courses` — lista com drag-and-drop
- `/admin/courses/[id]` — editar curso + módulos
- `/admin/courses/[id]/modules/[moduleId]` — editar módulo + aulas
- Editor TipTap pras descrições

### Etapa 6 — Integração YouTube (OAuth)
- Botão "Conectar YouTube" em `/admin/settings`
- Tokens criptografados em `membros.platform_settings`
- Seletor de vídeos no editor de aula

### Etapa 7 — Turmas + Matrículas (admin)
- `/admin/cohorts` — CRUD
- Vincular cursos à turma com `has_community_access`
- Matricular alunos manualmente

### Etapa 8 — Biblioteca + Player (aluno)
- `/dashboard` (real) — grid de cursos
- `/courses/[id]` — módulos
- `/lessons/[id]` — player + lista lateral + rating

### Etapa 9 — Drip content (lógica de liberação)
- Função utilitária `isContentReleased()`
- Bloqueio server-side em todas as rotas de aula

### Etapa 10–17 — Comunidade, banners, webhook, notifs, relatórios, whitelabel, refinamentos

### 🔌 Integração `transactions_data` → matrícula automática (PENDENTE)
- Tabela `membros.product_cohort_map` já existe (vazia)
- **Próximo passo:** quando você criar os primeiros produtos/turmas na Etapa 7, me passa: "produto X (vendido como `low ticket automático 2.0`) = turma Y" e eu populo o map
- Aí crio o trigger AFTER INSERT/UPDATE em `public.transactions_data`:
  - `Compra Aprovada` → cria/ativa matrícula
  - `Compra Cancelada` / `Compra Reembolsada` / `Cancelada` → desativa
  - `EXCEPTION WHEN OTHERS` em volta de tudo (zero risco de bloquear venda)
- E rodo backfill das **2637 compras aprovadas** já existentes

---

## 💻 Como rodar em outro computador

### 1. Pré-requisitos
- **Node.js 18+** (testado em v24.15.0) — https://nodejs.org/en
- **Git** — https://git-scm.com/downloads
- (Windows) PowerShell com Execution Policy permitindo scripts:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
  ```

### 2. Clonar
```bash
git clone https://github.com/npbdigital/areademembros.git
cd areademembros
npm install
```

### 3. Configurar `.env.local`
Crie um arquivo `.env.local` na raiz com:

```env
# Pegar em https://supabase.com/dashboard/project/hblyregbowxaxzpnerhf/settings/api-keys
NEXT_PUBLIC_SUPABASE_URL=https://hblyregbowxaxzpnerhf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_npb-area-de-membros>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_npb-area-de-membros>

# Vazio por enquanto (Etapas 6 e 10)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
RESEND_API_KEY=

# Use o mesmo valor que está em produção (Vercel) ou gere outro forte
WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> 📌 **Onde pegar as chaves Supabase:**
> 1. Acesse https://supabase.com/dashboard/project/hblyregbowxaxzpnerhf/settings/api-keys
> 2. **Publishable key** chamada `npb-area-de-membros` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> 3. **Secret key** chamada `npb-area-de-membros` → `SUPABASE_SERVICE_ROLE_KEY` (clica em Reveal — só aparece uma vez. Se já não tiver, crie uma nova com `+ New secret key`)
>
> 📌 **Onde pegar as outras values em produção:**
> Vercel → projeto `npb-area-de-membros` → Settings → Environment Variables.

### 4. Rodar local
```bash
npm run dev
```
Abre em http://localhost:3000 — deve redirecionar pra `/login`.

### 5. Validar build de produção
```bash
npm run build
```
Deve compilar sem erros e listar 11 rotas (/, /_not-found, /admin/dashboard, /auth/callback, /dashboard, /forgot-password, /login, /reset-password).

---

## 🚀 Como o deploy funciona

```
Push pro main no GitHub
       ↓
Webhook GitHub → Vercel
       ↓
Vercel rebuilda (≈90s) com framework=nextjs forçado pelo vercel.json
       ↓
Promove pra produção em https://npb-area-de-membros.vercel.app
```

**Variáveis de ambiente em produção** ficam no Vercel (Settings → Environment Variables), separadas por escopo (Production, Preview, Development). Atualmente configuradas:
- `NEXT_PUBLIC_SUPABASE_URL` ✓
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓ (Sensitive)
- 6 outras vars criadas, algumas vazias (Google, Resend, Webhook, App URL)

---

## 🗂️ Estrutura de arquivos importantes

```
src/
├── app/
│   ├── (auth)/                ← Etapa 3: rotas sem sidebar
│   │   ├── layout.tsx
│   │   ├── actions.ts         ← signIn / forgot / reset / signOut
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (student)/             ← Etapa 4: layout do aluno
│   │   ├── layout.tsx         ← sidebar 64px + topbar 56px
│   │   └── dashboard/page.tsx ← placeholder (Etapa 8 vira biblioteca real)
│   ├── (admin)/               ← Etapa 4: layout admin
│   │   ├── layout.tsx         ← sidebar 240px + topbar (guarda role=admin)
│   │   └── admin/dashboard/page.tsx ← placeholder métricas
│   ├── auth/callback/route.ts ← exchange code → session
│   ├── layout.tsx             ← root layout (lang=pt-BR, body)
│   ├── globals.css            ← paleta dark + tokens
│   └── page.tsx               ← redirect / → /login | /dashboard
├── components/
│   ├── npb-logo.tsx           ← escudo + wordmark
│   ├── submit-button.tsx      ← com pending via useFormStatus
│   ├── student-sidebar.tsx    ← Etapa 4
│   ├── admin-sidebar.tsx      ← Etapa 4
│   ├── topbar.tsx             ← Etapa 4
│   ├── user-dropdown.tsx      ← Etapa 4 (avatar + menu + signOut)
│   ├── notifications-dropdown.tsx ← Etapa 4 (badge + placeholder)
│   └── ui/                    ← shadcn (button, input, label, sonner)
├── lib/
│   ├── supabase/
│   │   ├── client.ts          ← createBrowserClient (Client Components)
│   │   ├── server.ts          ← createClient + createAdminClient
│   │   └── middleware.ts      ← updateSession (auth + redirects, role check via schema membros)
│   └── utils.ts               ← cn() do shadcn
└── middleware.ts              ← Next middleware ativando updateSession

public/imagens/                ← 17 imagens portadas do design (LTA 2, m20k, dtd)
_design-reference/             ← protótipo HTML do colega (não roda, só referência)
SPEC_AREA_DE_MEMBROS.md        ← spec completa (referência mestra)
HANDOFF.md                     ← este arquivo
vercel.json                    ← força framework=nextjs
tailwind.config.ts             ← tokens npb-* + shadcn vars
```

---

## 🔐 Onde estão as credenciais (importante!)

| Recurso | Onde acessar |
|---|---|
| **GitHub** repo | https://github.com/npbdigital/areademembros (você + colega usam mesmo login `npbdigital`) |
| **Vercel** projeto | https://vercel.com/no-plan-bs-projects/npb-area-de-membros |
| **Supabase** projeto | https://supabase.com/dashboard/project/hblyregbowxaxzpnerhf |
| **Supabase** API keys | https://supabase.com/dashboard/project/hblyregbowxaxzpnerhf/settings/api-keys |
| **Admin login** no app | `noplanbdigital@gmail.com` (mesma senha das outras ferramentas NPB) |

**NUNCA commitar o `.env.local`.** O `.gitignore` já bloqueia, mas dobra a atenção ao copiar arquivos.

---

## 🔍 Comandos úteis (cheat sheet)

```bash
# Dev
npm run dev                    # Roda em http://localhost:3000
npm run build                  # Build de produção (valida tudo)
npm run lint                   # ESLint

# Git
git pull                       # Antes de começar a editar
git add -A && git commit -m "..."  # Sempre que terminar uma feature
git push                       # Deploy automático na Vercel

# Verificar estado do banco
# (precisa Claude Code com Supabase MCP, ou Supabase CLI configurado)
```

---

## ⚠️ Decisões arquiteturais importantes (pra não desfazer sem entender)

1. **Schema `membros` em vez de `public`** — a Área de Membros vive em `membros.*`. O `public.*` continua sendo a operação antiga (transactions_data, automations, email_templates etc.). **Sem isolamento, vira sopa de letrinhas.**

2. **`membros.users.id` é FK de `auth.users.id`** — login do Supabase Auth é a fonte de verdade. RLS usa `auth.uid() = id` direto.

3. **`product_cohort_map` é o ponto de integração entre venda e matrícula** — não dá pra escapar de fazer esse mapeamento manual quando criar produtos. É a única tabela "extra" que adicionei além do spec.

4. **Trigger automático em `transactions_data` ainda NÃO existe** — vai ser criado depois que os produtos forem mapeados. Por enquanto, nada de automático acontece nas vendas reais.

5. **Forçamos `framework: nextjs` no `vercel.json`** — porque o projeto Vercel original era HTML estático e o override de "Other" ficava grudado.

6. **GitHub e Vercel estão conectados via Git integration** — qualquer push em `main` deploya. Não use `vercel deploy` CLI manual a não ser pra debug.

7. **Route groups `(student)` e `(admin)` em uso desde a Etapa 4** — `/dashboard` resolve via `(student)/dashboard/page.tsx` e `/admin/*` via `(admin)/admin/*`. Cada layout faz própria checagem de auth + role no servidor (defense in depth, além da camada de middleware).

---

## 🧪 Para o próximo Claude (se você abrir nova sessão)

Cole essa mensagem inicial:

> Estou continuando o projeto da Área de Membros Academia NPB. Leia primeiro o `HANDOFF.md` e o `SPEC_AREA_DE_MEMBROS.md` na raiz do repo. O Supabase está em `hblyregbowxaxzpnerhf` (schema `membros`). Etapa 4 (layouts sidebar+topbar) está completa. Próximo passo é a **Etapa 5: CRUD admin de cursos, módulos e aulas** — criar `/admin/courses` (lista com drag-and-drop), `/admin/courses/[id]` (editar curso + módulos), `/admin/courses/[id]/modules/[moduleId]` (editar módulo + aulas) e o editor TipTap pras descrições. Reusar os tokens `npb-*` e respeitar o esquema `membros.courses/modules/lessons`.

---

## 📝 Changelog rápido

| Commit | Descrição |
|---|---|
| `c35963d` | Etapa 1: setup Next.js 14 + TS + Tailwind + shadcn/ui + Supabase |
| `10641a5` | Etapa 1.5: design system Academia NPB integrado |
| `8a70dbc` | Merge: integra histórico do protótipo + reorganiza pra `_design-reference/` |
| `67545de` | Adiciona `vercel.json` forçando framework=nextjs |
| `4735d94` | Dispara primeiro deploy via Git após conectar Vercel↔GitHub |
| `2b2e4ae` | **Etapa 3: autenticação completa** (login, forgot, reset, callback, dashboard placeholder) |
| `b6e503a` | Adiciona HANDOFF.md inicial |
| _este commit_ | **Etapa 4: layouts sidebar + topbar** (route groups student/admin, dropdowns, fix middleware schema) |

---

**FIM DO HANDOFF.** Mantenha este documento sincronizado conforme as etapas avançam — é a memória do projeto entre sessões e máquinas.
