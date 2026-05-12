# HANDOFF — Área de Membros Academia NPB

> **Documento vivo de transferência de contexto.** Use isto pra continuar o trabalho em qualquer máquina (sua, do colega, ou em outra sessão do Claude). Mantenha atualizado conforme o projeto avança.

**Última atualização:** 2026-05-12 — Etapa 35: Painel Circle import + ajustes broadcast/feed/cron
**Último commit no main:** `0d628fa` — feat(etapa35): popup expira + interromper broadcast + feed timeline + fix recovery cron
**Domínio custom (prod):** https://membros.felipesempe.com.br ✅
**Vercel (preview/fallback):** https://npb-area-de-membros.vercel.app
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

## 🔮 Melhorias futuras (backlog)

- **Rastreamento de presença em monitorias** — hoje sabemos quem foi *avisado* mas não quem *entrou* no Zoom (tudo acontece no app nativo). Solução: criar um Zoom Marketplace App e assinar webhooks `meeting.participant_joined` / `meeting.participant_left`, gravar em `live_session_attendances (session_id, user_id, joined_at, left_at)`. Permitiria stats por aluno + estatística por monitoria. Cliente abriu mão pra MVP — dá pra adicionar depois sem mexer no fluxo atual.

---

## ✅ Etapas concluídas

### Etapa 35 — Painel Circle import + ajustes broadcast/feed/cron (2026-05-10 → 2026-05-12)

**Commits:** `aaf80b4` (painel Circle import — Etapa 34.5, ainda dentro do escopo da 35), `0d628fa` (popup expira + interromper + feed timeline + fix recovery)

**Por que:** consolidação de várias melhorias pequenas pedidas pelo Felipe + correção de um bug de recovery do cron de auto-enroll que estava quebrado em silêncio (descoberto durante análise de Disk IO da Supabase).

**1) Painel de importação Circle** (`/admin/import/community`)
- Migra posts/comments/membros de uma comunidade exportada do Circle pra `membros.community_topics` + `community_replies`.
- Fluxo: upload de 4 CSVs (posts, comments, members, spaces) → análise (cruza autores por nome com `membros.users` por email) → admin decide cada autor (use_existing / create_fictitious / skip) → admin marca quais posts importar (default desmarcado, agrupados por space) → executa.
- Posts entram com `status='approved'`, `is_moderated=true`, `created_at` preservado do Circle.
- Felipe excluído por nome (todos "Felipe Sempe" filtrados).
- Imagens hospedadas no Circle podem ser migradas pro bucket `course-covers/circle-import/` no momento do import (1-3s extra por post com imagem).
- Comments importados com threading (top-level primeiro, depois filhos resolvendo `parent_id`).
- Arquivos: `src/lib/circle-import.ts`, `src/app/api/admin/import/community/{analyze,run}/route.ts`, `src/components/admin/circle-import-panel.tsx`, `src/app/(admin)/admin/import/community/page.tsx`.

**2) Popup grande ganha "expira em" + botão Interromper no histórico**
- Migration `push_broadcasts_popup_expires_at`: nova coluna `popup_expires_at TIMESTAMPTZ NULL` em `membros.push_broadcasts`. `getNextPopupForUser` filtra `popup_expires_at IS NULL OR popup_expires_at > now()`.
- Form de broadcast ([broadcast-form.tsx](src/components/admin/broadcast-form.tsx)) tem novo `<input type="datetime-local">` no bloco do popup, idêntico ao do banner.
- Histórico de broadcasts ganha botão **Interromper** ([stop-broadcast-button.tsx](src/components/admin/stop-broadcast-button.tsx)) que aparece só quando o broadcast tem banner ou popup ainda ativos. Action `stopBroadcastDeliveryAction` seta `banner_expires_at` e/ou `popup_expires_at = now()`. Push e in-app já foram entregues no momento do envio — não dá pra desfazer; o componente já avisa isso na confirmação.

**3) Feed da comunidade vira timeline pura**
- [src/app/(student)/community/feed/page.tsx](src/app/(student)/community/feed/page.tsx) ignora `is_pinned` na ordenação e força `isPinned: false` ao montar os cards. Posts fixados continuam funcionando dentro de cada página `/community/[slug]`, mas no Feed global aparecem em ordem cronológica sem badge "FIXADO" nem borda dourada.

**4) Fix do recovery do cron `process-pending-purchases` (silent bug)**
- O recovery filtrava por `lt("updated_at", fiveMinAgo)`, mas a tabela `membros.purchase_events` não tem coluna `updated_at` (só `created_at` e `processed_at`). PostgREST retornava erro silencioso (sem `throwOnError`), ou seja: **eventos travados em `processing` por crash de serverless ficavam presos pra sempre**.
- Solução sem schema change: lock atômico em `processPurchaseEvent` agora seta `processed_at = now()` junto com `status = "processing"` (vira "último heartbeat"). Recovery filtra `lt("processed_at", fiveMinAgo)`. Quando o `markEvent` final roda, `processed_at` é sobrescrito com timestamp final — semântica não quebra (status discrimina).
- Fallback do toggle global desativado e o próprio recovery limpam `processed_at = null` ao devolver pra `pending`.
- Arquivos: [src/lib/auto-enroll.ts](src/lib/auto-enroll.ts), [src/app/api/cron/process-pending-purchases/route.ts](src/app/api/cron/process-pending-purchases/route.ts).

**Contexto adicional do Disk IO da Supabase:** o alerta veio porque o banco é compartilhado com `dashboard-estruturamais`, que tem 11 cron jobs `refresh-*` rodando MVs a cada 15-30min. Areademembros não usa nenhum dos MVs (`mv_daily_*`, `mv_hourly_*`, etc) — confirmado por grep. Os crons do areademembros (`live-sessions-notify`, `process-pending-purchases`) rodam a cada 5min com volume mínimo. Vítima do IO compartilhado, não geradora.

---

### Etapa 34 — Activity status (engagement) + webhook outbound de inatividade (2026-05-10)

**Commits:** `421ec88` (feature principal), `6a52761` (phone no payload), `e7a3cbe` (fix "9" do mobile)

**Por que:** Felipe queria separar visualmente alunos engajados dos não engajados sem bloquear acesso (acesso pago continua liberado). Pra usar em campanhas de reativação no Unnichat.

**Decisões arquiteturais:**
- **Sem coluna `activity_status` nova, sem trigger** — status é **derivado** de `auth.users.last_sign_in_at` (já exposto na view `students_admin` desde Etapa 32). Aluno que loga reativa instantâneo, sem propagação. Threshold mudável em runtime via setting (sem migration).
- Critério "acessou" = login no painel (não watch-time/abrir aula). É o que faz mais sentido pra "engajamento" mínimo.
- Aluno que **nunca logou** conta como inativo (não foi engajado).

**Migration `activity_status_settings`:**
- `platform_settings.inactivity_threshold_days = '60'` (default — Felipe pode mudar pra 30/90)
- `platform_settings.inactive_user_webhook_url` (nullable — vazio = noop, status na UI continua)
- `membros.inactive_webhook_log(user_id, fired_on date, fired_at, response_status, response_body, error)` PK composta `(user_id, fired_on)` → idempotência: cron rodando 2× no mesmo dia não duplica disparo

**Backend (`lib/activity.ts`):**
- `isInactive(lastSignInAt, days)` — boolean
- `getActivityStatus(...)` — `'active' | 'inactive'`
- `inactivityCutoffIso(days)` — ISO string pra usar em `.gte()/.lt()` Supabase
- `getUserIdsByActivity(supabase, status, days)` — busca via `students_admin`

**Push helper (`lib/push.ts`):**
- `BroadcastAudience` ganha campo opcional `engagement: 'all' | 'active' | 'inactive'` (default `'all'`)
- `resolveBroadcastAudience` aplica filtro **depois** dos cohorts (não recarrega audiência inteira quando `'all'`)

**Settings UI (`/admin/settings`):**
- Nova fieldset "Status de atividade" com:
  - Input "Inativo após (dias)" (1-365, default 60)
  - Input "Webhook de inatividade (POST)" (URL opcional)
- Help text explica payload, formato `phone_digits` e comportamento de skip sem telefone

**Lista admin (`/admin/students`):**
- Filtro novo "Engajamento" (Todos / Ativos / Inativos)
- Coluna nova "Engajamento" com badge dourado "Ativo" ou cinza "Inativo"
- Coluna "Status" antiga renomeada pra **"Acesso"** (Liberado/Bloqueado, baseado em `is_active`) pra evitar conflito semântico com a nova
- Threshold lido de settings, mostrado no `title` do badge

**Broadcast form (`/admin/notifications/broadcast`):**
- Pill "Status de engajamento" (Todos / Só ativos / Só inativos) abaixo das turmas
- Aparece no preview do confirm modal quando `≠ all`

**Cron `/api/cron/inactive-webhook`:**
- Roda 1×/dia às `0 6 * * *` UTC = 03:00 BRT (configurado em `vercel.json`)
- Detecta quem **cruzou o threshold nas últimas 24h** (`last_sign_in_at` em `[now-(N+1)d, now-Nd]`) — não pega quem já está inativo há tempos
- Lock idempotente via INSERT na log com PK composta — falha 23505 (unique violation) = já fired hoje, pula
- **Quando webhook URL vazia**: registra a transição no log mas não dispara HTTP (útil pra Felipe configurar no Unnichat depois e ter histórico)
- Timeout 10s no fetch — não trava o cron se webhook for lento
- Auth: `Bearer CRON_SECRET` (Vercel cron já adiciona automático)

**Payload do webhook:**
```json
{
  "event": "user.became_inactive",
  "user": {
    "id": "uuid",
    "email": "...",
    "full_name": "...",
    "phone": "(11) 99479-7299",
    "phone_digits": "5511994797299",
    "last_sign_in_at": "..."
  },
  "threshold_days": 60
}
```

**Normalização de telefone (`normalizePhoneDigits` no cron):**
- Strip todos não-dígitos
- Tira DDI 55 se já tiver, normaliza a parte local primeiro
- Cell antigo (10 chars, 1º dígito local 6-9) ganha "9" do mobile automático
  → `(11) 9479-7299` vira `5511994797299`. Encontrei 19 alunos na base nesse formato.
- Fixo (1º dígito 2-5) deixa em 10 chars
- Re-prepende "55" no fim
- Estrangeiro (length ≠ 10/11 depois de strip) passa cru sem "55"
- Aluno **sem telefone válido** → registra `error: "no_phone"` no log e **não dispara HTTP** (Unnichat filtra por phone, sem onde mandar)

**Bonus fix (durante a Etapa 34):**
- `(auth)/migracao/page.tsx` importava `migracaoSignInAction` + `MigracaoResult` que **não existiam** em `actions.ts` (bug pré-existente da Etapa 33 que estava quebrando o build).
- Adicionei a action: tenta login, se senha errada dispara reset por e-mail automático e devolve `{resetSent: true}` pra UI.

**Migrations aplicadas:** `activity_status_settings`

**Arquivos novos:**
- `src/lib/activity.ts`
- `src/app/api/cron/inactive-webhook/route.ts`

### Etapa 33 — Página de migração + redirect domínio antigo (2026-05-08)

**Commits:** `ccc45c4` (página), `9913373` (middleware)

**Por que:** Felipe está migrando alunos da MemberKit antiga (`academia.felipesempe.com.br`) pra Área de Membros nova (`membros.felipesempe.com.br`). Bookmark e link compartilhado dos alunos ainda batem no domínio velho.

**Mudanças:**
- Middleware checa `request.headers.host`. Se for `academia.felipesempe.com.br`, redireciona 308 permanente pra `/migracao` no domínio novo. Cobre TODA rota — bookmark de aula, comunidade, etc.
- Nova página `/migracao` (dentro do route group `(auth)`):
  - Layout `max-w-3xl`: video do YouTube de tutorial em destaque + instruções numeradas (use senha `mudar123` da plataforma antiga) + form de login lado-a-lado no desktop / empilhado no mobile
  - `TUTORIAL_VIDEO_ID` hardcoded no topo do arquivo (trocar quando regravar tutorial)
- Layout `(auth)/layout.tsx` deixou de aplicar `max-w-md` global — agora cada page escolhe sua largura. Login/forgot/reset mantém `max-w-md` (igual antes).

### Etapa 32 — Painel de alunos admin repaginado (2026-05-07)

**Commits:** `6a46741`, `74116a4`, `e7a3454`, `a319aab`, `713b964`, `63d6d47`, `2286855`, `5d49586`, `a359509`

**Por que:** Volume de alunos cresceu (importação da plataforma antiga) e o admin precisava de filtros + import em massa pra operar.

**Filtros + colunas extras em `/admin/students`:**
- Busca textual (nome/email) + filtro de turma + filtro de data de cadastro + filtro "acessou últimos N dias"
- Colunas novas: "Confirmou e-mail" (data) + "Último acesso" — ajuda a identificar alunos inativos
- **Paginação real** (`74116a4`): antes era `.limit(500)` hardcoded. Agora paginated com count + page params na URL

**Importação em massa `/admin/import`:**
- Select de turma destino + upload de CSV + dry-run + execução em chunks com barra de progresso e log de falhas
- Aceita formato do export da plataforma antiga (Id, Nome completo, Email, Criado em, CPF/CNPJ, Telefone…). **Obrigatórias:** Email + Criado em. Outras opcionais
- Regra de matrícula:
  - Aluno novo → cria conta + matrícula
  - Aluno existente sem matrícula nessa turma → adiciona matrícula
  - Aluno existente com matrícula nessa turma:
    - CSV mais recente → renova (atualiza `enrolled_at` + `expires_at`)
    - CSV mais antigo → mantém (preserva tempo do aluno)
- Helper `lib/import-csv.ts` parseia + executa. Linha sem nome cai em fallback "email como full_name" (`a319aab` + `713b964`)

**Access logs admin (`/admin/access-logs`):**
- Botão excluir evento (`63d6d47`)
- Filtro "Todos" agora esconde eventos `skipped` (só aparecem em "Ignorados") — UX mais limpa

**Sidebar:**
- Link "Instagram" + "YouTube" editáveis no admin (`a359509`) — antes hardcoded
- Monitoria agendada mostra link do Zoom já na listagem (`5d49586`) — admin não precisa entrar pra copiar

**Migrations aplicadas:** `students_pagination_indexes` (índices em `created_at`, `last_seen_at`)

### Etapa 31 — Polimentos diversos (2026-05-04 → 2026-05-06)

**Commits:** `efece84`, `bfa7a28`, `aaaac78`, `a596e4a`, `9724eed`, `c241acd`, `e60a600`

Bateria de pequenas melhorias e fixes técnicos espalhados por toda a app.

- **Branding (`efece84`):** logo retangular customizada agora aparece nas telas de login/forgot/reset/migração (antes era só no app interno)
- **Auth (`bfa7a28`):** senha padrão de novos cadastros mudou de `123456` pra `mudar123`. Esconde título "Academia NPB" no login quando há logo customizada (evita duplicar branding)
- **Vercel cron (`aaaac78`):** removeu crons sub-daily — Hobby plan só aceita 1×/dia. Reorganizou o cron de monitoria-status pra rodar 1×/dia em horário de pico
- **Monitorias (`a596e4a`):** calendário do aluno trocou de mensal pra **semanal** — densidade visual melhor no mobile, foca nos próximos 7d
- **Comunidade (`9724eed` + `c241acd`):**
  - Vídeo na descrição do post agora aparece **acima** do texto na prévia do feed (antes ficava embaixo, escondido)
  - Admin/moderador podem **fixar/desfixar posts** pelo menu do post (3 pontinhos). Fixados aparecem no topo do feed do espaço com badge "Fixado"
- **Supabase admin client (`e60a600`):** trocou pra `@supabase/supabase-js` puro em vez de `@supabase/ssr` no `createAdminClient`. O wrapper SSR usava o **Data Cache do Next.js** que cacheava queries indevidamente em produção (admin via dados velhos por minutos). Sem cache = leituras sempre frescas

### Etapa 30 — Auto-enrollment por venda + auto-login + e-mails de boas-vindas em 2 níveis (2026-05-04 → 2026-05-07)

**Commits (cluster massivo):** `9fcaa70`, `1de7307`, `23f399a`, `e6d0303`, `dfc1a63`, `7b8a1d2`, `52853fa`, `da8f2c7`, `db89d8c`, `d78826c`, `ce1c59f`, `ad134b2`

**Por que:** Felipe vinha matriculando aluno **manual** depois de cada venda na Kiwify. Rota crítica — atrasava primeiro acesso e gerava suporte. Esta etapa fecha o ciclo: venda → matrícula → e-mail → login one-click, sem intervenção humana.

**Pipeline (`23f399a` + `dfc1a63` + `e6d0303`):**

1. **Migration `purchase_events`:** tabela queue em `membros.purchase_events` (`transaction_row_id`, `event`, `processed_at`, `error`). UNIQUE(`transaction_row_id`, `event`) garante idempotência.
2. **Trigger SQL** em `public.transactions_data`: ao INSERT ou UPDATE OF `event`, enfileira venda em `purchase_events` se o produto está mapeado. Reage tanto a venda nova quanto a UPDATE (Kiwify às vezes atualiza o row em vez de criar novo).
3. **Setting `auto_enrollment_enabled`** (default `false`): kill switch global na UI.
4. **Página `/admin/products-mapping`:** auto-descobre produtos únicos em `transactions_data` últimos 90d cross-platform (Kiwify+Hubla+Payt+Youshop colapsam em 1 linha por produto). Por produto: dropdown de turma + dias de acesso opcional. **2 cliques.**
5. **Webhook direct `/api/webhooks/kiwify-direct`:** pra produtos fora do `transactions_data` (vendas que não passam pela ETL principal). Enfileira direto em `purchase_events`.
6. **Helper `lib/auto-enroll.ts`:** consome a queue, cria/atualiza usuário, faz UPSERT de `enrollments` com `expires_at` calculado do mapeamento, marca evento como processado. Lock atômico via `UPDATE WHERE processed_at IS NULL` evita race condition entre 2 jobs concorrentes (`db89d8c`). Recovery automático de eventos travados em `processing` há mais de 5min.

**One-click login + Unnichat (`9fcaa70` + `1de7307`):**

- **Rota `/auto-login`:** aceita `?email=...&password=...` na URL, faz sign-in server-side, redireciona pro dashboard. Usado em e-mails (CTA "entrar agora") e em links de WhatsApp.
- **Endpoint `/api/unnichat/login-link`:** POST com `Authorization: Bearer UNNICHAT_API_TOKEN` e body `{ email }` retorna `{ login_url, expires_at }` com URL encurtada (`/l/{slug}`). Reutiliza token vigente se ainda válido (TTL 7d), senão cria novo. Helper `lib/one-click.ts` encapsula a lógica.
- **Caso de uso:** Unnichat precisa enviar mensagem fora do fluxo de compra (lembrete, reativação) — só tem o email do lead. Chama esse endpoint, recebe link pronto pra colar na mensagem.

**E-mails de boas-vindas em 2 níveis (`d78826c` + `ce1c59f` + `ad134b2`):**

- **Migration:** adiciona `users.welcome_email_sent_at` + `enrollments.welcome_email_sent_at`.
- **LEVEL 1 (1× na vida do aluno):** se `users.welcome_email_sent_at IS NULL` → envia `inviteEmailHtml` com senha `mudar123` + CTA pro auto-login. Cobre o 1º cadastro.
- **LEVEL 2 (1× por matrícula):** se `users.welcome_email_sent_at` JÁ preenchido + `enrollments.welcome_email_sent_at IS NULL` → envia `newAccessEmailHtml` (template novo) avisando "Novo acesso liberado: <nome da turma>" sem senha.
- **Reprocessamento de venda já avisada não envia nada** (idempotência via lock atômico — `UPDATE WHERE coluna IS NULL`, se afetou 0 linhas alguém já enviou).
- **Endpoint POST `/api/admin/send-pending-welcome-emails`:** dispara em lote pros alunos cadastrados ANTES desse fix (50 por chamada). Mesmo lock atômico, idempotente em paralelo.

**Middleware (`52853fa`) + Bearer (`da8f2c7`):**
- Middleware bypassa redirect de login pra requests com `Authorization: Bearer` (cron jobs + webhooks externos não devem cair em `/login`).
- Endpoint de backfill aceita `Bearer CRON_SECRET` em vez de cookie de sessão (Vercel cron consegue chamar).

**Migrations aplicadas:** `purchase_events`, `auto_enrollment_setting`, `products_mapping`, `users_welcome_email_sent_at`, `enrollments_welcome_email_sent_at`

**Arquivos novos:**
- `src/lib/auto-enroll.ts`, `src/lib/one-click.ts`
- `src/app/api/unnichat/login-link/route.ts`
- `src/app/api/webhooks/kiwify-direct/route.ts`
- `src/app/api/admin/send-pending-welcome-emails/route.ts`
- `src/app/auto-login/page.tsx`
- `src/app/(admin)/admin/products-mapping/page.tsx` + actions

### Etapa 29 — Monitorias auto-status + calendário + deeplink Zoom (2026-05-04)

**Por que:** Zoom Web SDK Component View é frágil — bloqueio de cookies de terceiros (Brave/Safari), mobile quebrado (viewSizes fixos 1000×600), exige clique manual de "Iniciar". Pra alunos menos técnicos virou fonte constante de suporte. Decisão: **abandonar o embed**, usar deeplink universal pro app nativo do Zoom + automatizar o ciclo de vida da sessão.

**Mudanças:**

- **DB:** `live_sessions.duration_minutes INT NOT NULL DEFAULT 90` + `live_notified_at TIMESTAMPTZ` + `successor_created_at TIMESTAMPTZ` (índice parcial pros pendentes de notificação).

- **Status agora é DERIVADO** do tempo real via `computeLiveStatus(scheduled_at, duration_minutes, status)` em `src/lib/live-sessions.ts`:
  - `cancelled` (override absoluto do DB)
  - `scheduled` (antes do início, com buffer de 5min pré-início pra contar como "live")
  - `live` (entre início e início+duração)
  - `ended` (depois)

- **Removido:** botões "Iniciar agora" / "Encerrar". `startLiveSessionAction` e `endLiveSessionAction` foram descontinuadas. Substituídas por `cancelLiveSessionAction` (override manual). Admin agora só agenda — sistema cuida do resto.

- **Cron novo `/api/cron/live-sessions-notify`** rodando a cada 5 min (vercel.json `*/5 * * * *`). Duas tarefas, ambas idempotentes:
  1. Quando sessão cruza scheduled_at e `live_notified_at IS NULL` → dispara push pra alunos das cohorts elegíveis com link `/monitorias/{id}` e marca `live_notified_at = now()`.
  2. Quando sessão termina (computado), tem recurrence != 'none' e `successor_created_at IS NULL` → cria a próxima ocorrência da série copiando título/descrição/zoom/cohorts e marca `successor_created_at = now()`.

- **Página do aluno `/monitorias/[id]`** reescrita: zero embed. Card grande dourado "Entrar no Zoom" → URL universal `zoom.us/j/{meetingNumber}?pwd={password}` que abre app desktop/mobile via custom protocol; cai no webclient como fallback. Status badge calculado em tempo real.

- **Página `/monitorias`** virou calendário mensal (`MonitoriaCalendar` em `src/components/student/`). Mostra todas as sessões dos próximos 90 dias + 60 passados em grid de meses, com cores por status. Aluno navega meses, click no item → detalhe. Abaixo tem seção "Próximas" + card AO VIVO (se houver) com CTA direto pro Zoom.

- **Form admin** ganhou input "Duração (min)" (15–480, default 90). Horário previsto agora é obrigatório (status depende dele). Texto explicativo atualizado: "Status vira AO VIVO automaticamente neste horário".

- **Deletado:** `src/components/student/zoom-embed-player.tsx`, `src/app/api/zoom/signature/route.ts`, dir `/api/zoom/`. O package `@zoom/meetingsdk` continua no package.json mas não é mais carregado — pode remover depois pra reduzir bundle.

### Etapa 28.5 — Frame unlock + busca alunos + email Kiwify único (2026-05-03)

**3 melhorias entregues juntas:**

**A. Conquistas que desbloqueiam frame de avatar**
- Migration: `membros.achievements.unlocks_decoration_id UUID REFERENCES membros.avatar_decorations(id)`
  - Auto-link das 3 conquistas de venda (`sales_kiwify_1`, `sales_kiwify_10`, `sales_kiwify_50`) com as decorações `sales_1/10/50`
- Admin pode marcar manualmente quaisquer outras conquistas como "trocas de frame" via novo botão "Frame" em `/admin/achievements` — dropdown lista as decorações disponíveis, permite vincular/desvincular
- Action `setAchievementDecorationAction({achievementId, decorationId})` em `admin/achievements/actions.ts`
- `AchievementCelebrationModal` agora renderiza:
  - **Quando tem `decorationImageUrl`:** componente `FrameBadge` que compõe avatar real do user (circular) + frame em PNG por cima → header label muda pra "Novo frame desbloqueado — {decoração}"
  - Realtime listener faz JOIN em `avatar_decorations(name, image_url)` + busca avatar do user em `membros.users` antes de disparar o modal
- `shareAchievementAction` (post na `/community/resultados`) também usa avatar+frame composição quando a conquista linka decoração
- Item "Conquistas" movido da sidebar admin (Análise → Sistema)

**B. Busca de alunos pra atribuir venda órfã**
- Antes: o admin só podia colar email exato pra atribuir uma venda Kiwify órfã, sem feedback
- Agora: novo botão "Atribuir" abre modal com input que faz busca debounced (300ms) por nome **ou** email
- Action `searchStudentsAction(query)` em `affiliates/actions.ts`:
  - Mín. 2 caracteres, escapa `%`/`_`, ilike em `full_name` ou `email`, limita a 12 resultados
  - Inclui `role=student` E `role=ficticio`, retorna avatar pra UI
- `AttachOrphanButton` reescrito completo: input com loading spinner, lista de resultados com avatar+nome+email (badge "Fictício" pros perfis fictícios), card de selecionado com botão pra trocar, validação antes de confirmar

**C. Validação email Kiwify único no afiliado**
- Em `linkKiwifyAffiliateAction` (profile/affiliate-actions.ts), pré-check antes de INSERT/UPDATE: busca `affiliate_links` com `kiwify_email ilike $email AND member_user_id != $userId`
- Se outro aluno já vinculou aquele email, retorna erro: "Esse e-mail Kiwify já está vinculado a outro aluno. Se for um engano, fala com o suporte."
- Defesa em profundidade: índice UNIQUE `affiliate_links_unique_email_idx` em `(source, lower(kiwify_email))` continua sendo o último guard; o catch do erro também redireciona pra mesma mensagem amigável caso a corrida vença o pré-check

### Etapa 28.4 — Excluir aluno + fix favicon + popup broadcast (2026-05-03)

**3 melhorias entregues juntas:**

**A. Excluir aluno** (botão definitivo em `/admin/students/[id]`)
- Action `deleteStudentAction(id)` em `students/actions.ts`:
  - Bloqueia: admin não pode deletar a si mesmo, não permite deletar admin/moderator
  - Usa `auth.admin.deleteUser` — CASCADE limpa `membros.users` (FK), enrollments, lesson_progress, achievements, posts, etc
- Componente `DeleteStudentButton` com confirmação dupla:
  - Modal com lista do que vai ser apagado
  - Aluno precisa digitar o e-mail exato pra liberar o botão
- Renderizado em "Zona de perigo" no fim de `/admin/students/[id]`, só pra `role=student/ficticio`

**B. Fix orientação favicon (5:7 → 1:1)**
- `cover-upload.tsx` tinha texto hardcoded "proporção 5:7" mesmo quando o uso era quadrado (favicon 512×512)
- Adicionada função `ratioLabel(w, h)` que calcula proporção dinamicamente via GCD: `1:1, quadrada` quando w=h, senão `${w/g}:${h/g}` (ex: `5:7`, `16:9`, `4:3`)

**C. Popup grande como 4º canal de broadcast** (próximo acesso, 1× por aluno)
- Migration: `push_broadcasts.deliver_popup BOOLEAN` + `image_url TEXT`. Tabela `broadcast_popup_seen(user_id, broadcast_id, seen_at)` PK composta com RLS própria
- `BroadcastForm` ganhou 4ª coluna "Popup grande" + campo de URL de imagem opcional (renderiza no topo do modal full-screen)
- `sendBroadcast` em `lib/push.ts` aceita `deliverPopup` + `popupImageUrl`, persiste em `push_broadcasts`
- `getNextPopupForUser(userId)` busca o próximo broadcast com `deliver_popup=true` que o user é elegível e ainda não viu (FIFO por created_at)
- `<BroadcastPopupGate>` (server component no student layout) busca o popup pendente e renderiza `<BroadcastPopup>` (client) quando há
- Modal full-screen: imagem (max 50vh) + título + body + CTA opcional (link + linkLabel) + botão fechar. Click em fechar/CTA chama `markBroadcastPopupSeenAction` que insere em `broadcast_popup_seen`
- Aparece **uma vez** no próximo acesso de cada aluno elegível; depois nunca mais

### Etapa 28.3 — Imagem custom por conquista + preview admin (2026-05-03)

**Commit:** `0daac52`

**Schema:** coluna `celebration_image_url TEXT` em `membros.achievements`. Bucket `achievement-images` (público, 5MB max, jpg/png/webp). Policies: admin escreve via `membros.is_admin()`, leitura pública.

**Actions** (`/admin/achievements/actions.ts`):
- `uploadAchievementImageAction(achievementId, formData)` — upload pra `achievement-images/{id}/{uuid}.{ext}` + atualiza coluna
- `clearAchievementImageAction(achievementId)` — volta pra null (usa emoji default)

**Refator `AchievementCelebrationModal`:**
- Tipo `CelebratableAchievement` ganhou `imageUrl?: string | null`
- Quando setado, renderiza `<img>` 192–224px quadrada com border-radius em vez do badge gradient gold
- Preview do card de share também usa imagem
- Nova prop `previewMode`: esconde "Compartilhar" + faixa "Pré-visualização (admin)" no topo
- Componente exportado pra reuso fora do listener

**Listener** passa `celebration_image_url` ao buscar achievement no Realtime.

**`shareAchievementAction`** (post em `/community/resultados`): HTML usa `<img>` 200×200 quando tem custom; senão mantém o emoji em gradient.

**UI admin** (`/admin/achievements`):
- Mostra imagem custom (thumb 9×9) em vez do emoji se houver
- 4 botões inline por conquista: **Celebra** (toggle) · **Compartilha** (toggle) · **Imagem** (abre dialog, fica dourado se já tem) · **Preview** (abre modal completo com confetti em modo preview)

**`AchievementImageDialog` (novo):** layout 2 colunas
- Esquerda: orientação de tamanho (quadrada 1:1, 800-1200px ideal, JPG/PNG/WebP, 5MB) + botão upload com preview imediato via `URL.createObjectURL` + botão remover
- Direita: preview ao vivo do template como vai aparecer pro aluno (sem confetti — confetti só no botão "Preview" da row)

### Etapa 28.2 — Fix one-click hash callback + link encurtado (2026-05-03)

**Commit:** `b8e7e04`

**Bug:** o magic link gerado por `auth.admin.generateLink({type:'magiclink'})` usa o **fluxo IMPLICIT** do Supabase — devolve tokens no `#hash` da URL. Mas o nosso `/auth/callback` server-side só sabe ler `?code=` (PKCE). Resultado: aluno caía em `/login#access_token=...` sem sessão criada.

**Fix do callback:**
- Nova página client-only `/auth/hash-callback` (`src/app/auth/hash-callback/page.tsx`) com `<Suspense>` (pro `useSearchParams`)
- Lê `window.location.hash`, extrai `access_token` + `refresh_token`, chama `supabase.auth.setSession({...})`. Cookies setados via `@supabase/ssr`. Redireciona pro `next` (default `/dashboard`)
- `/api/auth/one-click` agora usa `redirectTo: /auth/hash-callback?next=...` em vez de `/auth/callback`
- Middleware libera `/auth/hash-callback` em `isPublicAuthRoute` (mesmo pra user logado, pra rodar o JS antes de redirecionar)

**Encurtador:**
- Nova função `buildShortOneClickUrl(token)` em `lib/one-click.ts` — usa `getOrCreateShortLink` existente, retorna `/l/{slug}` (silent fallback pra URL longa se encurtador falhar)
- Webhook `/api/webhooks/enrollment` + `/admin/one-click-test` agora usam a versão encurtada
- Payload do webhook (`one_click_login_url`) fica bonito no WhatsApp via Unnichat
- Middleware libera `/l/` como rota pública (link chega antes da sessão)

### Etapa 28.1 — Top loader bar (2026-05-03)

**Commit:** `3cf453e` — `nextjs-toploader` instalado e plugado no root layout. Linha branca de 2px no topo da tela durante navegações client-side (clicks em `<Link>`). Sem spinner, com glow sutil, easing 300ms. Feedback visual pra esconder latência percebida em transições.

### Etapa 28 — One-click login + Welcome popup por curso + Celebração de conquistas (2026-05-03)

**Commit:** `871a528` (3 melhorias entregues juntas)

#### A. One-click login (via WhatsApp/Unnichat)

**Schema:** `membros.magic_login_tokens` (token UUID PK, user_id, expires_at default 7d, last_used_at, source). RLS bloqueia tudo exceto `service_role`. Coluna `needs_onboarding` em `membros.users` força tela `/onboarding` na 1ª sessão pós-token.

**Lib `src/lib/one-click.ts`:**
- `generateMagicToken(userId, source)` — idempotente, reaproveita token válido se existir
- `validateMagicToken(token)` — devolve user_id ou null, atualiza `last_used_at`, deleta expirados
- `markUserNeedsOnboarding(userId)` — flag (idempotente)
- `buildOneClickUrl(token)` — usa `NEXT_PUBLIC_APP_URL`

**Endpoint `GET /api/auth/one-click?token=UUID&next=...`:**
1. Valida token via `validateMagicToken`
2. Pega email do user via `auth.admin.getUserById`
3. Decide destino: se `needs_onboarding=true` → `/onboarding?next=...`, senão usa `next` (default `/dashboard`)
4. Gera magic link nativo Supabase (`auth.admin.generateLink type=magiclink`) com `redirectTo` = `/auth/callback?next=...`
5. Redireciona pro `action_link` (cookies setados pelo callback)

**Página `/onboarding`** (`src/app/(student)/onboarding/`):
- Carrega profile + flag, redireciona se já passou
- Form com avatar (overlay câmera + upload bucket `avatars`), nome, e-mail readonly, fieldset opcional de "nova senha + confirmação" (mín 6 chars)
- Botão "Concluir" + "Pular essa etapa" (apenas marca flag=false)
- Actions: `completeOnboardingAction` + `uploadOnboardingAvatarAction`

**Webhook `/api/webhooks/enrollment` estendido:**
- Sempre gera `one_click_login_url` (user novo OU existente) e retorna no JSON de sucesso
- User novo ganha `needs_onboarding=true` automaticamente
- Unnichat consome esse campo e envia o link no WhatsApp

**Página admin de teste:** `/admin/one-click-test` (link na sidebar Sistema → "One-Click (teste)")
- Form: e-mail + nome opcional + checkbox "Forçar onboarding"
- Cria user fictício (role=`ficticio`) se e-mail não existe
- Mostra link gerado com botão Copiar + Abrir
- Doc embutida explicando o fluxo prod (5 passos)

**Middleware:** liberado `/api/auth/one-click` em `isPublicApi`.

#### B. Welcome popup POR CURSO

**Schema:** 6 colunas em `membros.courses` (`welcome_popup_enabled`, `_title`, `_description`, `_video_id`, `_terms`, `_button_label`). Tabela `membros.course_welcome_accepted (user_id, course_id) PK composta` com RLS própria (aluno lê/insere os próprios).

**Componente `CourseWelcomeModal`** (`src/components/student/course-welcome-modal.tsx`):
- Similar ao `WelcomeModal` global, mas chama `acceptCourseWelcomeAction(courseId)`
- Termos opcionais — quando vazios, esconde checkbox e habilita botão direto
- Layout: header gold + vídeo opcional + scroll de termos + checkbox + CTA

**Form admin de curso** (`course-form.tsx`) ganhou fieldset "Pop-up de boas-vindas (1ª vez no curso)" com 6 campos. Actions create/update extendidas pra persistir.

**`/courses/[courseId]` page:** SELECT estendido. Renderiza `CourseWelcomeModal` quando `welcome_popup_enabled=true && !accepted`.

#### C. Popup de conquista desbloqueada + compartilhamento na comunidade

**Schema:** colunas `celebrate` + `shareable` em `membros.achievements`. Migration marcou todas as `sales_count` e `sales_value` como `celebrate=true, shareable=true`. Inseriu 5 conquistas de comissão que faltavam: R$ 2k (200000 cents), R$ 25k, R$ 150k, R$ 200k, R$ 250k. Junto com as existentes (R$ 100, 500, 1k, 5k, 10k, 50k, 100k, 500k, 1M), agora cobre toda a faixa que Felipe pediu.

**Listener Realtime** `AchievementCelebrationListener` (`src/components/student/achievement-celebration.tsx`):
- Plugado no student layout (só se `gamificationEnabled`)
- Subscribe `postgres_changes INSERT` em `membros.user_achievements` filtrado por `user_id`
- Quando dispara, busca achievement; se `celebrate=true`, enfileira pra mostrar
- Modal full-screen com **canvas-confetti** (boom inicial 100 partículas + chuva de 3s lateral, cores dourado/branco)
- Badge gigante 128px com gradient gold + animação `zoom-in`
- Botão "Compartilhar nos resultados" (só se `shareable=true`) + "Fechar"

**Modo compartilhamento:**
- Preview do card (igual o que vai pra comunidade)
- Textarea opcional (max 500 chars) pra mensagem do aluno
- Botão publica via `shareAchievementAction`

**`shareAchievementAction`** (`src/app/(student)/achievements/actions.ts`):
- Valida: aluno tem a conquista, `shareable=true`, `userHasCommunityAccess`, página `/community/resultados` existe e ativa
- Cria post auto-aprovado em `community_topics` com HTML estilizado (badge centralizado, gradient gold, nome+descrição) + texto sanitizado do user
- `status='approved'`, `approved_by=user.id`, `approved_at=now()`
- Redireciona pro `/community/resultados/post/{id}` após sucesso

**UI admin:** `/admin/achievements` (link na sidebar Análises → "Conquistas")
- Lista todas agrupadas por categoria (Primeira vez / Streak / Volume / Comunidade / Vendas qtd / Vendas R$)
- Cada linha tem 2 toggles inline (Celebra + Compartilha) com optimistic update
- Action `setAchievementFlagsAction(achievementId, celebrate?, shareable?)`

**INSTALADO:** `canvas-confetti` + `@types/canvas-confetti`

**Pré-requisito operacional:** admin precisa criar uma página `community_pages` com slug `resultados` em `/admin/community/spaces` antes de qualquer aluno conseguir compartilhar conquista.

### Etapa 27 — Encurtador de URLs + Player YouTube limpo + Lesson mobile fixes (2026-05-03)

**Commits:** `da4dc3d` (lesson mobile), `8de4ac0` (encurtador + player)

Sequência de polimentos centrada na experiência do aluno na página de aula
e na criação de uma feature reutilizável (encurtador) que vai além da
descrição da aula.

**1. Player YouTube — esconde título/canal/watermark**
- YouTube ignora `showinfo=0` desde 2018 e não dá pra esconder título/canal
  via parâmetro. Solução: 2 overlays CSS por cima do iframe.
- Top mask `h-14` cobre faixa onde YouTube renderiza título + nome do canal
  quando pausado/loading. `pointer-events-none` (clique do botão play passa).
  Toggle via `onStateChange`: states 1 (playing) e 3 (buffering) escondem
  o overlay com `transition-opacity duration-300`. Outros estados mostram.
- Bottom-right mask `h-7 w-20` permanente cobre o watermark "▶ YouTube"
  que `modestbranding=1` não remove. Posicionado pra não invadir botões
  de configuração/fullscreen.

**2. Encurtador de URLs (`membros.short_links`)**
- Migration `short_links`:
  - Tabela: `slug TEXT PK`, `target_url TEXT`, `created_by UUID FK users`,
    `click_count INT DEFAULT 0`, `created_at TIMESTAMPTZ`
  - Index hash em `target_url` (idempotência por URL)
  - RLS: só admin/moderator gerencia. GRANT SELECT/INSERT/UPDATE/DELETE
    pra `authenticated` (a policy filtra)
  - RPC `incr_short_link_click(p_slug)` SECURITY DEFINER pro endpoint
    incrementar contador sem precisar permissão
- `lib/short-links.ts`:
  - `getOrCreateShortLink(url, userId)`: idempotente — mesma URL sempre
    devolve o mesmo slug. Slug 6 chars base62, retry com slug maior se
    colidir (até 6 tentativas).
  - `autoShortenHtml(html, userId)`: regex `<a href="...">text</a>`,
    URLs `>= 40 chars` viram `/l/{slug}`. Preserva texto custom do admin
    mas reescreve quando texto === href (autolink do Tiptap).
- Rota `/l/[slug]/route.ts`: lookup + 302 redirect + RPC counter em
  background (fire-and-forget, não trava o redirect). Slug inválido cai
  em `/dashboard` em vez de 404.
- Hook em `updateLessonAction`: chama `autoShortenHtml(rawDescription)`
  antes de salvar `description_html`. Falha silenciosa (não bloqueia save).
- Admin page `/admin/links`:
  - Form de criar manual (validação http/https + max 4000 chars)
  - Tabela com slug, destino truncado, contador de cliques, ações
    copiar/abrir/apagar
  - Empty state explica que "edição de aula encurta sozinho"
- Sidebar admin ganhou item "Encurtador" (ícone Link2) no grupo Sistema.

**3. Lesson page mobile — fix overflow horizontal**
- Sintoma: aula com URL gigante no description (ex: `wa.me/...?text=...`)
  estourava o card e jogava todo conteúdo pra direita no mobile.
- Fixes:
  - `LessonTabs`: tab "Anexos" só renderiza quando `attachments.length > 0`
  - Tabs row vira scroll horizontal no mobile (`overflow-x-auto`,
    scrollbar oculta) com `flex-shrink-0 whitespace-nowrap` em cada
    botão pra não quebrar texto
  - `DescriptionTab`: `[overflow-wrap:anywhere]` + `[&_a]:break-all` no
    container do prose — URLs longas agora quebram
  - Page `lessons/[lessonId]`: grid passa de `1fr` pra `minmax(0,1fr)`,
    item interno ganha `min-w-0`. Card tabs com `p-4 md:p-6` +
    `overflow-hidden` de segurança
- O encurtador resolve o root cause (URLs ficam curtas), mas o break-all
  é safety net pra URLs já existentes ou novas que escapem do auto-shorten.

**Migrations aplicadas:** `short_links` (cria tabela + RLS + RPC).

**Arquivos novos:**
- `src/lib/short-links.ts`
- `src/app/l/[slug]/route.ts`
- `src/app/(admin)/admin/links/page.tsx`
- `src/app/(admin)/admin/links/actions.ts`
- `src/components/admin/short-link-create-form.tsx`
- `src/components/admin/short-links-table.tsx`

### Etapa 26.1 — Polimentos broadcast banner + Favicon custom + PWA install fix (2026-05-03)

**Commit:** `feeb7d4`

Sessão de polimentos pós-Etapa 26 baseada em feedback de uso real.

**1. Banner broadcast — fix do X dispensar**
- Sintoma: clicar X no banner não removia (continuava aparecendo no refresh)
- Causa raiz: tabela `membros.user_dismissed_broadcasts` tinha RLS ligado
  mas **zero policies** + faltava `GRANT UPDATE` (upsert exige UPDATE).
  Tinha INSERT/SELECT/DELETE só.
- Fix migration `user_dismissed_broadcasts_rls_fix`:
  - 4 policies (SELECT/INSERT/UPDATE/DELETE) filtradas por
    `auth.uid() = user_id`
  - GRANT UPDATE pra `authenticated`

**2. Banner broadcast — visual mais grosso + CTA button**
- Card desktop: `py-4` mais grosso, margem lateral `md:px-6`, cantos
  `md:rounded-2xl` (mesmo padrão do resto do app), gap-2 entre banners
  empilhados
- Ícone megafone num círculo dourado de fundo (visual "bubble", não solto)
- Mobile: continua edge-to-edge slim, `py-3`
- Coluna nova no admin: **"Texto do botão"** (max 30 chars, disabled
  quando link vazio). Quando link preenchido + label preenchido → renderiza
  pill dourado no canto direito com seta `→`. Sem label mas com link →
  botão usa default "Saiba mais". Mobile esconde botão mas área inteira
  vira clicável (`<Link>` envolve título+body)
- Migration `broadcast_link_label`: adiciona coluna `link_label TEXT` em
  `push_broadcasts`

**3. Favicon customizável (inclusive notificação Chrome)**
- Sintoma: favicon era SVG estático em `/pwa-icon.svg`, sem opção de
  customizar. Ícone das push notifications no Chrome/Android usava o
  mesmo SVG default.
- Novo setting `platform_favicon_url` (separado do `platform_logo_url` —
  logo é horizontal, favicon é quadrado 512×512)
- Endpoints `/icons/pwa-{192,512}.png`:
  - Marcados `runtime: nodejs` + `dynamic: force-dynamic`
  - Quando admin setou `platform_favicon_url`: redirect 302 pra essa URL
  - Senão: gera default gold "A" via `next/og` ImageResponse
  - Cache 5min browser / 1h edge
- SW `/sw.js` troca defaults de `/pwa-icon.svg` pra `/icons/pwa-192.png`
  → ícone das push notifications passa a refletir o favicon custom
  automaticamente. VERSION bumped pra `v3-favicon`
- Layout root `metadata.icons` aponta pra `/icons/pwa-192.png`
- **Removido** `src/app/favicon.ico` estático (Next.js servia automático
  como `<link rel="icon">` e sobreporia o dinâmico)
- Form admin `platform-settings-form.tsx` ganhou seção "Favicon / Ícone
  do app" com `<CoverUpload>` separado do logo

**4. PWA install button no Android Chrome**
- Sintoma: botão "Instalar aplicativo" sumia após 3s no mobile
- Causa: timeout `setTimeout(..., 3000)` marcava como `unsupported` se
  `beforeinstallprompt` não tivesse disparado. Chrome Android exige
  engagement (~30s + visita prévia) e pode demorar bem mais
- Fix:
  - Detecta plataforma (Android vs Desktop)
  - Após 1.5s sem evento, marca como `android-manual` ou `desktop-manual`
    (não esconde o botão)
  - Click abre modal com instruções: "menu Chrome ⋮ → Instalar app"
  - Funciona como fallback universal — usuário sempre tem um caminho
    pra instalar, mesmo que o browser não dispare o evento

**Migrations aplicadas:** `user_dismissed_broadcasts_rls_fix`, `broadcast_link_label`

### Etapa 26 — Broadcast com 3 canais (Push / In-app / Barra fixa) (2026-05-03)

Estende o sistema de broadcast da Etapa 22 com **barra fixa no topo das
telas** como 3º canal de delivery, independente.

**Schema (migration `broadcast_banner_channel`):**
- `push_broadcasts` ganha `deliver_push`, `deliver_inapp`, `deliver_banner`
  (booleans), `banner_expires_at` (timestamptz opcional)
- Nova tabela `user_dismissed_broadcasts(user_id, broadcast_id, dismissed_at)`
  PK composta — quando aluno dispensa o banner, vira row aqui
- RLS: aluno só lê/escreve as próprias linhas (auth.uid() = user_id)
- GRANT SELECT/INSERT/DELETE pra `authenticated`

**Backend (`lib/push.ts`):**
- `sendBroadcast` aceita `deliverPush/deliverInapp/deliverBanner` +
  `bannerExpiresAt`. Validação: pelo menos 1 canal obrigatório
- Push e in-app só disparam se canal correspondente está `true`. Banner é
  só "criar a row" — page-loads do aluno consultam ativos
- Novo helper `getActiveBannersForUser(userId)`:
  - Filtra broadcasts com `deliver_banner=true` E `banner_expires_at IS
    NULL OR > now()` E user NÃO dispensou
  - Resolve audiência via `resolveBroadcastAudience(audience)` — aluno
    só vê banners destinados ao perfil dele
  - Retorna até 20 mais recentes

**Server action aluno (`(student)/broadcasts/actions.ts`):**
- `dismissBroadcastBannerAction(broadcastId)`: insere row em
  `user_dismissed_broadcasts` (idempotente via UPSERT). Revalida layout
  pra remover o banner em todas as páginas.

**UI aluno:**
- `<BroadcastBanners userId={user.id}>` (server component) carrega
  banners ativos via helper e renderiza um por linha no topo do main do
  `(student)/layout.tsx`
- Cada banner: ícone megafone + título + body + botão X
- Se `link` setado, título vira `<Link>` clicável
- `<DismissBannerButton>` (client) faz optimistic hide + chama action
- Visual: gradiente dourado horizontal, borda inferior, sticky depois
  do topbar

**Form admin atualizado (`components/admin/broadcast-form.tsx`):**
- Nova seção "Enviar via" com 3 toggles `<ChannelToggle>`:
  - Push notification (default ON)
  - In-app (sino) (default ON)
  - Barra fixa nas telas (default OFF)
- Quando "Barra fixa" marcado, expande input opcional "Barra expira em"
  (datetime-local BRT). Vazio = só some quando aluno dispensar.
- Action `sendBroadcastAction` lê os 3 toggles + parsea data como BRT
  (mesmo padrão dos outros forms)
- Validação: pelo menos 1 canal selecionado

**Casos de uso:**
- Lembrete urgente — só barra fixa: aluno vê quando entra na plataforma
  (não recebe push intrusivo)
- Live agora — todos os 3: push pro celular, sino, e barra pra quem
  abrir depois
- Aviso permanente — barra fixa sem `expires_at`: fica até cada aluno
  dispensar individualmente

**Migrations aplicadas:** `broadcast_banner_channel`

**Arquivos novos:**
- `src/app/(student)/broadcasts/actions.ts`
- `src/components/student/broadcast-banners.tsx`
- `src/components/student/dismiss-banner-button.tsx`

### Etapa 25 — 5 ajustes UX (2026-05-03)

Bateria de polimentos baseados em uso real.

**1. Profile mobile — Conquistas pro fim**
- `(student)/profile/page.tsx`: container virou `flex flex-col` em vez de
  `space-y` puro
- `<GamificationSection>` envelopado em `<div className="order-last
  md:order-none">` — no mobile vai pro fim, em desktop mantém a
  ordem original (logo após o profile)
- Justificativa: conquistas tomam muito espaço vertical — empurrava
  decoração/afiliado/push pra rolagem profunda no mobile

**2. PWA install no Chrome Android — fix dos ícones PNG**
- Causa: Chrome Android **rejeita SVG como ícone PWA** pra qualificar
  como "instalável" (iOS e Desktop toleram). Manifest tava só com
  `pwa-icon.svg` no fallback.
- Fix: 2 endpoints novos `/icons/pwa-192.png` e `/icons/pwa-512.png`
  via `next/og` ImageResponse (escudo dourado com "A", `runtime: edge`)
- `manifest.webmanifest/route.ts` agora:
  - Se admin setou logo customizada **PNG/JPEG/WebP**: usa ela
  - Se setou SVG OU não setou: usa nossos endpoints PNG dinâmicos
- Removido entry de SVG do manifest — só PNGs

**3. Comunidade mobile — barra integrada à topbar**
- Antes: 2 barras empilhadas no mobile (Topbar do student + CommunityMobileBar)
- Agora: a comunidade injeta o "Comunidade · Feed" + hamburger DENTRO da
  Topbar via portal client-side. UI fica em **uma única faixa de altura**.
- Implementação:
  - `<Topbar>` renderiza `<div id="topbar-mobile-slot" className="md:hidden flex flex-1" />`
  - Novo helper [`<TopbarMobileSlot>`](src/components/topbar-mobile-slot.tsx)
    portala children pra esse div via `createPortal`
  - `CommunityMobileBar` reescrito pra usar o helper — visual fica
    embebido na Topbar
  - `StudentMobileNav` continua com lógica antiga (esconde quando em
    /community pra não duplicar hamburger)
- SSR: portal só monta após client mount (1 frame de delay aceitável,
  só visível em rota que precisa do portal)

**4. PostCard — thumb da 1ª imagem do conteúdo**
- Antes: descrição curta era só preview de texto puro (`stripHtml().slice(240)`)
- Agora: extrai a 1ª `<img src="">` do `contentHtml` via regex e mostra
  como thumb 80×80 ao lado do preview de texto (estilo Twitter/Instagram)
- Helper `extractFirstImage(html)` em [post-card.tsx](src/components/community/post-card.tsx)
- Layout: `flex items-start gap-3` — texto à esquerda, thumb à direita.
  Sem thumb: texto ocupa 100%

**5. Comentários — alinhamento estilo Twitter**
- Antes: avatar (28px) à esquerda + bloco com **fundo cinza** que continha
  título + tempo + conteúdo. Avatar parecia "desencaixado" do título.
- Agora: avatar (32px) na MESMA linha do título, **sem card cinza**:
  - Linha 1: avatar + nome + level badge + tempo
  - Linha 2: conteúdo do comentário (texto direto, sem container colorido)
  - Linha 3: like + responder
- Igual layout do Twitter/X — bem mais "limpo", densidade de leitura
  melhor

**Migrations aplicadas:** nenhuma nesta etapa.

**Arquivos novos:**
- `src/app/icons/pwa-192.png/route.tsx` (ImageResponse PWA icon)
- `src/app/icons/pwa-512.png/route.tsx` (ImageResponse PWA icon)
- `src/components/topbar-mobile-slot.tsx` (portal client pra slot da topbar)

### Etapa 24.2 — Combobox de turmas + ritmo recorrência + decoração no topbar/profile (2026-05-03)

Pequeno follow-up à Etapa 24.1 com 4 ajustes pedidos pelo Felipe.

**1. `<CohortMultiSelect>` com busca (substitui checkboxes)**
- Componente novo em `src/components/admin/cohort-multi-select.tsx`
- Tags dos selecionados em cima (X pra remover) + dropdown com input de
  busca + lista filtrada conforme digita
- Busca **normalizada** (case-insensitive, sem acento) em `name` E em
  `hint` (cursos atrelados)
- Hidden inputs `<input type="hidden" name="cohort_ids" value={id}>` por
  selecionado — form serializa direitinho
- `/admin/live-sessions/page.tsx` agora carrega `cohort_courses` join com
  `courses` pra montar o `hint` de cada turma (ex: "Curso A · Curso B"
  abaixo do nome) — admin filtra por curso facilmente
- Escala bem com 50+ turmas (ao contrário das checkboxes anteriores)

**2. Recorrência mantém ritmo da semana**
- `nextOccurrence` agora tem **loop** que continua avançando enquanto a
  data calculada está no passado
- Resultado: se você criou monitoria pra "segunda 19h" e encerrou no
  domingo, a próxima vai ser na **segunda seguinte 19h** (não hoje à
  noite). Mantém o dia/hora original do "ritmo".
- Loop tem proteção (max 200 iterações) pra evitar loop infinito
- Cobre também o caso de admin encerrar várias semanas atrasado — sempre
  cai na próxima ocorrência futura

**3. Decoração de avatar no topbar e profile**
- `<UserDropdown>` (topbar) ganha prop `decorationUrl` opcional. Quando
  passada, renderiza `<img>` da decoração absoluta em volta do avatar
  (z-10, 48px sobre avatar de 34px)
- `(student)/layout.tsx` resolve `equippedDecorationUrl` do user logado
  via `equipped_decoration_id` + lookup em `avatar_decorations` (idêntico
  ao fluxo de community pages)
- `<AvatarUpload>` no profile ganha mesma prop. Renderiza decoração
  sobre o avatar grande (80px) com PNG de 112px (ratio 1.4x)
- `<ProfileForm>` propaga `decorationUrl` pra `AvatarUpload`
- `(student)/profile/page.tsx` resolve a URL durante o map de
  decorationOptions (zero query extra)
- Resultado: decoração aparece em 4 lugares agora — comunidade, topbar,
  modal "Mudar decoração" e foto do profile

**4. Push notification ao iniciar monitoria — já implementado (Etapa 24)**
- `startLiveSessionAction` chama `tryNotifyMany(userIds, { title: "🔴
  Monitoria ao vivo agora", body, link, pushCategory: "broadcast" })`
- Notif in-app + push mobile/desktop disparam pra TODOS os alunos das
  cohorts associadas (deduplica)
- Pra push aparecer: aluno precisa ter autorizado push (PushPermissionPrompt
  da Etapa 22) E VAPID env vars setadas no Vercel
- Categoria `broadcast` = sempre on (aluno não consegue desligar)

**Migrations:** nenhuma nesta etapa.

### Etapa 24.1 — Monitorias com múltiplas turmas + recorrência (2026-05-03)

Pequeno follow-up à Etapa 24 com 2 features pedidas pelo Felipe.

**1. Múltiplas turmas por monitoria (M:N)**
- Migration: criada `membros.live_session_cohorts(session_id, cohort_id)` PK
  composta. `live_sessions.cohort_id` (singular) foi DROPPED.
- RLS atualizado pra usar JOIN com a junção (aluno vê monitoria se tem
  matrícula ativa em **alguma** das turmas associadas).
- Form admin: substituiu `<select>` única por **checkboxes múltiplas** das
  turmas dentro de container scrollable.
- Listagem admin: cada monitoria mostra **um badge dourado por turma**
  associada.
- `startLiveSessionAction`: notifica push pra TODOS alunos de TODAS as
  cohorts associadas (deduplica por user).
- `signature endpoint`: valida acesso checando `IN (cohort_ids)` em vez
  de `eq cohort_id`.

**2. Recorrência (diária / semanal / quinzenal / mensal)**
- Migration: `live_sessions.recurrence text DEFAULT 'none' CHECK IN
  ('none','daily','weekly','biweekly','monthly')`
- Form admin ganha `<select>` "Repetir": Não / Diariamente / Semanalmente /
  Quinzenalmente / Mensalmente
- Listagem mostra badge azul "Diariamente / etc" quando aplicável
- `endLiveSessionAction` agora retorna `nextSessionId | null` — quando a
  monitoria encerrada tinha `recurrence != none` E `scheduled_at`
  preenchido, gera **automaticamente a próxima ocorrência** (mesmas
  cohorts via insert na junção, mesmo título/descrição/zoom, novo
  scheduled_at calculado por `nextOccurrence(date, recurrence)`)
- Helper `nextOccurrence`: daily=+1d, weekly=+7d, biweekly=+14d,
  monthly=+1mês (Date.setMonth cuida de meses curtos automático)

**Validação:** se admin marcar recorrência sem preencher horário, action
retorna erro pedindo o horário (necessário pra calcular próxima).

**Migration aplicada:** `live_sessions_multi_cohort_and_recurrence_v2`

### Etapa 24 — Monitorias ao vivo via Zoom Web SDK (2026-05-03)

Sistema de **lives Zoom embeddadas dentro da plataforma** — aluno entra com
câmera, microfone, levanta a mão, compartilha tela, sem sair pra Zoom. Liberação
manual: admin clica "Iniciar agora" e push notification dispara pra todos os
alunos da turma.

**Schema (migration `live_sessions_schema`):**
```
membros.live_sessions (
  id, cohort_id (FK), title, description,
  scheduled_at,                         -- só pra exibir "previsto pra 19h"
  zoom_meeting_id, zoom_password,       -- credenciais da reunião
  status: scheduled | live | ended | cancelled,
  started_at, ended_at,                 -- preenchidos pelos botões
  created_by, created_at, updated_at
)
```

**RLS:** aluno vê monitoria SE tem matrícula ativa na `cohort_id` (não
expirada). Admin/moderator veem tudo.

**Backend (`/api/zoom/signature`):**
- POST recebe `{ sessionId }`
- Valida user autenticado + sessão existe + status='live' + acesso à cohort
- Assina JWT (jsonwebtoken HS256) com `appKey` + `sdkKey` + `mn` + `role` +
  `iat`/`exp`/`tokenExp` (válido 2h)
- Aluno: `role=0` (attendee). Admin/moderator: `role=1` (host)
- Retorna tudo que o SDK precisa: `signature`, `sdkKey`, `meetingNumber`,
  `password`, `userName`, `userEmail`, `role`

**Server actions admin:** `createLiveSessionAction`, `updateLiveSessionAction`,
`startLiveSessionAction` (notifica push), `endLiveSessionAction`,
`deleteLiveSessionAction`. Parser de `scheduled_at` interpreta o input
`datetime-local` como **BRT** (mesmo padrão do fix de timezone Kiwify da
Etapa 20.1).

**UI admin (`/admin/live-sessions`):**
- Form de criação inline (turma, título, descrição, horário, Meeting ID, senha)
- Lista agrupada: 🔴 Ao vivo / Agendadas / Encerradas (10 últimas)
- Cada linha: botões "Iniciar agora" (em scheduled) / "Abrir player" + "Encerrar"
  (em live) / Excluir
- Item "Monitorias ao vivo" na sidebar admin (grupo Sistema, ícone Radio)

**UI aluno (`/monitorias`):**
- Lista próximas e ao vivo (RLS filtra por matrícula automaticamente)
- Card vermelho destacado pra monitoria live → clica e abre o player
- Item "Monitorias ao vivo" na sidebar aluno (entre Comunidade e Notificações)

**Player (`/monitorias/[id]`):**
- 3 estados: scheduled (lobby aguardando), live (embed Zoom), ended/cancelled
- `<ZoomEmbedPlayer>` (client component): lazy-load do `@zoom/meetingsdk`,
  `ZoomMtgEmbedded.createClient()` + `init` Component View (video resizable
  + toolbar custom) + `join` com signature do backend
- Cleanup `leaveMeeting()` no unmount
- UI de erro orienta o aluno se browser bloquear cookies de terceiros

**Push notification:** ao iniciar, `tryNotifyMany` cria notif in-app +
dispara push pros alunos elegíveis (categoria `broadcast`, sempre ativa).

**Deps novas:**
- `@zoom/meetingsdk` (~3MB, lazy-loaded)
- `jsonwebtoken` + `@types/jsonwebtoken`

**Env vars (Felipe precisa setar no Vercel):**
- `NEXT_PUBLIC_ZOOM_SDK_KEY` — Client ID do app Zoom Marketplace
- `ZOOM_SDK_SECRET` — Client Secret (server-only)

**Setup do app Zoom (já feito):**
- App "General App" criado em marketplace.zoom.us → ativado feature **Embed →
  Meeting SDK** → credenciais `2DRMnNxoS4WL5jK9lxNOJw` (key) + secret
- "Domain Allow List" pode ser ignorada (é pra Zoom Apps client desktop, não
  Meeting SDK web embed)
- Aviso da Zoom sobre OBF/ZAK tokens (março 2026): NÃO afeta — nossas
  monitorias rodam na conta do próprio Felipe (ele é o host)

**Limitações conhecidas:**
- iOS Safari < 16: SDK não funciona — orientar aluno a usar Chrome/Edge
  ou instalar PWA (Etapa 21) primeiro
- Brave / Safari com bloqueio agressivo de 3rd-party cookies pode falhar
- Limite de participantes = limite do plano Zoom (Pro = 100)
- Felipe precisa abrir Zoom desktop separadamente pra ASSUMIR host de
  verdade (a plataforma só dá o embed; o admin role=1 do JWT permite host
  com restrição até ele entrar via Zoom desktop com ZAK)

**Como testar end-to-end:**
1. Felipe configura env vars no Vercel + redeploy
2. Cria reunião no Zoom (anota Meeting ID + senha)
3. Vai em /admin/live-sessions, cria monitoria pra uma turma com Meeting ID
4. Abre Zoom desktop e entra como host
5. Volta na plataforma, clica "Iniciar agora" → alunos da turma recebem push
6. Aluno entra em /monitorias → clica no card vermelho → embed carrega

### Etapa 23 — Decorações de avatar + Badges de nível + Admin sem XP (2026-05-03)

Sessão grande focada em **identidade visual** dos alunos na comunidade
(decorações estilo Discord + badges de nível estilo Twitter ✓), além de
limpar o admin do sistema de gamification e corrigir bugs descobertos.

**1. Bug fix — RLS notifications (GRANT faltando):**
- "Marcar todas como lidas" dava `permission denied for table notifications`
- Causa: na Etapa 19 criei policies UPDATE/DELETE mas role `authenticated`
  só tinha SELECT no GRANT. Postgres checa GRANT antes de RLS.
- Fix: migration `grant_notifications_update_delete_to_authenticated`

**2. Bug fix — Kiwify parser timezone (commit `eb91ca0`):**
- Kiwify envia timestamps SEM timezone (`"2026-05-03 10:11"`) → parser
  `new Date(s)` interpreta como UTC → vendas apareciam 3h antes do real
- Fix em `parseKiwifyDate`: append `-03:00` quando string não tem TZ.
  Detecta TZ explícito (`Z`, `+XX:XX`, `-XX:XX`) pra não duplicar.
- Migration `fix_kiwify_approved_at_timezone` corrigiu sales antigas
  (condicional: só atualiza quando `approved_at` salvo bate com a
  interpretação errada UTC)

**3. Sidebar admin — link "Anúncios" (commit `7dbca28`):**
- `/admin/notifications/broadcast` (criado na Etapa 22) só era acessível
  pelo card no `/admin/community`. Agora tem link direto na sidebar
  admin (grupo Conteúdo, ícone Megaphone)

**4. Admin sem gamification (commit `87cbf26`):**
- Profile page pula seção `<GamificationSection>` quando `role=admin`
- Topbar pula cálculo + render de `xpInfo` (badge XP/streak some)
- `tryAwardXp` checa role e skipa pra admin (defesa em profundidade)
- Migration `clear_admin_gamification_data` apagou XP/conquistas/user_xp
  existentes de todos admins
- Bonus: conquistas no mobile passam de `grid-cols-2` (apertado) pra
  `grid-cols-1` (uma coluna full-width). sm: 2 cols, lg: 3 cols.

**5. Sistema de decorações de avatar — estilo Discord (commit `7006841`):**

*Schema (2 migrations):*
- `membros.avatar_decorations` (code, name, image_url, required_sales,
  sort_order, is_active) com 4 marcos pré-criados: 1 / 10 / 50 / 100
  vendas pagas atribuídas (regra **secreta** pro aluno — só admin sabe)
- `users.equipped_decoration_id` (FK opcional, ON DELETE SET NULL)
- Bucket Storage `avatar-decorations` (público, 5MB max, png/webp/gif)
- RLS catálogo: SELECT pra authenticated quando `is_active=true`

*Lib (`src/lib/decorations.ts`):*
- `listActiveDecorations` / `countPaidSales`
- `evaluateAvatarDecorations(supabase, userId)` — descobre maior decoração
  que o aluno se qualifica e equipa automaticamente. Idempotente: não
  substitui se aluno trocou voluntariamente pra menor. Notifica push
  com categoria `achievement_unlocked`.

*Hook automático em 3 fluxos:*
- `processApproved` (webhook Kiwify) após cada venda paga atribuída
- `backfillOrphanSales` quando atribui em massa
- `addManualSaleAction` quando admin insere venda manual

*UI admin (`/admin/decorations`):*
- Item "Decorações" na sidebar (grupo Sistema)
- Lista os 4 slots: preview, nome editável inline, marco visível
  (requirement_sales), contagem de equipados, upload de PNG/WebP/GIF,
  toggle ativa/desativada
- Helpers: `uploadDecorationImageAction`, `updateDecorationNameAction`,
  `toggleDecorationActiveAction`

*UI aluno (`/profile`):*
- `<DecorationSection>` entre Gamification e Afiliado
- Avatar atual com decoração equipada + botão "Mudar"
- Modal: "Nenhuma" + opções desbloqueadas + bloqueadas (greyscale +
  🔒, **sem revelar quantas vendas precisa**)
- `equipDecorationAction` valida server-side antes de equipar
- Esconde a section inteira pra admin

*Componente `<DecoratedAvatar>`:*
- Server-friendly (img tags puras, sem hooks)
- Container relativo: avatar abaixo (z-0), decoração absoluta sobreposta
  (z-1, ~30% maior pra abraçar a borda do avatar)

*Aplicado em:*
- PostCard (todos os feeds da comunidade)
- Header do `/community/[slug]/post/[postId]`
- CommentItem (todos os comentários e replies, incluindo otimistas)
- DecorationSection (preview no perfil)

*Backfill aplicado:* migration equipou automaticamente quem já tinha
vendas pagas atribuídas com a decoração mais alta que se qualifica
(silenciosamente, sem notificação spam).

**6. Badges de nível ao lado do nome — estilo Twitter ✓ (commit `7b486ff`):**

*Assets:* 5 SVGs hexagonais em `public/imagens/levels/badge-mini-{1..5}.svg`
- I: cinza/slate (Recruta)
- II: verde (Estrategista)
- III: azul (Especialista)
- IV: roxo (Autoridade)
- V: dourado (Elite)

*Componente `<LevelBadge level={n} size={16} />`:* server-friendly,
title `"Nível X — Recruta/etc"` no hover.

*Hidratação centralizada (`src/lib/author-meta.ts`):*
- `fetchAuthorMeta(adminSb, userIds[])` retorna
  `Map<userId, { decorationUrl, level }>`
- `fetchSingleAuthorMeta` pra um único user
- Centralizou toda a lógica que estava duplicada nas 3 community pages
- Admin: força `level=null` (não mostra badge porque não tem XP)

*Renderização:*
- PostCard, post detail header, CommentItem (16px no post, 14px no comment)
- Comentários otimistas herdam `currentUserLevel` do user logado

**Migrations aplicadas:**
- `grant_notifications_update_delete_to_authenticated`
- `fix_kiwify_approved_at_timezone`
- `clear_admin_gamification_data`
- `avatar_decorations_schema`
- `avatar_decorations_storage_bucket`
- `backfill_equipped_decoration_for_existing_sellers`

**Arquivos novos:**
- `src/lib/decorations.ts`
- `src/lib/author-meta.ts`
- `src/components/decorated-avatar.tsx`
- `src/components/level-badge.tsx`
- `src/components/student/decoration-section.tsx`
- `src/components/admin/decoration-row-editor.tsx`
- `src/app/(admin)/admin/decorations/page.tsx` + `actions.ts`
- `src/app/(student)/decorations/actions.ts`
- `public/imagens/levels/badge-mini-{1..5}.svg`

**Pra Felipe agora:**
- Subir os 4 PNGs em `/admin/decorations` (recomendo 512×512, transparente,
  centro vazio, decoração nas bordas — mesmo estilo do Discord)
- Pode renomear os slots ("Iniciante" / "Consistente" / "Profissional"
  / "Elite" são placeholders)

### Etapa 22 — Push Notifications + Broadcast admin (sessão Maio 2026)

Notificações push nativas via Web Push API + sistema de broadcast manual
do admin pra avisar lives, anúncios, etc.

**Schema (migration `push_notifications_setup`):**
- `push_subscriptions(user_id, endpoint UNIQUE, keys_p256dh, keys_auth,
  user_agent, last_used_at)` — uma por dispositivo/browser
- `user_notification_prefs(user_id, category, push_enabled)` PK composta
  esparsa (default true se ausente)
- `push_broadcasts(id, sent_by, title, body, link, audience JSONB,
  recipients_count, delivered_count, failed_count)` — histórico

**Categorias** (em `lib/push.ts > PushCategory`):
- `community_comment` — comentário/like no meu post
- `community_reply` — resposta/like ao meu comentário
- `community_post_status` — meu post aprovado/rejeitado
- `achievement_unlocked` — conquista desbloqueada
- `lesson_drip` — nova aula liberada
- `kiwify_sale_attributed` — venda Kiwify atribuída
- `broadcast` — anúncios manuais admin (sempre on, user não desliga)

**Core (lib/push.ts):**
- `sendPushToUser({userId, category, payload})` — verifica setting global
  + preferência per-categoria, dispara pra todas as subs ativas, remove
  410 Gone
- `resolveBroadcastAudience(audience)` — filtra users elegíveis por
  roles + include_cohort_ids (TODAS precisam estar) + exclude_cohort_ids
  (NENHUMA pode estar)
- `sendBroadcast(...)` — itera audience em batches de 50, cria notif
  in-app + dispara push, atualiza contadores em push_broadcasts

**Service worker** (`public/sw.js` v2):
- listener `push` mostra notificação nativa (com tag pra evitar spam)
- listener `notificationclick` foca aba existente do app + navega, ou
  abre nova
- listener `pushsubscriptionchange` avisa client pra re-subscribe

**lib/push-client.ts** (helpers no browser):
- `requestPushPermissionAndSubscribe(vapidKey)` — pede permissão +
  subscribe + manda pro server
- `unsubscribeCurrentDevice()` — desfaz no browser + remove do server
- `pushPermissionState()` — retorna `granted | denied | default | unsupported`

**Integração:** `tryNotify` ganhou `pushCategory?: PushCategory`. Quando
passado, dispara push junto com in-app. Hooks plugados em todos os
triggers existentes (community approve/reject/comment/like, achievement
unlock, course publish + lesson create, drip cron, affiliates).

**UI aluno:**
- `PushPermissionPrompt` no student layout — modal flutuante no canto
  inferior direito. Aparece na 2ª sessão OU após 5min na 1ª (rastreio
  via localStorage). Se rejeitado, espera 7 dias antes de tentar de
  novo. Detecta `permission=denied` (browser bloqueou) e desiste.
- `PushSettingsSection` no `/profile` — entre Afiliado e Trocar Senha:
  status do dispositivo atual (ativar/desativar), lista dos últimos 5
  cadastrados (descrição user agent), checkboxes por categoria com
  update otimista. Broadcast não aparece (sempre on).

**UI admin:**
- `/admin/notifications/broadcast` — form com título (max 80 chars),
  body (max 200), link, perfis (admin/moderator/student/ficticio),
  filtro de cohorts em **3 estados** (neutral → include verde →
  exclude vermelho — clica pra alternar). Modal de confirmação com
  preview antes de enviar. Histórico dos últimos 20 com contagens.
- Card "Enviar anúncio" no `/admin/community` index aponta pra broadcast.

**Setting global:** `SETTINGS_KEYS.PUSH_NOTIFICATIONS_ENABLED` em
`lib/settings.ts` (default true) — kill switch admin.

**VAPID env vars** (necessárias em prod):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — exposta no client
- `VAPID_PRIVATE_KEY` — só server
- `VAPID_SUBJECT` — `mailto:suporte@felipesempe.com.br`
- Sem essas vars setadas, `sendPushToUser` faz silent-noop (app continua
  funcionando, push não envia)

**Compatibilidade:**
- Chrome/Edge desktop+Android: ✅ funciona com app aberto ou fechado
- iOS Safari 16.4+: ✅ **só** se aluno instalou PWA na home screen
- Firefox desktop: ✅
- Firefox iOS: ❌ não suporta push

**Lib instalada:** `web-push` + `@types/web-push`

### Etapa 21 — PWA instalável (sessão Maio 2026)

App pode ser instalado no desktop (Chrome/Edge/Brave) e mobile
(Android/iOS) como app standalone — vira ícone na home/Dock/Iniciar
sem barra de URL.

**Arquivos novos:**
- `public/pwa-icon.svg` — escudo dourado "A" 512x512 (fallback quando
  admin não setou logo customizada)
- `public/sw.js` — service worker mínimo (install/activate/fetch
  passthrough). Não cacheia nada — só existe pra qualificar como PWA
  pro Chrome disparar `beforeinstallprompt`
- `src/app/manifest.webmanifest/route.ts` — manifest dinâmico via route
  handler. Lê `platformName` + `platformLogoUrl` das settings em runtime;
  cache 5min browser + 1h edge. Quando admin troca logo/nome, app
  atualiza na próxima visita
- `src/components/pwa-install-button.tsx` — componente client com 4
  estados:
  - `loading` → renderiza nada por 3s aguardando evento
  - `installed` → "App instalado" verde com check (detecta
    `display-mode: standalone` ou `navigator.standalone` no iOS)
  - `promptable` → captura `beforeinstallprompt`, click chama
    `prompt.prompt()`. Atualiza estado em `appinstalled`
  - `ios` → click abre `IosInstructionsModal` (3 passos: Compartilhar
    → Adicionar à Tela de Início → Adicionar)
  - `unsupported` → renderiza nada (Firefox desktop, etc)

**Integração:**
- `StudentSidebar`: item "Instalar aplicativo" (ícone Download) entre
  Perfil e Suporte. PwaInstallButton substitui o Link quando renderiza
- Root `layout.tsx`: `generateMetadata` aponta `manifest`,
  `appleWebApp.capable=true`, `apple-touch-icon` (logo custom ou
  pwa-icon.svg); `viewport` com `themeColor: "#0d0d0d"` (preto)
- `lib/supabase/middleware.ts`: libera `/manifest.webmanifest`, `/sw.js`
  e `/pwa-icon.svg` pra usuários sem sessão (browser baixa esses
  assets antes do login)



### Etapa 20.1 — Bugs UX mobile + validação webhook ponta-a-ponta (2026-05-02)

Pequeno follow-up à Etapa 20 com 2 bugs visuais reportados pelo Felipe + confirmação que o webhook Kiwify está 100% funcional.

**1. Lesson page mobile — NavButtons quebrando o layout:**
- Antes: `<h1>` + botões "Anterior/Próxima" no mesmo `flex-wrap items-start justify-between`. Em mobile estreito quebrava embaixo do título e os botões "Aula concluída"/"Salvar nos favoritos" (linha de baixo) ficavam apertados/cortados.
- Agora: criada **linha separada acima do título** com módulo (à esquerda) + NavButtons (à direita). NavButtons compactos no mobile (só ícone, texto "Anterior"/"Próxima" só em sm+). LessonActionsRow ganhou textos curtos pra mobile ("Concluir" / "Favoritar") + textos completos em sm+.

**2. Comunidade mobile — header duplicado:**
- Antes: topbar tinha "Comunidade" estática no `CommunityMobileBar` E o header da página de novo ("Feed", "Regras", etc.) → 3 níveis de header redundantes ocupando muito espaço vertical em mobile.
- Agora: `CommunityMobileBar` lê `usePathname()` e mostra dinamicamente **"Comunidade · {nomePágina}"** (Feed, ou nome da página /community/[slug], etc.). O header redundante das pages /community/feed e /community/[slug] fica `hidden md:block` (escondido no mobile). Em md+ a sidebar é fixa e o header da page volta a aparecer.
- Padding do CommunityMobileBar reduzido (`py-1.5` em vez de `py-2`).

**Validação webhook ponta-a-ponta** (commit anterior, agora confirmado):
- Felipe trocou `KIWIFY_WEBHOOK_TOKEN` no Vercel pro valor do `?token=` da URL salva (`gB2j81…`) e adicionou `KIWIFY_WEBHOOK_SECRET=yjdnig1x8xc`. Redeploy.
- Várias vendas de teste reais chegaram: `order_approved` (criou sale paid), `order_refunded` (atualizou pra refunded + reverteu XP), `pix_created` (loga raw mas não cria sale — esperado).
- Matheus: 194 XP / Nível 2 (subiu de 101 com novas vendas + conquista "Primeira venda" liberando os 50 XP).

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
| `f4911ab` | **Etapa 26** — Broadcast com 3 canais (Push / In-app / Barra fixa) |
| `feeb7d4` | **Etapa 26.1** — Polimentos broadcast banner + Favicon custom + PWA install fix |
| `da4dc3d` | fix(lesson-mobile): tabs scroll horizontal + URL longa não estoura layout |
| `8de4ac0` | **Etapa 27** — Encurtador de URLs (manual + auto) + Player YouTube limpo |
| `871a528` | **Etapa 28** — One-click login + Welcome popup por curso + Celebração de conquistas |
| `622bec4` | **Etapa 29** — Monitorias auto-status + calendário + deeplink Zoom |
| `23f399a` | **Etapa 30 (parte)** — Auto-enrollment por venda + products-mapping |
| `ad134b2` | **Etapa 30 (parte)** — E-mails de boas-vindas em 2 níveis (welcome + new access) |
| `9fcaa70` | **Etapa 30 (parte)** — Endpoint Unnichat login-link + auto-login URL |
| `c241acd` | **Etapa 31** — Polimentos: fixar posts, monitoria semanal, branding login, admin client sem cache |
| `e7a3454` | **Etapa 32 (parte)** — Painel de importação em massa de alunos via CSV |
| `6a46741` | **Etapa 32 (parte)** — Filtros + paginação real + colunas extras em /admin/students |
| `9913373` | **Etapa 33** — Página /migracao com tutorial + redirect academia.felipesempe.com.br -> /migracao 308 |
| `421ec88` | **Etapa 34** — Activity status (engagement) derivado + filtro/coluna em /admin/students + audience de broadcast + cron + webhook outbound |
| `6a52761` | feat: payload do inactive-webhook ganha `phone` + `phone_digits` (Unnichat filtra por phone) |
| `e7a3cbe` | fix: insere "9" do mobile em telefones BR antigos (10 dígitos sem o 9) — 19 alunos na base nesse formato |

---

**FIM DO HANDOFF.** Mantenha este documento sincronizado conforme as etapas avançam — é a memória do projeto entre sessões e máquinas.
