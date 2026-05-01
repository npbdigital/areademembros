# HANDOFF — Área de Membros Academia NPB

> **Documento vivo de transferência de contexto.** Use isto pra continuar o trabalho em qualquer máquina (sua, do colega, ou em outra sessão do Claude). Mantenha atualizado conforme o projeto avança.

**Última atualização:** após Etapas 8 + 11 + 12 (biblioteca aluno + relatórios + drag-and-drop + role moderator + webhook)
**Último commit no main:** `64648b4` (mega-commit cobrindo Etapas 8/11/12 + bug fixes)
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
| Email | Resend (conectado, sender padrão `onboarding@resend.dev` — domínio próprio pendente) |
| YouTube | Google YouTube Data API v3 (OAuth conectado — Etapa 6) |
| Deploy | Vercel (Git integration, auto-deploy do `main`) |
| Forms | react-hook-form + zod (instalados, ainda não usados massivamente) |
| Toasts | sonner |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` (Etapa 5.5 — substituiu setas em todas as listas) |

---

## ✅ Etapas concluídas

### Etapa 8 — Biblioteca + Player do aluno (commit `64648b4`)
**Aluno:**
- `/dashboard` real — "Meus Cursos" com % de progresso, "Continue de onde parou" (última aula com vídeo), "Cursos disponíveis" (CTA pra `sale_url`)
- `/courses/[courseId]` — banners + grid de módulos com cadeado/drip
- `/lessons/[lessonId]` — player YouTube (`rel=0&modestbranding=1`), sidebar de aulas, breadcrumb, prev/next, **botão "← Voltar para os módulos"**
- Tabs: **Descrição** (HTML) / **Anexos** (download) / **Anotações** (textarea + auto-save) / **Avaliação** (1–5 estrelas + comentário)
- "Marcar como concluída" + "Salvar nos favoritos" (optimistic UI + rollback)
- **Tracking**: insert em `access_logs` ao abrir + ping de `watch_time_seconds` a cada 30s (clamp 0–120s, pula se aba escondida)
- `/favorites` — lista de aulas salvas (mini-capa portrait + curso + módulo + tempo desde quando)
- `/notes` — todas anotações com preview de 3 linhas + link
- **Card de curso** linka pra ÚLTIMA aula assistida com vídeo daquele curso (ou pra `/courses/[id]` se nunca assistiu)

**Helpers novos:**
- `src/lib/drip.ts` — `isContentReleased()` cobre `immediate`/`locked`/`days_after_enrollment`/`fixed_date` + `releaseMessage()` pra UI
- `src/lib/access.ts` — `getActiveEnrollments`/`getCourseAccessMap`/`checkCourseAccess`/`getUserRole`/`getNonStudentUserIds`. Quando aluno tem mesmo curso por turmas diferentes, usa `enrolled_at` mais antiga (drip libera mais cedo)

**Server Actions (`src/app/(student)/lessons/actions.ts`):**
- `toggleCompleteAction` / `toggleFavoriteAction` / `saveNoteAction` / `rateLessonAction` / `pingWatchTimeAction` / `logLessonViewAction`

**Componentes novos** (`src/components/student/`): `youtube-player.tsx` · `lesson-actions-row.tsx` · `lesson-tabs.tsx` (Descrição/Anexos/Anotações/Avaliação) · `course-card.tsx` (Owned + Sale, aspect-[5/7]) · `banner-carousel.tsx` (auto-rotate 6s) · `sortable-modules-grid.tsx` (versão admin/mod inline na page do aluno)

### Etapa 11 — Banners CRUD admin (commit `64648b4`)
- 5 actions em `courses/actions.ts`: `createBannerAction` / `updateBannerAction` / `deleteBannerAction` / `moveBannerAction` / `toggleBannerActiveAction`
- Section "Banners" embutida em `/admin/courses/[id]` (entre Módulos e fim)
- `BannerForm` — upload via `CoverUpload` (recomendado 1280×400) + link_url + link_target select + is_active checkbox
- Lista com toggle ativo/inativo client + drag-and-drop pra reordenar + delete
- **Bucket reusado:** banners ficam no `course-covers` (não criou bucket separado pra evitar setup extra)

### Etapa 12 — Webhook HTTP de matrícula automática (commit `64648b4`)
- `POST /api/webhooks/enrollment` (`src/app/api/webhooks/enrollment/route.ts`)
- **Auth:** `Authorization: Bearer {WEBHOOK_SECRET}` validado em tempo constante (anti-timing-attack)
- **Eventos aceitos:** `enrollment.created` (default) / `enrollment.cancelled` / `enrollment.refunded`
- **Lógica:** payload → resolve user (cria via `auth.admin.createUser` ou reaproveita) → upsert `membros.users` (profile) → upsert/desativa `enrollments` com `source='webhook'` + `webhook_payload` salvo
- `expires_at`: usa `payload.expires_at` se vier, senão `expiresAtFromDuration(cohorts.default_duration_days)`
- **Convite Resend** apenas pra usuário NOVO (best-effort — não bloqueia resposta)
- Tudo logado em `webhook_logs` (status `'success'`/`'error'`)
- **Middleware** já libera `/api/webhooks/*` (não exige sessão)
- **Falta:** rate limiting (TODO no spec) + trigger SQL no `public.transactions_data` (depende do `product_cohort_map` ser populado)

### Etapa 5.5 — Refinamentos do CRUD admin (commit `64648b4`)
- **Lesson attachments** — tabela `membros.lesson_attachments` ativada (já existia no schema): admin adiciona PDFs/docs até 50MB no editor da aula, aluno vê na tab "Anexos" pra baixar
  - Bucket `lesson-attachments` criado (público) com policies de Storage (escrita só admin via `membros.is_admin()`)
  - Path: `{lessonId}/{uuid}.{ext}` — facilita auditoria
  - Policy SELECT em `membros.lesson_attachments` adicionada pra `authenticated` (RLS estava habilitada sem policies)
- **Drag-and-drop** com `@dnd-kit` substituiu **todas** as setas up/down:
  - Cursos (grid `rectSortingStrategy`), Módulos, Aulas, Banners, Anexos
  - Action `reorderEntitiesAction(table, idsInOrder, revalidatePaths)` faz update em duas fases (negativos depois positivos pra suportar UNIQUE futuro)
  - Optimistic UI + rollback no erro
  - `SortableList` reutilizável em `src/components/admin/sortable-list.tsx` (lista vertical) + `SortableCoursesGrid` específico pra grid
- **Hover sutil** (`hover:bg-npb-bg3/40`) em todos os rows do `SortableList`
- **Quick edit de módulo** via popup (`Modal` + `QuickEditModuleButton`): só título + capa, com `quickUpdateModuleAction` que **preserva** outros campos (descrição, drip, etc). `router.refresh()` após sucesso
- **Modo edição inline na página do aluno** (`/courses/[id]`): admin/moderator vê drag-handle + lápis sobreposto nos cards de módulo (badge "Modo edição" no header) — mesmo `SortableModulesGrid` reutilizado lá

### Etapa 13 (parcial) — Relatórios e atividade do aluno (commit `64648b4`)
- `/admin/reports` — engajamento por curso:
  - Filtro de período: `7d` / `30d` / `90d` / `all` (default 30d)
  - Lista de cursos com **% views médio** + **% conclusão médio** + total de alunos
  - Drill-in (`?course=ID`): top 10 aulas por % views + bottom 5 (menor engajamento), com `viewCount/totalAlunos` + `completeCount/%`
  - **Top aulas por nota** (≥3 avaliações) — ranking pela média
  - **Últimos comentários** — feed com nota, comentário, aluno e data
  - **Admin/moderator excluídos das contagens** via `getNonStudentUserIds()`
- `/admin/students/[id]/atividade` — perfil de uso de um aluno:
  - 4 stat cards (último acesso, aulas vistas distintas, concluídas, tempo total)
  - Progresso por curso (barra %)
  - Timeline dos últimos 50 eventos (`lesson_view` + `lesson_complete`)
  - Anotações + Avaliações dele (admin client pra burlar RLS de ratings)
- Botão "Ver atividade" no `/admin/students/[id]`

### Role `moderator` (commit `64648b4`)
- **Migração Supabase aplicada:** `users_role_check` agora aceita `'student' | 'moderator' | 'admin'`
- `student-create-form.tsx` e `student-edit-form.tsx` ganharam **seletor de função** (admin não é editável via UI — segurança; rebaixar admin é bloqueado na action)
- `getCourseAccessMap` faz **bypass** de matrícula pra admin/moderator: retorna **todos** os cursos publicados com `enrolled_at = epoch` (drip libera tudo) e `has_community_access = true`
- Helper `isElevatedRole(role)` em `src/lib/access.ts`
- **Badge "Moderador"** no `user-dropdown` (igual o admin)
- **Reset de senha manual pelo admin** (`SetPasswordForm` na página `/admin/students/[id]`) usando `auth.admin.updateUserById` — útil quando aluno não consegue abrir o link de convite

### Bug fixes importantes (commit `64648b4`)
- **Magic link redirecionava pra `/login` em vez de `/reset-password`:**
  - `src/lib/supabase/middleware.ts` — `/reset-password` saiu de `isAuthRoute` (não expulsa user logado)
  - `src/app/auth/callback/route.ts` — reescrito pra construir o `NextResponse.redirect` ANTES do `exchangeCodeForSession` e amarrar cookies à response (sem isso, Set-Cookie do exchange podia não ir junto do 307)
  - Validação de `next` (só aceita path começando com `/`) pra evitar open-redirect
- **Cards de curso/módulo** estavam `aspect-video` (16:9) — corrigido pra `aspect-[5/7]` (mesma proporção da capa portrait do admin)
- **Player não renderiza placeholder** quando aula não tem vídeo (antes mostrava box "sem vídeo configurado")
- **Toolbar do RichTextEditor** ganhou Parágrafo + H1 + H2 + H3 (antes só H2)
- **Lesson-form** agora busca o título do vídeo via `/api/youtube/video-details` no mount, mostrando o título do vídeo em cima do videoId

### Migrations Supabase aplicadas nesta etapa
- `add_moderator_role_to_users` — CHECK aceita `'student'|'moderator'|'admin'`
- `lesson_attachments_select_policy` — RLS read pra `authenticated`
- `create_lesson_attachments_bucket` — bucket público + 4 policies de Storage (escrita só admin via `membros.is_admin()`)

---

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

### Etapa 7 — Turmas + Matrículas + criar aluno
- **Cohorts (`/admin/cohorts`):**
  - Lista de turmas (cards) com contagem de cursos vinculados + alunos ativos
  - `/admin/cohorts/new` — criar
  - `/admin/cohorts/[id]` — 3 seções:
    1. Form de edição (nome + descrição) com `CohortForm`
    2. **Cursos vinculados** — `AddCourseToCohortForm` (select + checkbox comunidade) + lista com toggle de comunidade (`CommunityToggle` cliente) e botão de desvincular
    3. **Alunos matriculados** — `EnrollExistingStudentForm` (matricular existente) + lista com data/expiração/status, botões desativar/reativar
- **Students (`/admin/students`):**
  - Tabela com aluno (avatar+nome+email), telefone, qtd matrículas, status, data
  - `/admin/students/new` — `StudentCreateForm` (client) com matrícula opcional. Em sucesso, mostra `InviteLinkCard` com link copiável + status do envio de email
  - `/admin/students/[id]` — header com avatar, `StudentEditForm`, `ResendInviteButton` (gera novo link + reenvia), lista de matrículas
- **Server Actions** em duas pastas:
  - `cohorts/actions.ts` — create/update/delete + addCourseToCohort/removeCourseFromCohort/toggleCommunityAccess + enrollExistingStudent/unenroll/reactivateEnrollment
  - `students/actions.ts` — createStudentAction (cria auth user + profile + matrícula opcional + gera magic link de recovery + tenta enviar via Resend) / updateStudent / setStudentActive / resendInviteAction
- **Resend integration:**
  - `src/lib/email/resend.ts` — wrapper simples (`sendEmail`) + template HTML (`inviteEmailHtml`)
  - Sender padrão: `Academia NPB <onboarding@resend.dev>`
  - **Resend free tier:** sem domínio próprio configurado, só consegue enviar pro e-mail do dono da conta. Pra enviar pra qualquer aluno, precisa configurar domínio próprio em Resend → Domains (adicionar SPF/DKIM no DNS)
  - O fluxo de criação **sempre mostra o link manualmente** (`InviteLinkCard`) — se o e-mail saiu, mostra check verde; se não, mostra aviso amarelo + erro, e admin copia/envia pelo WhatsApp
- **Magic link flow:** usa `supabase.auth.admin.generateLink({ type: 'recovery', email })` → vai pro `/auth/callback?next=/reset-password` (já existente da Etapa 3)
- **Idempotência:** se o e-mail já existe em `auth.users`, reaproveita o id; se já existe matrícula nessa turma, reativa em vez de duplicar
- Build: 25 rotas verde.

### Etapa 6 — Integração YouTube (OAuth 2.0 + video picker)
- **Lib `src/lib/crypto.ts`** — AES-256-GCM, chave derivada de `SUPABASE_SERVICE_ROLE_KEY` via scrypt. Formato: `base64(iv | authTag | ciphertext)`. Usado pra cifrar tokens OAuth no banco.
- **Lib `src/lib/youtube/storage.ts`** — duas linhas no `membros.platform_settings`:
  - `youtube_oauth_tokens` (cifrado): `{access_token, refresh_token, expires_at, scope}`
  - `youtube_oauth_meta` (plain): `{channel_id, channel_title, channel_thumbnail, connected_at}` — pra exibir sem decifrar
- **Lib `src/lib/youtube/client.ts`** — wrapper da YouTube Data API v3:
  - `buildAuthUrl()` — monta URL OAuth com `access_type=offline&prompt=consent` (garante refresh_token)
  - `exchangeCodeForTokens()` — POST `oauth2.googleapis.com/token`
  - `getValidAccessToken()` — refresh automático quando expira em < 1 min
  - `ytFetch()` — wrapper com retry em 401 (re-refresh)
  - `getOwnChannel()`, `searchOwnVideos()`, `getVideoDetails()` (com `parseISODuration` pra ISO 8601 → segundos)
- **Route handlers** em `src/app/api/youtube/`:
  - `auth/route.ts` — gera state, salva em cookie HttpOnly, redireciona pro Google
  - `callback/route.ts` — valida state, troca code por tokens, busca info do canal, salva tudo, redireciona pra `/admin/youtube?connected=1`
  - `disconnect/route.ts` (POST) — limpa as duas linhas de platform_settings
  - `videos/route.ts` — busca paginada (search.list)
  - `video-details/route.ts` — duração + thumbnail (videos.list)
  - Todos protegidos por `getAdminUserId()` em `src/lib/admin-guard.ts`
- **Página `/admin/youtube`** — server component:
  - Sem conexão: card "Nenhum canal conectado" + botão `Link href="/api/youtube/auth"`
  - Conectado: card com avatar do canal + título + data de conexão + botão "Desconectar" (client comp `disconnect-button.tsx` faz POST + router.refresh)
  - Mostra erros via `?error=` na query string
- **Componente `video-picker.tsx`** — client modal:
  - Busca com debounce 500ms via `/api/youtube/videos?q=...`
  - Grid de cards com thumbnail/título/data
  - Click → busca duração via `/api/youtube/video-details?videoId=...` → chama `onPick({videoId, title, durationSeconds, thumbnail})`
  - ESC fecha, click fora fecha, focus auto no input
- **`lesson-form.tsx` reescrito** — agora usa VideoPicker:
  - Card de vídeo com thumbnail + título + ID + botões "Trocar"/"Remover"
  - Duração auto-preenchida quando seleciona via picker (mas editável)
  - Fallback `<details>` "Ou cole o ID manualmente" pra casos sem canal conectado
- Build: 19 rotas verde.

### Etapa 5 — CRUD admin de cursos/módulos/aulas
- **Server Actions** em [`src/app/(admin)/admin/courses/actions.ts`](src/app/(admin)/admin/courses/actions.ts):
  - `createCourseAction` / `updateCourseAction` / `deleteCourseAction` / `moveCourseAction`
  - `createModuleAction` / `updateModuleAction` / `deleteModuleAction` / `moveModuleAction`
  - `createLessonAction` / `updateLessonAction` / `deleteLessonAction` / `moveLessonAction`
  - Helper `assertAdmin()` (defense in depth, além do middleware)
  - `nextPosition()` calcula próximo `position` automaticamente em insert
  - `swapPosition()` faz reordenação via troca de `position` com vizinho
- **Páginas:**
  - `/admin/courses` — grid de cards (cover, título, pills publicado/à venda, reorder controls). Empty state quando lista vazia.
  - `/admin/courses/new` — form de criar (CourseForm)
  - `/admin/courses/[id]` — editar curso (form) + lista de módulos + form inline de adicionar módulo
  - `/admin/courses/[id]/modules/[moduleId]` — editar módulo (form com drip) + lista de aulas + form inline de adicionar aula
  - `/admin/courses/[id]/modules/[moduleId]/lessons/[lessonId]` — editar aula (form com YouTube ID + duração + descrição rich text + drip)
  - `/admin/dashboard` agora mostra contagem de cursos/módulos/aulas com link rápido pra `/admin/courses`
- **Componentes admin** em `src/components/admin/`:
  - `course-form.tsx` — title, description (textarea), cover_url (URL), pills publicado/à venda, sale_url
  - `module-form.tsx` — title, description, cover_url, DripFields
  - `lesson-form.tsx` — title, youtube_video_id, duration_seconds, RichTextEditor (TipTap), DripFields
  - `drip-fields.tsx` — 4 cards selecionáveis (immediate/locked/days_after_enrollment/fixed_date) com campos condicionais
  - `rich-text-editor.tsx` — TipTap (StarterKit + Link), toolbar com bold/italic/strike/h2/listas/link/undo, sincroniza HTML em `<input type="hidden">` pra serializar via Server Action
  - `add-child-form.tsx` — input + botão "Adicionar" inline (reset automático em sucesso, mostra erro inline)
  - `delete-button.tsx` — confirm() nativo + useTransition pra disabled state. Variantes `icon` (lixeira só) e `full` (lixeira + texto)
  - `reorder-controls.tsx` — botões up/down com useTransition, disable nos extremos
- **Bound actions:** páginas usam `action.bind(null, courseId, ...)` pra fixar args antes de passar pra forms/componentes client. Padrão Next.js 14.
- **createAdminClient() obrigatório:** policies RLS em `membros.{courses,modules,lessons,lesson_attachments}` só têm SELECT (`auth.role() = 'authenticated'`). Mutações são bloqueadas pra qualquer chave que não seja service_role. `actions.ts` checa `process.env.SUPABASE_SERVICE_ROLE_KEY` no helper `admin()` e dá erro claro com link do dashboard se faltar.
- **Reads em pages** usam `createClient()` (anon + cookies) — funciona com a policy SELECT existente.
- **Skipped por ora (entram em refinamentos futuros):**
  - Drag-and-drop visual (usei botões up/down server-side; deps `@dnd-kit/*` instaladas mas não usadas ainda)
  - Upload direto de capa pra Supabase Storage (input de URL por enquanto)
  - YouTube video picker (Etapa 6 cuida — campo é apenas o video ID por enquanto, mas thumbnail já é gerada via `i.ytimg.com`)
  - Anexos de aula (`lesson_attachments` — Etapa 5.5)
- Build: 13 rotas verde.

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

### 🐛 Bugs em aberto
- **"Sistema quebrou abrindo/fechando telas"** (reportado pelo Felipe) — sem stacktrace ainda. Quando reproduzir: pegar erro do console do browser (F12) + terminal do `npm run dev` e investigar. Hipóteses: vazamento do timer do YouTube player, modal portal não limpa `document.body.style.overflow` em algum caso, HMR do dev quebrado.

### Etapa 9 — Drip content
- ✅ Helper `isContentReleased()` feito (Etapa 8)
- ✅ Bloqueio server-side em `/courses/[id]` e `/lessons/[id]` (Etapa 8)
- Notificação automática quando conteúdo é desbloqueado (cruza com Etapa 13 de notificações)

### Etapa 10 — Comunidade (PRÓXIMA GRANDE) 🎯
- `/community` — galerias (categorias de tópicos)
- `/community/[gallery]` — lista de tópicos (fixados no topo)
- `/community/[gallery]/[topic]` — tópico + respostas aninhadas (1 nível) + likes
- Editor TipTap (já temos o componente) pra criar tópico/resposta
- Moderação: admin/moderator pode deletar/responder qualquer coisa, marcar fixado, marcar `is_moderated`
- Notificação quando alguém responde no tópico do aluno
- Tabelas já criadas no schema: `community_galleries`, `community_topics`, `community_replies`, `community_likes`
- **Reusar:** `isElevatedRole()` pra gatear ações de moderação
- Acesso: `has_community_access` em `cohort_courses` controla se a turma libera comunidade — admin/moderator sempre vê

### Etapa 13 — Notificações in-app (parcial)
- ✅ Página `/admin/students/[id]/atividade` (timeline + stats)
- ✅ `/admin/reports` (engajamento + ratings)
- ❌ Sino com badge no topbar — hoje é só placeholder. Conectar à tabela `notifications` (já existe)
- ❌ Página `/notifications` com histórico
- ❌ Triggers automáticos: nova aula publicada, conteúdo desbloqueado por drip, resposta na comunidade
- ❌ E-mail transacional via Resend pros eventos importantes

### Etapa 14 — Whitelabel
- `/admin/settings` — form pra logo, cor primária, sender de e-mail (escreve em `platform_settings`)
- Substituir hardcoded "Academia NPB" + dourado por valores das settings
- Resend `from` vir de `platform_settings.email_sender`

### Etapa 15 — Perfil e suporte do aluno
- `/profile` — editar nome/telefone/avatar (upload pra Storage), trocar senha, ver histórico de matrículas. Link já existe na sidebar
- `/support` — placeholder hoje. Decidir formato (form de e-mail? link pro WhatsApp?)

### 🔌 Integração `transactions_data` → matrícula automática (PENDENTE — bloqueado em input do Felipe)
- ✅ Webhook HTTP `POST /api/webhooks/enrollment` pronto pra fontes externas (Kiwify/Hubla)
- ❌ Trigger SQL no `public.transactions_data` (separado do webhook HTTP — esse é pra automação interna do NPB):
  - Tabela `membros.product_cohort_map` já existe (vazia)
  - **Próximo passo:** Felipe precisa mapear: "produto X (`low ticket automático 2.0`, código `xxx`) = turma Y (uuid)". Quando passar o mapeamento, criar trigger AFTER INSERT/UPDATE em `public.transactions_data`:
    - `Compra Aprovada` → cria/ativa matrícula
    - `Compra Cancelada` / `Compra Reembolsada` / `Cancelada` → desativa
    - `EXCEPTION WHEN OTHERS` em volta de tudo (zero risco de bloquear venda)
  - E rodar backfill das **2637 compras aprovadas** já existentes

### Polimentos pequenos
- Quick-edit de **aula** (popup com título + cover + duração) — hoje só módulo tem
- Edição inline de banner (delete+recriar funciona, mas é ruim)
- Bucket `lesson-attachments` está OK mas anexos são públicos por URL UUID — se for armazenar PDFs sensíveis, trocar pra signed URLs
- Rate limiting no webhook (`@upstash/ratelimit` ou solução simples com timestamp em Redis/Supabase)
- Domínio próprio no Resend (hoje sender `onboarding@resend.dev` só envia pro dono da conta)
- Limpar `ReorderControls` (`src/components/admin/reorder-controls.tsx`) e os `move*Action` antigos — órfãos depois do drag-and-drop
- Player YouTube usa iframe simples; trocar pra YouTube IFrame API pra ter eventos reais de play/pause/end (hoje o ping de watch_time é otimista — assume aba ativa = vendo)

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
Deve compilar sem erros e listar **31 rotas** (admin + aluno + auth + APIs YouTube e webhook). Inclui:
- Admin: `/admin/{courses,cohorts,students,reports,youtube,dashboard}` + sub-rotas
- Aluno: `/dashboard`, `/courses/[courseId]`, `/lessons/[lessonId]`, `/favorites`, `/notes`
- Auth: `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`
- API: `/api/webhooks/enrollment`, `/api/youtube/{auth,callback,disconnect,videos,video-details}`

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
│   │   └── admin/
│   │       ├── dashboard/page.tsx       ← stats + CTA
│   │       └── courses/                 ← Etapa 5
│   │           ├── actions.ts           ← Server Actions p/ courses/modules/lessons
│   │           ├── page.tsx             ← lista
│   │           ├── new/page.tsx         ← criar
│   │           └── [id]/
│   │               ├── page.tsx         ← editar curso + módulos
│   │               └── modules/[moduleId]/
│   │                   ├── page.tsx     ← editar módulo + aulas
│   │                   └── lessons/[lessonId]/
│   │                       └── page.tsx ← editar aula
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
│   ├── admin/                 ← Etapa 5
│   │   ├── course-form.tsx
│   │   ├── module-form.tsx
│   │   ├── lesson-form.tsx
│   │   ├── drip-fields.tsx
│   │   ├── rich-text-editor.tsx
│   │   ├── add-child-form.tsx
│   │   ├── delete-button.tsx
│   │   └── reorder-controls.tsx
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

8. **Schema `membros` exposto via PostgREST + GRANTs feitos manualmente** (corrigido após Etapa 5). A migration original que criou o schema esqueceu de:
   - Adicionar `membros` em `pgrst.db_schemas` do role `authenticator` (sem isso, queries `.schema('membros')` retornam vazio sem erro visível)
   - Conceder `USAGE` no schema pra `anon`/`authenticated`/`service_role` (RLS roda EM CIMA dos GRANTs — não substitui)
   - Conceder `SELECT` (e nas tabelas de aluno: INSERT/UPDATE/DELETE) pra `authenticated`
   - Conceder tudo pra `service_role` (pra mutações admin)

   Migrations aplicadas no Supabase: `expose_membros_schema_via_postgrest` e `grant_membros_schema_access_to_supabase_roles`. **Se um dia recriar o schema do zero, NÃO esqueça desses GRANTs** — caso contrário o sintoma é "página renderiza, mas nada que depende de role/profile funciona, e nenhum erro aparece no console".

---

## 🧪 Para o próximo Claude (se você abrir nova sessão)

Cole essa mensagem inicial:

> Estou continuando o projeto da Área de Membros Academia NPB. Leia primeiro o `HANDOFF.md` e o `SPEC_AREA_DE_MEMBROS.md` na raiz do repo. O Supabase está em `hblyregbowxaxzpnerhf` (schema `membros`). **Etapas 1 a 8, 11 e 12 estão completas** (ver changelog do HANDOFF). O cliente já tem painel admin completo, biblioteca de aluno, player com tracking, anexos, drag-and-drop em todas as listas, role moderator com bypass de matrícula, /admin/reports com analytics, webhook HTTP de matrícula. **Próximas frentes pendentes:**
>
> 1. **🐛 BUG sem reproduzir:** Felipe relatou que "abrindo e fechando telas o sistema quebra". Sem stacktrace ainda. Precisa pegar console do browser (F12) e terminal do `npm run dev` na próxima vez que reproduzir. Hipóteses: vazamento do timer do YouTube player ao desmontar, modal portal não limpa `document.body.style.overflow` em casos específicos.
>
> 2. **Etapa 10 — Comunidade (PRÓXIMA GRANDE):** tabelas já existem (`community_galleries`, `community_topics`, `community_replies`, `community_likes`). Construir `/community`, `/community/[gallery]`, `/community/[gallery]/[topic]` com TipTap pra tópicos/respostas, likes, moderação (admin/moderator pode deletar/responder/fixar — usar `isElevatedRole()` de `src/lib/access.ts`). Acesso baseado em `cohort_courses.has_community_access`.
>
> 3. **Etapa 13 — Notificações reais:** sino do topbar é placeholder. Conectar à tabela `notifications`, adicionar página `/notifications`, e triggers automáticos (nova aula, drip desbloqueado, resposta na comunidade). Resend pra e-mails dos eventos importantes.
>
> 4. **Trigger SQL `transactions_data` → matrícula:** depende do Felipe mapear "produto X = turma Y" em `membros.product_cohort_map` (vazia hoje). Webhook HTTP já existe pra fontes externas.
>
> 5. **Polimentos:** quick-edit de aula (hoje só módulo tem); domínio próprio no Resend; rate limit no webhook; deletar `ReorderControls` órfão; trocar player YouTube por IFrame API pra ter eventos reais de play/pause.

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
| `d3c4013` | **Etapa 4: layouts sidebar + topbar** (route groups student/admin, dropdowns, fix middleware schema) |
| `fa70869` | **Etapa 5: CRUD admin de cursos/módulos/aulas** (TipTap, drip fields, reorder, soft auth check) |
| `b5e65c8` | docs: registra fix de GRANTs/exposed schemas no Supabase |
| `f42fe23` | fix(admin): ReorderControls não-serializável + upload de capa (bucket course-covers) |
| `ce64312` | **Etapa 6: YouTube OAuth + video picker** (crypto, tokens cifrados, modal de busca) |
| `4eff355` | **Etapa 7: Turmas + Matrículas + criar aluno** (Resend invite com fallback de link manual) |
| `4146364` | feat(cohorts): duração de acesso a nível de turma (não mais por aluno) |
| `64648b4` | **Etapas 8/11/12 + 5.5 + role moderator + bug fixes** (mega-commit — biblioteca aluno, banners admin, webhook, drag-and-drop, anexos, /admin/reports, /admin/students/[id]/atividade, /favorites, /notes, magic link fix, role moderator com bypass de matrícula) |

---

**FIM DO HANDOFF.** Mantenha este documento sincronizado conforme as etapas avançam — é a memória do projeto entre sessões e máquinas.
