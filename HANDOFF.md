# HANDOFF — Área de Membros Academia NPB

> **Documento vivo de transferência de contexto.** Use isto pra continuar o trabalho em qualquer máquina (sua, do colega, ou em outra sessão do Claude). Mantenha atualizado conforme o projeto avança.

**Última atualização:** 2026-05-02 — Etapa 20: pendências batidas (CSV, gráfico, pinning, realtime, cron, manual sale)
**Último commit no main:** atualiza neste push
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

### Etapa 20 — Sweep de pendências (2026-05-02 noite)

Sweep limpando ~todas as pendências do HANDOFF antes de migrar pra Hostinger (o que ficou pra depois). Build verde, tudo testado.

**1. UI de afiliados — limpeza:**
- `$ 21,65` virou `R$ 21,65` (removido ícone DollarSign do `affiliate-section.tsx`)
- Comissão da venda na lista usa `toLocaleString('pt-BR')` com vírgula em vez de ponto
- Conquistas pequenas adicionadas pra dar dopamina cedo: `comm_kiwify_100` (R$100, 20 XP) e `comm_kiwify_500` (R$500, 50 XP)

**2. Timezone BRT em todas as telas SSR:** todos os `toLocaleDateString` (ou `toLocaleString`) com saída server-rendered ganharam `timeZone: 'America/Sao_Paulo'`. Telas afetadas: students list/detalhe, profile (matrículas), cohorts/[id], reports, students/atividade, lesson_notes, favorites, gamification (achievements unlock_at), drip (release date), community (timeAgoPtBr).

**3. Toggle "Mostrar fictícios" em /admin/reports e /admin/dashboard.** `getNonStudentUserIds(supabase, { includeFicticio: true })` exclui ou inclui `ficticio` no excluded list. Default: ESCONDE fictícios das stats. Link no header pra alternar via `?showFicticio=1`.

**4. Filtros + CSV export em /admin/affiliates:**
- Form GET com `?q=...` (busca em kiwify_email/kiwify_name) + `?status=paid|refunded|chargedback`
- Botão "Exportar CSV" → endpoint `/api/admin/affiliates/export.csv` — gera CSV com BOM UTF-8 (Excel pt-BR ok), respeita os mesmos filtros, inclui aluno (se atribuído), produto, status, comissão, valor total, método de pagamento

**5. Venda manual pra fictícios:** novo `addManualSaleAction` + componente [`AddManualSaleButton`](src/components/admin/add-manual-sale-button.tsx) no header de `/admin/affiliates`. Admin escolhe email do aluno, produto e comissão R$. Insere com `source='manual'`, status `paid`, dispara `awardXp` + `bumpMinLevel` (Nível II garantido). Útil pra popular dados de teste em fictícios sem precisar de webhook real.

**6. Pinning de posts:**
- Action `toggleTopicPinAction(topicId, pinned)` em `/admin/community/actions.ts`
- Item "Fixar no topo / Desafixar" no menu de 3 pontinhos do `PostActionsBar` (só admin/mod)
- `is_pinned` no SELECT das pages que listam posts (`/community/[slug]` e `/community/feed`)
- Ordenação: `is_pinned DESC, created_at DESC` — fixados sempre no topo
- Visual: borda dourada + badge "📌 Fixado" em cima do nome do autor no PostCard

**7. Reorder de espaços/páginas/atalhos** — actions `moveSpaceAction`/`movePageAction`/`moveSidebarLinkAction` (sobe/desce trocando position com vizinho) + UI:
- Menu do `SpaceActions` ganha "Subir" / "Descer"
- Menu do `PageActions` ganha "Subir" / "Descer"
- `SidebarLinkRow` ganha 2 botões inline (↑ ↓) ao lado da lixeira (visíveis no hover)

(DnD via `@dnd-kit` foi descartado — overkill pra esse use case. Setas resolvem.)

**8. Gráfico de comissão por mês no /admin/dashboard:** SVG inline (sem nova dep), barras dos últimos 12 meses normalizadas pelo maior valor. Hover mostra tooltip com R$ + nº vendas. Ao lado dos cards Hoje/7d/30d.

**9. Realtime via Supabase channels:**
- Migration: adicionado `community_topics` e `community_replies` ao publication `supabase_realtime`
- Componente [`RealtimeFeedRefresher`](src/components/community/realtime-feed-refresher.tsx) — subscribe a INSERT/UPDATE de community_topics (filtro opcional por `pageId`) e a INSERT de community_replies (filtro por `topicId`). Em qualquer evento, chama `router.refresh()`.
- Plugado em `/community/feed` (sem filtro), `/community/[slug]` (filter=pageId), `/community/[slug]/post/[postId]` (filter=topicId)
- Resultado: quando admin aprova um post, ele aparece na hora pra todo mundo no feed. Quando aluno comenta, contagem atualiza no detalhe.

**10. Cron diário pra notificar drip:**
- Endpoint [`/api/cron/drip-notifications`](src/app/api/cron/drip-notifications/route.ts) — pra cada matrícula ativa, calcula `dias_desde_matricula`. Pra cada lição com `release_type='days_after_enrollment'` E `release_days = dias_atuais`, notifica o aluno (idempotente: checa se já notificou nas últimas 48h pra mesma combinação user+link).
- `vercel.json` ganha `crons: [{ path: "/api/cron/drip-notifications", schedule: "0 12 * * *" }]` — roda diário às 12 UTC (= 09 BRT).
- Auth via header `Authorization: Bearer $CRON_SECRET` (Vercel adiciona automaticamente). Sem `CRON_SECRET` setado no Vercel, o endpoint aceita qualquer chamada (modo dev). **Pendente:** Felipe precisa setar `CRON_SECRET` no Vercel pra produção.

**Migrations aplicadas:**
- `add_low_sales_value_achievements` — conquistas R$100 e R$500
- `realtime_publish_community_topics_replies` — adiciona ao publication

**Arquivos novos:**
- `src/lib/format-date.ts` (já tinha, agora aplicado em mais lugares)
- `src/app/api/admin/affiliates/export.csv/route.ts`
- `src/components/admin/add-manual-sale-button.tsx`
- `src/components/community/realtime-feed-refresher.tsx`
- `src/app/api/cron/drip-notifications/route.ts`

**Pendências em aberto (todas opcionais):**
- Migrar pra Hostinger VPS (~6 meses, decisão do Felipe)
- Suporte a Hotmart/Eduzz (schema é genérico via `source`, só precisa adapter por plataforma)
- DnD real com @dnd-kit (atual: setas ↑↓ resolvem)

### Etapa 19 — Bugfixes críticos + UX afiliados/comunidade/dashboard (2026-05-02)

Sessão grande de correções e novos features. Tudo testado e build verde.

**Bugs críticos corrigidos:**

1. **XP sempre zerava** — `admin.rpc("current_xp_period_start")` estava chamando no schema `public` (default) em vez de `membros` → retornava null → fallback `now()` → cada `awardXp` resetava `total_xp=0`. Substituído por helper JS [`currentQuarterStartIso()`](src/lib/gamification.ts) e o reset trimestral foi REMOVIDO inteiro (XP agora é cumulativo, não zera nunca).

2. **RLS notifications faltando UPDATE/DELETE** — botão "Marcar todas como lidas" dava `permission denied`. Adicionadas policies `notifications_update_own` e `notifications_delete_own`.

3. **Venda Kiwify não dava XP** — check "venda anterior ao cadastro" pulava `awardXp` quando aluno cadastrava o link DEPOIS da venda chegar (cenário comum). Removido tanto em `processApproved` quanto em `backfillOrphanSales`. Vendas pré-cadastro agora contam.

4. **Webhook Kiwify falhando** — endpoint usava `KIWIFY_WEBHOOK_TOKEN` pra DUAS coisas (URL `?token=` E secret HMAC). A Kiwify tem 2 valores distintos no painel:
   - URL com `?token=...` (autenticação) → `KIWIFY_WEBHOOK_TOKEN` no Vercel
   - Campo "Token" (HMAC secret) → `KIWIFY_WEBHOOK_SECRET` no Vercel (novo, fallback pro TOKEN se ausente)

**Features novos:**

5. **Role `ficticio` ativada** (spec já estava no HANDOFF). Migration expande CHECK constraint, options nos forms create/edit, badge azul "Fictício" na listagem `/admin/students`, toggle "Mostrar/Esconder fictícios" via `?showFicticio=0`. Fictício se comporta como `student` em tudo (XP, conquistas, vendas Kiwify) — só serve pra admin filtrar relatórios.

6. **Regra Nível II garantido na 1ª venda Kiwify**. Nova coluna `user_xp.min_level` (piso, nunca diminui). Função `bumpMinLevel(userId, n)` em [`gamification.ts`](src/lib/gamification.ts) chamada após qualquer venda paga atribuída. `levelFromXp(xp, minLevel)` aplica piso. Backfill já bumpou todos os afiliados que tinham vendas pagas.

7. **3 pontinhos + Aprovar no post aberto** — novo componente [`PostActionsBar`](src/components/community/post-actions-bar.tsx) no header do `/community/[slug]/post/[postId]`. Mostra editar/excluir (autor/elevated) + Rejeitar/Aprovar (elevated, quando status≠approved). Reusa `PostModal` pra edição.

8. **Embed de YouTube/Vimeo INLINE no editor** — campo separado de "Vídeo URL" REMOVIDO do form. Nova extensão Tiptap [`VideoEmbed`](src/lib/tiptap-video-embed.ts) (Node atom, draggable). Botão "Vídeo" na toolbar prompta URL → converte via `videoEmbedUrl()` → insere `<iframe>` no fluxo do texto. `sanitizePostHtml` agora tem allowlist pra iframes do `youtube.com/embed/` e `player.vimeo.com/video/`. Posts antigos com `video_url` separado preservam comportamento legado.

9. **Fila de moderação paginada** (5 por página) em `/admin/community/queue` com botões Anterior/Próxima via `?page=N`.

10. **Vendas órfãs com nome+email + atribuir manual** — coluna "Aluno" em `/admin/affiliates` mostra email+nome Kiwify das órfãs + botão "Atribuir" ([`AttachOrphanButton`](src/components/admin/attach-orphan-button.tsx)). Admin digita email do aluno → action [`attachOrphanByStudentEmailAction`](src/app/(admin)/admin/affiliates/actions.ts) cria affiliate_link verified + roda `backfillOrphanSales` (que pega TODAS as outras órfãs do mesmo email automaticamente).

11. **Bloco "Vendas afiliados" no /admin/dashboard** — Hoje / 7d / 30d com volume de vendas e comissão acumulada (R$). Conta TODAS as vendas pagas (atribuídas + órfãs).

12. **Helper de timezone BRT** [`src/lib/format-date.ts`](src/lib/format-date.ts) — `formatDateBrt`, `formatDateTimeBrt`, `formatShortBrt`. Aplicado em `/admin/affiliates` e `/profile#afiliado` (datas de cadastro, verificação e venda). Outros lugares ainda usam `toLocaleDateString` do server (UTC) — pendente aplicar (ver lista abaixo).

13. **UNIQUE de `xp_log` trocado** — antes era `(user_id, reason, reference_id, period_start)` (idempotência por trimestre). Agora é `(user_id, reason, reference_id)` (idempotência pra sempre — uma aula concluída rende XP UMA VEZ na vida).

**Migrations aplicadas (em ordem):**
- `add_ficticio_role`
- `add_user_xp_min_level` + backfill
- `notifications_allow_update_own`
- `backfill_xp_period_and_total` — recalcula total_xp = SUM(xp_log)
- `backfill_kiwify_sale_xp_matheus` — concede XP perdido
- `verify_matheus_kiwify_link` — auto-verifica links com vendas pagas
- `drop_quarterly_reset_recompute_xp` — remove conceito de reset trimestral
- `xp_log_unique_drop_period` — UNIQUE sem period_start

**Arquivos novos:**
- `src/components/community/post-actions-bar.tsx`
- `src/components/admin/attach-orphan-button.tsx`
- `src/lib/tiptap-video-embed.ts`
- `src/lib/format-date.ts`

**Modelo XP/Nível depois desta etapa:**
- XP é **cumulativo** (não zera por trimestre)
- Cada `(user, reason, reference_id)` rende XP no máximo 1x na vida
- `min_level` é piso por marco (1ª venda Kiwify → 2)
- `current_level = MAX(min_level, levelFromXp(total_xp))`
- Conquistas e streak preservadas (já eram)

### Etapa 18 — Correções UX comunidade (sessão Maio 2026)

8 ajustes baseados em feedback real de uso:

1. **Sidebar do aluno** — antes era slim 64px só com ícones, agora 240px com **ícone+nome** dos itens. Mobile: `hidden md:flex` + drawer via `MobileNavToggle` (botão hamburger no topbar). Items: Início, Favoritos, Anotações, Comunidade, Notificações, Perfil, Suporte.

2. **Sidebar da comunidade no mobile** — antes era `hidden md:flex` (sumida no mobile, admin não conseguia criar nada). Agora aparece via `CommunityMobileBar` (barra sticky superior só mobile com botão "Comunidade" que abre drawer com a sidebar inteira). Admin/moderador gerencia espaços/páginas/links pelo mobile também.

3. **Botão "Ver comunidade"** dourado no header de `/admin/community`.

4. **EmojiPicker** (`src/components/emoji-picker.tsx`) — ~200 emojis catalogados em 8 categorias (Pessoas, Comunicação, Estudo, Conquistas, Símbolos, Tech, Negócios, Diversos) + busca por nome. Componente reusável com portal, click-outside, ESC. Substitui inputs de digitar emoji em `CreatePageButton`, `EditPageForm`, `CreateLinkButton`.

5. **Fonte do nome do espaço** — antes `text-[11px] font-semibold uppercase tracking-widest text-npb-text-muted`, agora `text-sm font-bold text-npb-text` (sem uppercase, hover dourado).

6. **Espaçamento entre parágrafos** — nova classe `.community-html` em `globals.css` aplica spacing real em `<p>` (margin-block 0.85em + line-height 1.65), `<h1-3>`, `<ul>/<ol>/<li>`, `<a>`, `<strong>`, `<img>` (border-radius + border + my), `<blockquote>` (border-left dourado), `<code>`. Usada em `PostDetail`, `CommentItem` e `RichTextEditor` (preview já com spacing certo).

7. **Imagens inline no editor + vídeo no fim**:
   - Instalado `@tiptap/extension-image@^3.22.5`
   - `RichTextEditor` ganhou prop `uploadImage?: (file) => Promise<string>` que habilita botão de imagem na toolbar (faz upload + insere `<img>` no editor)
   - `CreatePostModal` passa `uploadImage` (usa `uploadPostImageAction` existente)
   - **Campo separado de imagem REMOVIDO** — agora tudo inline no texto
   - Vídeo continua em campo dedicado e renderiza no FIM (depois do conteúdo)
   - Coluna `image_url` no banco continua mas não é mais setada por novos posts (legado)

8. **Editar/excluir próprio post**:
   - Nova `editPostAction(topicId, formData)` em `app/(student)/community/actions.ts` — verifica autoria via admin client (RLS bloquearia leitura cruzada), aceita autor ou admin/mod
   - `PostCard` ganhou menu `MoreHorizontal` (`...`) com opções Editar / Excluir quando `currentUserId === post.authorId` OU `isElevatedRole(currentRole)`
   - "Editar" reusa `CreatePostModal` com prop `editing={topicId, title, bodyHtml, videoUrl}` pré-preenchida; submit chama `editPostAction` em vez de `createPostAction` (via dynamic import pra evitar circular dep)
   - `PostCardData` ganhou `authorId`, `pageId`, `pageTitle`; `currentUserId` é passado pelas pages que listam (`/community/[slug]` e `/community/feed`)
   - **Comentários**: admin/moderador já podiam excluir qualquer comentário via `canDelete = isElevatedRole(currentRole)` em `CommentItem` — confirmado e mantido

### Etapa 17 — Comunidade Circle.so style + Notificações (sessão Maio 2026)

Reestruturação da Comunidade pra modelo de **Espaços (grupos não-clicáveis) > Páginas (com feed)** + sistema de notificações in-app real.

**Schema (1 migration):**
- Nova tabela `community_spaces(id, title, position, is_active)` — grupos
- `community_galleries` renomeada → `community_pages` + adicionada `space_id` (FK nullable em `community_spaces` — DELETE SET NULL)
- `community_topics.gallery_id` → `page_id`
- `community_space_views` → `community_page_views` + `gallery_id` → `page_id` (incluindo policies/index renomeados)
- Index `idx_topics_page_status_created` substitui o antigo

**Estrutura nova da sidebar `/community`:**
- **Feed** (atalho fixo no topo, ícone gold) → `/community/feed`
- **Grupos colapsáveis por espaço** (`▼ Comece por aqui`, `▼ Mentoria 20K`, etc) — title não-clicável, só expand/collapse
- **Páginas dentro do espaço** (`📋 Regras`, `🚪 Apresente-se`, ...) — clicáveis, abrem o feed daquela página
- **Páginas órfãs** (sem `space_id`) ficam num grupo "Sem espaço"
- **Links / Atalhos** no fim (URLs externas, abrem em nova aba)

**Páginas:**
- `/community` redireciona pra `/community/feed`
- `/community/feed` — feed agregado de todos os posts approved de TODAS as páginas ativas (30 por vez, mais recentes primeiro)
- `/community/[slug]` — feed de uma página específica
- `/community/[slug]/post/[postId]` — detalhe + comentários

**Admin inline na sidebar (substitui /admin/community/spaces+links):**
- Quando `role IN (admin, moderator)`, controles aparecem ao passar mouse:
  - **Espaços**: botão "+ Adicionar espaço" no fim, menu `...` em cada (Renomear / Excluir — paginas viram órfãs)
  - **Páginas**: botão "+ Adicionar página" dentro de cada espaço (form inline com ícone + nome), menu `...` em cada (Editar / Excluir — apaga posts)
  - **Atalhos**: botão "+ Adicionar link" no fim (form inline com ícone + label + URL), trash no hover de cada
- Tudo via Server Actions com `router.refresh()` + toast
- Páginas `/admin/community/spaces` e `/admin/community/links` REMOVIDAS — admin agora gerencia direto da `/community`

**Componentes novos/modificados:**
- `src/components/community/community-sidebar.tsx` — re-escrita completa com `SpaceGroup`, `PageRow`, `SpaceActions`, `PageActions`, `CreateSpaceButton`, `CreatePageButton`, `EditSpaceForm`, `EditPageForm`, `CreateLinkButton`, `SidebarLinkRow`
- `src/app/(admin)/admin/community/actions.ts` — nova surface: `createSpace`/`updateSpace`/`deleteSpace`, `createPage`/`updatePage`/`deletePage` (substituiu `createGalleryAction` etc)
- `src/lib/community.ts` — `CommunitySpaceRow` + `CommunityPageRow` (substitui `CommunityGalleryRow`)

**Notificações in-app:**
- `src/lib/notifications.ts` — `tryNotify({userId, title, body, link})` silent-fail + `tryNotifyMany`
- Tabela `notifications` (já existia) usada pra TODOS os eventos
- **Hooks plugados** automaticamente:
  - `approvePostAction` → "Sua publicação foi aprovada" pro autor com link
  - `rejectPostAction` → "Sua publicação foi recusada" pro autor
  - `createReplyAction` → "Novo comentário no seu post" pro autor do tópico (se ≠ comentarista) + "Alguém respondeu seu comentário" pro autor do parent (se for resposta aninhada)
  - `checkAchievements` → "Conquista desbloqueada: {nome}" + descrição/XP no body
- **Sino do topbar**: agora real — mostra badge com `count` de não-lidas + dropdown com 8 mais recentes (cada uma vira `Link` se tiver `link`); items vêm do `student/layout.tsx` que carrega via `Promise.all`
- **`/notifications`**: lista das 100 mais recentes, badge dourado em não-lidas, "Marcar todas como lidas" via `markAllNotificationsReadAction`
- **`/notifications/actions.ts`**: `markAllNotificationsReadAction` + `markNotificationReadAction`

### Etapa 16 — Gamification + Configs avançadas (sessão Maio 2026)

Sistema completo de XP/streak/conquistas/leaderboard + comunidade configurável + badges de não-lidos.

**Schema (1 migration grande):**
- Função SQL `current_xp_period_start()` retorna o 1º dia do trimestre civil atual (jan/abr/jul/out) — base do reset trimestral fixo
- `user_xp(user_id PK, total_xp, current_level, current_streak, longest_streak, last_activity_date, current_period_start)` — agregado por aluno
- `xp_log(id, user_id, amount, reason, reference_id, period_start, created_at)` — auditoria com **UNIQUE(user_id, reason, reference_id, period_start)** garantindo idempotência (mesma ação na mesma referência nunca dá XP 2x no trimestre)
- `achievements(id, code UNIQUE, name, description, icon, category, required_value, xp_reward, sort_order, is_active)` — catálogo configurável
- `user_achievements(user_id, achievement_id, unlocked_at)` — desbloqueios M:N
- `community_space_views(user_id, gallery_id, last_seen_at)` — pra badges de não-lidos
- **Seed de 19 conquistas** em 4 categorias: Primeira vez (6), Streak (3), Volume aulas/cursos (6), Comunidade (4)
- **Limpou seed de galerias** da comunidade — admin cria do zero

**Configs novas em `/admin/settings` (`SETTINGS_KEYS` em `lib/settings.ts`):**
- **Comunidade**: `community_auto_approve` (toggle), `community_max_image_mb` (default 10), `community_max_comment_chars` (default 10000)
- **Gamification**: `gamification_enabled` (kill switch), `xp_lesson_complete` (10), `xp_streak_7d` (50), `xp_first_access_day` (2), `xp_lesson_rated` (3), `xp_comment_approved` (5), `xp_post_approved` (20), `xp_course_completed` (100), `leaderboard_visible_to_admin/moderator/student`
- Helper `canSeeLeaderboard(settings, role)` em `lib/settings.ts`

**Lógica (`src/lib/gamification.ts`):**
- `awardXp(admin, {userId, amount, reason, referenceId})` — idempotente via UNIQUE; atualiza total + level + dispara `checkAchievements`
- `bumpStreak(admin, userId, xpStreak7d)` — compara `last_activity_date` com hoje; reseta se >1 dia, +1 se ontem, noop se hoje. Bonus XP a cada múltiplo de 7
- `checkAchievements(admin, userId)` — calcula contadores reais (lessons completed, notes, ratings, posts, comments, courses 100%, longest_streak) e desbloqueia conquistas elegíveis (greedy)
- `levelFromXp(xp)` — retorna level + label + pct até próximo nível (6 levels: Iniciante 0 / Estudante 100 / Dedicado 300 / Engajado 700 / Veterano 1500 / Mestre 3500+)
- `ensureUserXp(admin, userId)` — cria registro se não existe + **aplica reset trimestral** automaticamente quando `current_period_start < current_xp_period_start()` (zera total_xp + level, preserva streaks)
- Wrappers silent-fail `tryAwardXp` e `tryBumpStreakAndDailyXp` — chamados das actions sem bloquear UX

**Hooks plugados:**
- `toggleCompleteAction` (lesson) → +XP_LESSON_COMPLETE + checa conclusão 100% do curso (bonus XP_COURSE_COMPLETED idempotente por courseId)
- `rateLessonAction` → +XP_LESSON_RATED (1x por aula no trimestre)
- `logLessonViewAction` → `tryBumpStreakAndDailyXp` (streak + 1 vez por dia +XP_FIRST_ACCESS_DAY)
- `createPostAction` (community) → respeita `community_auto_approve`; se aprovado direto (auto-approve OU autor admin/mod), XP imediato; senão XP é dado quando admin aprova
- `createReplyAction` → +XP_COMMENT_APPROVED (idempotente por replyId)
- `approvePostAction` → +XP_POST_APPROVED pro autor (só se mudou de não-aprovado pra aprovado)

**UI aluno:**
- `XpPill` no topbar (`src/components/xp-pill.tsx`) — level + barra XP + 🔥streak; clica pra `/profile#gamification`
- `/profile` ganhou seção "Sua jornada" (`src/components/student/gamification-section.tsx`): 3 cards (Nível com barra de progresso, Streak atual, Melhor sequência) + grid de conquistas (desbloqueadas no topo, locked depois com 🔒)

**Leaderboard:**
- `/admin/community/leaderboard` — Top 30 alunos do trimestre, exclui admin/mod do ranking, podium colorido (1º ouro, 2º prata, 3º bronze)
- Acesso controlado por `canSeeLeaderboard(settings, role)` — admin pode permitir alunos verem
- Card adicionado no `/admin/community` index

**Badges de não-lidos:**
- Layout `/community` carrega `community_space_views` do user + conta posts approved mais novos por gallery (excluindo posts próprios)
- `CommunitySidebar` mostra badge vermelho `(N)` ou `99+` em cada espaço com posts não-lidos
- `/community/[slug]` upserta `last_seen_at = now()` ao entrar — zera o badge daquele espaço

### Etapa 10 — Comunidade (commit `b38b06b`)

Implementação completa estilo Circle.so adaptado pra nossa stack. **Comunidade global única** (sem múltiplas comunidades por curso) — admin define quais turmas têm acesso via `cohort_courses.has_community_access`.

**Schema (4 migrations Supabase):**
- `community_topics` ganhou: `status` (`pending`/`approved`/`rejected` default `pending`), `approved_by`, `approved_at`, `video_url`, `image_url`, `likes_count`, `replies_count`
- `community_replies` ganhou: `parent_id` (1 nível de aninhamento), `likes_count`
- `community_galleries` ganhou: `slug` (UNIQUE), `icon`
- Nova tabela `community_sidebar_links` (atalhos custom — label, URL, ícone, abrir nova aba)
- Triggers automáticos pra `likes_count`/`replies_count`
- Index full-text português em `community_topics(title + content_html)`
- Bucket `community-post-images` (público, 10MB max, jpeg/png/webp/gif)
- Seed inicial: 4 espaços (Comece Aqui, Geral, Dúvidas, Conquistas)

**Aluno (`/community/*`):**
- Layout com **second sidebar** de espaços + atalhos + busca
- `/community` redireciona pro primeiro espaço visível
- `/community/[slug]` feed paginado (20 por vez) de posts aprovados; box no topo mostra próprios posts pendentes
- Card de post: avatar + autor + tempo + título + preview + vídeo embed (YT/Vimeo) + imagem; like otimista, link pra detalhe
- **Modal "Nova publicação"**: TipTap rich text + URL vídeo + upload de imagem; aluno → `pending`, admin/mod → `approved` direto
- `/community/[slug]/post/[postId]`: detalhe com vídeo/imagem/HTML sanitizado, like, badges admin/moderador, **thread de comentários** (root + 1 nível de respostas, likes em comentários, excluir próprio ou admin)
- Acesso bloqueado pra quem não tem `has_community_access` em nenhuma turma ativa

**Admin (`/admin/community/*`):**
- Index com 4 cards (pendentes destacado em amarelo se > 0, aprovados, espaços, atalhos)
- `/queue` — fila de moderação com Aprovar/Rejeitar (links pro vídeo/imagem/post completo pra revisar)
- `/spaces` — CRUD de galerias (ícone emoji + nome + slug auto-gerado + descrição + ativo)
- `/links` — CRUD de atalhos da sidebar (ícone + label + URL + nova aba)

**Helpers (`src/lib/community.ts`):**
- `userHasCommunityAccess(supabase, userId, role)` — gate de acesso
- `slugify(input)` — slug seguro
- `videoEmbedUrl(url)` — converte YouTube/Vimeo URL pra embed
- `sanitizePostHtml(html)` — XSS guard (remove script/style/iframe/on*=, javascript:)
- `timeAgoPtBr(iso)` — "há 2h", "ontem", etc.

### Sessão Maio 2026 — Polimento e fixes críticos (commits `4eff355` → `8d99e88`)

**Whitelabel + Welcome (Etapa 14):**
- `/admin/settings` com 4 fieldsets: Identidade (nome + logo URL), E-mail (sender name/email), Suporte (e-mail + WhatsApp), Boas-vindas (toggle + título + descrição + vídeo + termos + label do botão)
- `lib/settings.ts` centraliza `getPlatformSettings()` + chaves consts. `buildResendFrom()` resolve sender preferindo settings → env → default
- `WelcomeModal` (portal) dispara no primeiro acesso quando `welcomeEnabled && !welcome_accepted_at && role==='student'` — popup com vídeo embed + descrição + termos opcional + checkbox aceitar + CTA. Aceitar grava `users.welcome_accepted_at`
- Sidebar/topbar/email/login renderizam `platformName` + `platformLogoUrl` (com fallback "A" dourado quando logo não setado). Logo no email: `<img>` 120×168 com `object-fit:contain`

**Perfil + Suporte (Etapa 15):**
- `/profile` — avatar upload (Storage `avatars` bucket), trocar senha (reauth com senha atual antes), telefone, lista de matrículas (turma + data + expira)
- `/support` — card WhatsApp (link `wa.me/{digits}`) + form de e-mail. Subject prefixado com `cohorts.support_prefix` quando o aluno escolhe um curso. Sender configurável via settings, fallback `suporte@felipesempe.com.br`
- Coluna `cohorts.support_prefix` adicionada (admin define no form de turma)

**Estrutura de matrícula:**
- `createStudentAction` aceita **multi-cohort** via `formData.getAll("cohort_ids")`, loop idempotente (insert ou reativa)
- Senha padrão `"123456"` definida em `DEFAULT_STUDENT_PASSWORD` (constante interna não-exportada). E-mail mostra credenciais; botão "Acessar minha conta" vai pra `/login?email=` (não mais recovery)
- `/admin/students/[id]` ganhou seção "Adicionar matrícula" — mesmo padrão de checkboxes, filtra cohorts onde aluno já está ativo, reativa inativas
- Action `addEnrollmentsAction(userId, formData)` + `setEnrollmentActiveAction` (preparada para uso futuro)

**Métricas e bug fixes críticos de RLS:**
- 🐛 **`/admin/students/[id]/atividade`** mostrava 0 em todos os cards — RLS de `access_logs`/`lesson_progress`/`lesson_notes` filtra por `auth.uid()`, então admin lendo dados de OUTRO aluno via session client retorna vazio. Fix: página inteira passa a usar `createAdminClient()` (gate de admin já vem do layout)
- 🐛 **`/admin/reports`** sofria do mesmo bug — também migrado pra admin client
- `/admin/dashboard` ganhou seção "Alunos": Cadastrados, Ao vivo agora (5min), Hoje, 7d, 30d (distintos com `last_watched_at` no período). Badge verde quando "ao vivo > 0"

**UX de retomada:**
- `/courses/[courseId]` ganhou CTA dourado abaixo do título: "Começar curso" no primeiro acesso, "Continuar de onde parou" depois (busca aula com `last_watched_at` mais recente daquele curso)
- **Resume position dentro do vídeo (cross-device)**:
  - Migration `add_last_position_to_lesson_progress`: coluna `last_position_seconds INTEGER NOT NULL DEFAULT 0`
  - Action `saveLessonPositionAction(lessonId, positionSeconds)` com upsert
  - `YouTubePlayer` migrado de iframe simples → **YouTube IFrame Player API** (`script https://www.youtube.com/iframe_api`)
  - Posição salva: server a cada 10s (delta ≥ 3s) + visibilitychange + beforeunload + unmount; localStorage como cache otimista entre saves; resume usa o MAX(server, local)
  - Watch-time ping agora baseado em `getPlayerState() === 1` (playing real, não "tempo na página")

**Responsividade — admin mobile drawer:**
- Sidebar fixa de 240px ocupava 64% de tela 375px (admin inutilizável em mobile)
- Novo `MobileNavToggle` (drawer client com portal, ESC, click-outside, fecha ao clicar em link)
- Admin layout: sidebar fixa só `md:flex`; em mobile renderizada dentro do drawer via `mobileNav` slot do Topbar (botão hamburger)
- Topbar aceita slot `mobileNav` (esquerda); padding ajustado `px-4 md:px-6`
- Aluno: `min-w-0` na coluna principal, `p-4 md:p-8`. Sidebar slim de 64px funciona até 320px
- Tabela `/admin/students` ganhou `overflow-x-auto` + `min-w-[640px]`

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

### ✅ Sistema de afiliado Kiwify — Fase A + B + refator email/nome

Tracking de vendas de afiliado (cada aluno é afiliado de produtos Kiwify do
Felipe). Aluno vê só os próprios; admin vê tudo de todos.

**Identificação por EMAIL + NOME (dupla verificação):**
- `affiliate_id` da Kiwify é POR PRODUTO, não estável por afiliado — descartamos
- Aluno cadastra **e-mail Kiwify** (chave única, case-insensitive) + **nome
  cadastrado na Kiwify** (segundo fator)
- Match feito após normalização: `normalizeEmail` (lowercase + trim) e
  `normalizeName` (lowercase + sem acento + colapsa espaços) — em
  `src/lib/affiliates/normalize.ts`
- 4 cenários de matching (em `process.ts > processApproved`):
  - email ✅ + nome ✅ → atribui sale, dá XP, avalia conquistas, marca verified
  - email ✅ + nome ❌ → sale fica órfã + notifica aluno (anti-spam 24h)
  - email ❌ → sale órfã (espera alguém vincular esse email no futuro)
  - sem affiliate no payload → ignora

**Schema `afiliados`** (separado de `membros` e `public`):
- `sales_raw` — log bruto de TODOS os webhooks (auditoria + reprocessamento)
- `affiliate_links` — vinculação aluno↔kiwify
  - UNIQUE case-insensitive em `(source, lower(kiwify_email))`
  - colunas: kiwify_email, kiwify_name, cpf_cnpj_encrypted, cpf_cnpj_last4,
    verified, verified_at, registered_at
- `sales` — vendas processadas
  - UNIQUE em `(source, external_order_id, kiwify_email)` (1 linha por
    order × email, idempotente)
  - colunas: kiwify_email, kiwify_name, kiwify_affiliate_id (info auxiliar),
    member_user_id (nullable até reconciliar), status, commission_value_cents,
    gross_value_cents, approved_at, xp_awarded

**Conquistas em `membros.achievements` (15 novas):**
- `sales_count` (1, 5, 10, 25, 50, 100, 500, 1000 vendas)
- `sales_value` (R$1k, R$5k, R$10k, R$50k, R$100k, R$500k, R$1M de comissão)

**Webhook** `POST /api/webhooks/kiwify`:
- URL prod: `https://npb-area-de-membros.vercel.app/api/webhooks/kiwify?token=<KIWIFY_WEBHOOK_TOKEN>`
- Auth: `?token=` (env var) + HMAC-SHA1 opcional via `?signature=` (a Kiwify manda)
- Salva raw → chama `processSalesRaw` → 200 OK
- Sempre 200 mesmo com erro (Kiwify não reenvia; raw fica `processed=false`
  pra reprocessar via UI admin)

**Lib `src/lib/affiliates/process.ts`:**
- `processSalesRaw(rawId)`: identifica evento, processa
- `processApproved`: itera `commissioned_stores` filtrando `type='affiliate'`,
  match por email + nome, upsert em `sales` (idempotente via UNIQUE), atribui
  XP e avalia conquistas se vinculação verified e venda >= registered_at
- `processReversal`: refund/chargeback → status atualizado + XP revertido
  (xp_log usa amount negativo com mesma `reference_id`)
- `evaluateKiwifyAchievements`: greedy check + dispara `tryNotify`
- `backfillOrphanSales(email, name, userId, registeredAt)`: quando aluno
  cadastra, atribui vendas órfãs com email + nome batendo (após registered_at)

**Vinculação:**
- Aluno cadastra **e-mail Kiwify** + **nome cadastrado na Kiwify** (idêntico)
- + opcionalmente **CPF/CNPJ** (criptografado AES-256-GCM, últimos 4
  dígitos visíveis). NÃO é validado contra Kiwify, só audit
- Status `verified=false` até 1ª venda chegar com email+nome batendo
  (auto-confirma + dispara notifyAndEmail "Vinculação confirmada")
- Admin pode forçar `verified=true` em `/admin/affiliates`
- Vendas só contam a partir do `registered_at` (não retroativo)

**XP (decidido):**
- `+1 XP por R$1 de comissão + 10 XP fixo` por venda paga
- Ex: comissão R$47 → 57 XP
- Refund/chargeback reverte o XP via `reason: 'kiwify_sale_reversal'` +
  amount negativo (mesma reference_id = sale.id)
- XP de bônus das conquistas vai separado (`reason: 'achievement_unlock'`)

**UI:**
- `/profile#afiliado` (aluno) — 3 estados (não vinculado/pendente/verificado),
  form pede e-mail + nome (com aviso "tem que ser IDÊNTICO ao da Kiwify"),
  card com comissão acumulada e qtd vendas, lista das últimas 5 vendas,
  alerta se há `nameMismatchCount > 0` (vendas órfãs com email batendo mas
  nome não)
- `/admin/affiliates` (admin) — stats globais (vinculações, vendas, comissão,
  órfãs), tabela de vinculações com aluno+email+nome+stats agregadas,
  tabela das últimas 100 vendas, botão **"Reprocessar N pendentes"** no
  header pra rodar `processSalesRaw` em raws com `processed=false`
- Ações admin (`AffiliateRowActions`): forçar verificar/desverificar, ver
  CPF/CNPJ decifrado sob demanda (toggle), desvincular
- Link no admin sidebar: Análises → Afiliados Kiwify (ícone `Wallet`)

**Privacidade:**
- RLS estrita em `afiliados.*` — aluno SELECT só os próprios links/sales
- service_role bypassa pra processar webhook + admin
- CPF/CNPJ criptografado no banco (AES-256-GCM, chave derivada do
  service_role); admin decifra sob demanda via `revealCpfCnpjAction`
- Sem leaderboard público de afiliados (decisão de produto)

**Variáveis de ambiente:**
- `KIWIFY_WEBHOOK_TOKEN` — token forte, mesmo valor que vai na URL `?token=`
  - Local: já no `.env.local`
  - **Produção**: precisa adicionar no Vercel (Settings → Environment
    Variables) e fazer Redeploy

**Migrations Supabase aplicadas:**
- `create_afiliados_schema_and_sales_raw` (Fase A — schema + log raw)
- `afiliados_phase_b_links_sales_achievements` (Fase B inicial — affiliate_id)
- `afiliados_switch_to_email_name_dual_check` (refator — drop affiliate_id,
  add email+name, novo UNIQUE constraint)

**Como rodar pra trás (Felipe):**
1. Cadastrar webhook na Kiwify com URL acima
2. Vincular conta no `/profile#afiliado` com email+nome IDÊNTICOS aos da Kiwify
3. Fazer 1 venda real → confirmar que `afiliados.sales_raw` recebe e processa
4. Se ficar órfã (sales_raw.processed=true mas sale sem member_user_id):
   verificar se nome/email batem com o cadastrado e ajustar pelo `/profile`

**Pendências futuras (não bloqueia uso):**
- Filtro/busca em `/admin/affiliates` (hoje só lista 100 mais recentes)
- Export CSV de vendas
- Dashboard com gráfico de vendas/mês
- Manual override pra fictícios (admin insere venda manual)
- Suporte a Hotmart/Eduzz (schema já é genérico via `source` column)

---

### 👤 Role `FICTICIO` ✅ (Etapa 19 — implementação parcial)

Implementado:
- ✅ Migration `add_ficticio_role` expandiu CHECK constraint
- ✅ Option "Fictício (teste)" nos forms create/edit de aluno
- ✅ Badge azul "Fictício" na listagem `/admin/students` e detalhe
- ✅ Toggle "Mostrar/Esconder fictícios" via `?showFicticio=0` em `/admin/students` (default = mostrar)
- ✅ `isElevatedRole` continua só admin/moderator (fictício é tratado como student)
- ✅ Fictício recebe XP, sobe nível, desbloqueia conquistas igual aluno (mesma engine)

**Pendente (não bloqueia uso atual):**
- Filtro/toggle "Mostrar fictícios" também em `/admin/reports` e `/admin/dashboard`
  (hoje contam todo mundo)
- Página/UI pra admin **inserir vendas manuais** pra fictícios (e assim acumular
  XP de afiliado sem precisar de webhook Kiwify real)
- Quando role = `ficticio`, permitir editar afiliado manual no próprio `/profile`
  (hoje só admin pelo `/admin/affiliates` poderia)

---

### 🐛 Bugs / observações
- **Suporte e-mail não chegou** (reportado 2026-05-01) — sintoma: chunks `.next` 404 no console (`main-app.js`, `support/page.js`). Form é client-side, então quando o JS não carrega, clicar em "Enviar" não dispara nada. Fix do dev: `Remove-Item -Recurse -Force .next; npm run dev` + Ctrl+Shift+R. Se persistir após cache limpo, investigar Resend (RESEND_API_KEY ausente, domínio não verificado, etc.) e adicionar log persistente em `webhook_logs`
- **"Sistema quebrou abrindo/fechando telas"** (relato anterior, sem repro recente) — provável mesmo problema de cache `.next` velho. Se voltar, capturar console + terminal

### Etapa 10 — Comunidade ✅ (commit `b38b06b`)
Concluída — ver seção acima.

### Etapa 16 — Gamification + Configs ✅
Concluída — ver seção no topo. Configs de comunidade e gamification configuráveis em `/admin/settings`.

**5 níveis com badges hexagonais** (atualizado pós-Etapa 16, badges em
`public/imagens/levels/`):

| # | Label        | XP min | Cor       |
|---|--------------|--------|-----------|
| 1 | Recruta      | 0      | Cinza     |
| 2 | Estrategista | 100    | Verde     |
| 3 | Especialista | 300    | Azul      |
| 4 | Autoridade   | 700    | Roxo      |
| 5 | Elite        | 1500   | Dourado   |

Badge SVG aparece no `XpPill` (topbar) e no `GamificationSection` (perfil).
Configurado em `LEVEL_THRESHOLDS` em `src/lib/gamification.ts`.

**Polimentos sugeridos pra próximas iterações:**
- Drag-and-drop pra reordenar espaços e atalhos (hoje só `position` numérico no DB)
- Notificação ao autor quando post é aprovado/rejeitado (e-mail via Resend + sino in-app)
- Notificação quando alguém responde no tópico do aluno
- Notificação quando aluno desbloqueia conquista
- Pinning (`is_pinned` já existe no schema, falta UI)
- Realtime via Supabase channels (atualiza feed/badges quando post novo aprovado)
- "Curtidas em meus posts" como aba do `/profile`
- Histórico de XP por trimestre no `/profile` (timeline com `xp_log`)
- Conquistas com slogans no avatar (ex: "Aluno destaque" pra quem desbloqueou X conquistas) — ainda não implementado

### Etapa 13 — Notificações in-app ✅ (Etapas 17 + 19)
- ✅ Página `/admin/students/[id]/atividade` (timeline + stats)
- ✅ `/admin/reports` (engajamento + ratings)
- ✅ `/admin/dashboard` (alunos + conteúdo + **vendas afiliados** hoje/7d/30d — Etapa 19)
- ✅ Sino com badge no topbar — conectado, dropdown com 8 mais recentes
- ✅ Página `/notifications` com histórico + "Marcar todas como lidas" (RLS UPDATE adicionado na Etapa 19)
- ✅ Triggers: nova aula publicada (drip), resposta na comunidade, conquista desbloqueada
- ✅ E-mail transacional via Resend (`notifyAndEmail`) com toggle por user (`email_notifications_enabled`)
- ❌ **Pendente**: cron diário pra notificar drip que liberou (precisa Vercel Cron)

### 🔌 Integração `transactions_data` → matrícula automática (PENDENTE — bloqueado em input do Felipe)
- ✅ Webhook HTTP `POST /api/webhooks/enrollment` pronto pra fontes externas (Kiwify/Hubla)
- ❌ Trigger SQL no `public.transactions_data` (separado do webhook HTTP — esse é pra automação interna do NPB):
  - Tabela `membros.product_cohort_map` já existe (vazia)
  - **Próximo passo:** Felipe precisa mapear: "produto X (`low ticket automático 2.0`, código `xxx`) = turma Y (uuid)". Quando passar o mapeamento, criar trigger AFTER INSERT/UPDATE em `public.transactions_data`:
    - `Compra Aprovada` → cria/ativa matrícula
    - `Compra Cancelada` / `Compra Reembolsada` / `Cancelada` → desativa
    - `EXCEPTION WHEN OTHERS` em volta de tudo (zero risco de bloquear venda)
  - E rodar backfill das **2637 compras aprovadas** já existentes

### ✅ Polimentos batidos na Etapa 20
Movidos pra concluído na Etapa 20: filtros + CSV em /admin/affiliates, gráfico vendas/mês,
manual sale UI, pinning, reorder de espaços, realtime feed, cron drip, formatDateBrt em
todas as telas, toggle fictícios em reports/dashboard. Ver seção Etapa 20 acima.

### Polimentos antigos (referência)
- Quick-edit de **aula** (popup com título + cover + duração) — hoje só módulo tem
- "Aula default do curso" — admin escolher qual aula abre na primeira vez (hoje a regra é automática: 1ª aula do 1º módulo no first access, depois última assistida via CTA)
- Editor de aula em mobile (TipTap + abas pode apertar < 500px)
- Edição inline de banner (delete+recriar funciona, mas é ruim)
- Bucket `lesson-attachments` está OK mas anexos são públicos por URL UUID — se for armazenar PDFs sensíveis, trocar pra signed URLs
- Rate limiting no webhook (`@upstash/ratelimit` ou solução simples com timestamp em Redis/Supabase)
- Domínio próprio no Resend (hoje sender `onboarding@resend.dev` só envia pro dono da conta — Felipe disse que adicionou domínio, aguardar propagação DNS)
- Limpar `ReorderControls` (`src/components/admin/reorder-controls.tsx`) e os `move*Action` antigos — órfãos depois do drag-and-drop

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

> Estou continuando o projeto da Área de Membros Academia NPB. Leia primeiro o `HANDOFF.md` e o `SPEC_AREA_DE_MEMBROS.md` na raiz do repo. O Supabase está em `hblyregbowxaxzpnerhf` (schema `membros`). **Etapas 1 a 18 estão completas** — Comunidade Circle.so style (Etapas 10+17+18), Gamification (Etapa 16), Notificações in-app (Etapa 17). Comunidade: Espaços > Páginas, admin inline na sidebar, EmojiPicker com busca, imagens inline no TipTap, editar/excluir próprio post, mobile drawer funcional pra aluno+admin, espaçamento real entre parágrafos via `.community-html`. **Próximas frentes:**
>
> 1. **E-mail transacional via Resend** pros eventos de notificação (hoje só in-app). Boas candidatas: post aprovado, novo comentário no meu post, conquista importante.
>
> 3. **Trigger SQL `transactions_data` → matrícula:** depende de Felipe mapear "produto X = turma Y" em `membros.product_cohort_map` (vazia hoje). Webhook HTTP já existe.
>
> 4. **Bug em aberto:** suporte e-mail não chega — provavelmente cache `.next` velho (chunks 404 no console). Se persistir após `Remove-Item .next + npm run dev + hard reload`, investigar Resend (domínio Felipe disse que configurou, esperar propagação DNS).
>
> 5. **Polimentos:** quick-edit de aula; campo "aula default do curso" no admin; rate limit no webhook; deletar `ReorderControls` órfão; signed URLs pra anexos.

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
| `70579e1` | **Etapas 14 + 15 + cohort prefix** (whitelabel /admin/settings, perfil do aluno, /support com WhatsApp + e-mail, support_prefix em turmas) |
| `a49e4ea` | feat: nome da plataforma vem de platform_settings (sidebar/topbar/email) |
| `a2dee21` | feat: logo custom, welcome modal (popup primeiro acesso), banners global, esconde busca |
| `4c2b957` | feat: senha padrão 123456, multi-cohort no aluno, video picker no welcome |
| `17f5045` | feat: logo custom no email de boas-vindas (120x168, 5:7) |
| `8d99e88` | matrículas adicionais + fix RLS atividade/reports + dashboard alunos + resume cross-device + mobile drawer |
| `ffece83` | docs: HANDOFF sessão Maio 2026 |
| `b38b06b` | **Etapa 10 — Comunidade completa** (feed, posts com vídeo/imagem, comentários aninhados, likes, moderação admin, CRUD espaços e atalhos) |
| `3818660` | docs: HANDOFF marca Etapa 10 concluída |
| `bda91d2` | **Etapa 16 — Gamification + Configs avançadas** (XP/streak/conquistas/leaderboard com reset trimestral fixo + configs de comunidade e gamification em /admin/settings + badges de não-lidos por espaço) |
| `d232aa2` | docs: HANDOFF marca Etapa 16 |
| `ea786ad` | **Etapa 17 — Comunidade Circle.so style + Notificações** (spaces > pages, sidebar inline admin, /feed agregado, sino real conectado à tabela notifications, /notifications, triggers em approve/reject/reply/achievement) |
| `0e76bd6` | docs: HANDOFF marca Etapa 17 |
| `07b9e78` | **Etapa 18 — Correções UX comunidade** (sidebar aluno com nomes + drawer mobile, sidebar comunidade no mobile, EmojiPicker com busca, fonte do espaço maior, espaçamento parágrafos, imagens inline no editor TipTap, editar/excluir próprio post) |
| `08b890f` | docs: HANDOFF marca Etapa 18 |
| `2b0d875` | fix(player): video YT ocupa container inteiro no mobile + borda menos arredondada (rounded-md) |

---

**FIM DO HANDOFF.** Mantenha este documento sincronizado conforme as etapas avançam — é a memória do projeto entre sessões e máquinas.
