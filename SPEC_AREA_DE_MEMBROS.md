# SPEC COMPLETA — ÁREA DE MEMBROS CUSTOM (SaaS)

> Documento de especificação para Claude Code. Contém arquitetura, banco de dados, regras de negócio, endpoints, fluxos e requisitos de UI para construção completa da aplicação.

---

## 0. SETUP COMPLETO ANTES DE COMEÇAR A CODAR

> Esta seção deve ser executada pelo desenvolvedor (humano) antes de rodar o Claude Code.
> Siga na ordem. Nenhuma etapa pode ser pulada.

---

### 0.1 Pré-requisitos no seu computador

Instale as ferramentas abaixo (na ordem):

**Node.js 18+**
- Acesse: https://nodejs.org/en
- Baixe a versão LTS e instale normalmente
- Verifique: abra o terminal e rode `node -v` → deve aparecer `v18.x.x` ou superior

**Git**
- Acesse: https://git-scm.com/downloads
- Instale normalmente
- Verifique: `git --version`

**Claude Code**
- Com Node instalado, rode no terminal:
```bash
npm install -g @anthropic-ai/claude-code
```
- Verifique: `claude --version`

---

### 0.2 Criar conta e repositório no GitHub

1. Acesse https://github.com e crie uma conta (ou entre na sua)
2. Clique em **New repository**
3. Configure:
   - **Repository name:** `membros` (ou o nome que preferir)
   - **Visibility:** Private
   - **Initialize with README:** SIM (marque essa opção)
4. Clique em **Create repository**
5. Copie a URL do repositório (ex: `https://github.com/seu-usuario/membros.git`)

**Configure o Git no seu computador (só precisa fazer uma vez):**
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

---

### 0.3 Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta
2. Clique em **New Project**
3. Preencha:
   - **Organization:** sua org (cria uma se não tiver)
   - **Project name:** `membros`
   - **Database Password:** crie uma senha forte e **salve ela**
   - **Region:** South America (São Paulo) — mais próximo do Brasil
4. Clique em **Create new project** e aguarde ~2 minutos
5. Após criado, vá em **Project Settings → API**
6. Anote os seguintes valores (você vai precisar deles):
   - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (clique em "Reveal") → será `SUPABASE_SERVICE_ROLE_KEY`

---

### 0.4 Criar conta no Resend (e-mail transacional)

1. Acesse https://resend.com e crie uma conta
2. No dashboard, clique em **API Keys → Create API Key**
3. Nome: `membros-prod`
4. Copie a chave gerada → será `RESEND_API_KEY`

> Para o protótipo, o Resend já funciona com o domínio `@resend.dev` sem configurar DNS.
> Em produção, você vai querer configurar seu próprio domínio.

---

### 0.5 Criar projeto no Google Cloud (YouTube API)

> Esta é a etapa mais longa, mas necessária para a busca de vídeos do seu canal.

1. Acesse https://console.cloud.google.com
2. Clique em **Select a project → New Project**
   - Nome: `membros-plataforma`
   - Clique em **Create**
3. Com o projeto selecionado, vá em **APIs & Services → Library**
4. Pesquise por **YouTube Data API v3** e clique em **Enable**
5. Vá em **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - Clique em **Create**
   - Preencha:
     - **App name:** Membros Plataforma
     - **User support email:** seu e-mail
     - **Developer contact:** seu e-mail
   - Clique em **Save and Continue** em todas as telas
   - Na tela **Test users**, adicione o seu e-mail do Google/YouTube
   - Finalize
6. Vá em **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Name: `membros-oauth`
   - **Authorized redirect URIs:** adicione:
     - `http://localhost:3000/api/youtube/callback` (desenvolvimento)
     - `https://seu-projeto.vercel.app/api/youtube/callback` (produção — preencha depois)
   - Clique em **Create**
7. Copie:
   - **Client ID** → será `GOOGLE_CLIENT_ID`
   - **Client Secret** → será `GOOGLE_CLIENT_SECRET`

---

### 0.6 Criar conta e projeto no Vercel

1. Acesse https://vercel.com e clique em **Sign Up with GitHub** (use a mesma conta do GitHub)
2. Autorize o Vercel a acessar seus repositórios
3. No dashboard do Vercel, clique em **Add New → Project**
4. Selecione o repositório `membros` que você criou
5. **Não clique em Deploy ainda** — primeiro precisa configurar as variáveis de ambiente

**Configure as variáveis de ambiente no Vercel:**
Ainda na tela de setup do projeto, expanda **Environment Variables** e adicione uma a uma:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase (passo 0.3) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key do Supabase |
| `GOOGLE_CLIENT_ID` | Client ID do Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Client Secret do Google Cloud |
| `GOOGLE_REDIRECT_URI` | `https://seu-projeto.vercel.app/api/youtube/callback` |
| `RESEND_API_KEY` | API key do Resend |
| `WEBHOOK_SECRET` | crie uma senha aleatória forte (ex: gere em https://1password.com/password-generator/) |
| `NEXT_PUBLIC_APP_URL` | `https://seu-projeto.vercel.app` |

6. Após adicionar todas as variáveis, clique em **Deploy**
7. Aguarde o primeiro deploy (vai falhar ou mostrar tela vazia — normal, o código ainda não existe)
8. Copie a URL gerada (ex: `membros-xyz.vercel.app`) e volte ao Google Cloud para adicionar ela nas Authorized redirect URIs

---

### 0.7 Clonar o repositório no seu computador

```bash
# Na pasta onde você quer o projeto (ex: Documentos):
git clone https://github.com/seu-usuario/membros.git
cd membros
```

**Crie o arquivo de variáveis de ambiente local:**
```bash
# Dentro da pasta do projeto, crie o arquivo .env.local:
touch .env.local
```

Abra o arquivo `.env.local` em qualquer editor de texto e cole:
```
NEXT_PUBLIC_SUPABASE_URL=cole_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_aqui
SUPABASE_SERVICE_ROLE_KEY=cole_aqui
GOOGLE_CLIENT_ID=cole_aqui
GOOGLE_CLIENT_SECRET=cole_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
RESEND_API_KEY=cole_aqui
WEBHOOK_SECRET=cole_aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> O `.env.local` nunca vai para o GitHub (já estará no `.gitignore`). As variáveis de produção ficam só no Vercel.

---

### 0.8 Como usar em outro computador

1. Instale Node.js, Git e Claude Code na outra máquina (igual passo 0.1)
2. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/membros.git
cd membros
```
3. Crie o `.env.local` com os mesmos valores
4. Pronto — qualquer alteração feita e enviada com `git push` aparece automaticamente no Vercel

---

### 0.9 Como o deploy automático funciona

```
Você edita o código localmente (com Claude Code ou manualmente)
        ↓
git add . && git commit -m "descrição da mudança" && git push
        ↓
Vercel detecta o push no GitHub automaticamente
        ↓
Vercel rebuilda e publica em ~60 segundos
        ↓
URL pública atualizada
```

Você nunca precisa acessar o servidor. Tudo é gerenciado pelo Vercel.

---

### 0.10 Instrução de inicialização para o Claude Code

Após completar os passos 0.1 a 0.9, abra o terminal dentro da pasta do projeto e rode:

```bash
claude
```

Cole a seguinte instrução inicial:

---

> **"Você é um desenvolvedor senior full-stack especialista em Next.js 14, TypeScript, Supabase e Tailwind CSS. Vou te passar a especificação completa de uma plataforma de área de membros. Você deve implementar essa aplicação seguindo rigorosamente a spec — sem inventar funcionalidades não descritas, sem mudar a stack definida. Comece pela Etapa 1 da ordem de implementação: setup do projeto Next.js com TypeScript, Tailwind CSS, shadcn/ui e configuração do cliente Supabase. Após cada etapa concluída, informe o que foi feito e aguarde minha confirmação para ir para a próxima etapa. Aqui está a spec completa: [COLE O RESTANTE DESTE DOCUMENTO]"**

---

## 1. VISÃO GERAL DO PROJETO

Plataforma de área de membros multi-curso, multi-turma, com painel administrativo completo, integração YouTube, comunidade, drip content, relatórios e webhook de matrícula.

**Stack obrigatória:**
- **Frontend + Backend:** Next.js 14 (App Router, Server Actions)
- **Banco de dados:** PostgreSQL via Supabase
- **Autenticação:** Supabase Auth (email/senha + magic link)
- **Storage:** Supabase Storage (capas, banners, anexos)
- **YouTube:** Google YouTube Data API v3 (OAuth 2.0)
- **E-mail transacional:** Resend
- **Deploy:** Vercel
- **Linguagem:** TypeScript em todo o projeto

**Variáveis de ambiente necessárias (estrutura do `.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
RESEND_API_KEY=
WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

---

## 2. ESTRUTURA DO BANCO DE DADOS (PostgreSQL / Supabase)

### 2.1 Tabelas

```sql
-- USUÁRIOS (alunos e admins)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CURSOS
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_for_sale BOOLEAN DEFAULT false,
  sale_url TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULOS
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  position INT DEFAULT 0,
  -- Controle de drip no módulo inteiro
  release_type TEXT DEFAULT 'immediate' CHECK (release_type IN ('immediate', 'locked', 'days_after_enrollment', 'fixed_date')),
  release_days INT,           -- usado quando release_type = 'days_after_enrollment'
  release_date TIMESTAMPTZ,   -- usado quando release_type = 'fixed_date'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AULAS
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description_html TEXT,
  youtube_video_id TEXT,
  youtube_video_title TEXT,
  youtube_thumbnail_url TEXT,
  duration_seconds INT,
  position INT DEFAULT 0,
  -- Controle de drip por aula (herda módulo se módulo estiver bloqueado)
  release_type TEXT DEFAULT 'immediate' CHECK (release_type IN ('immediate', 'locked', 'days_after_enrollment', 'fixed_date')),
  release_days INT,
  release_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ANEXOS DAS AULAS
CREATE TABLE lesson_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TURMAS
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RELAÇÃO TURMA ↔ CURSO (quais cursos uma turma tem acesso)
CREATE TABLE cohort_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  has_community_access BOOLEAN DEFAULT false,
  UNIQUE(cohort_id, course_id)
);

-- MATRÍCULAS (aluno ↔ turma)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,   -- NULL = sem expiração
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'webhook')),
  webhook_payload JSONB,    -- payload original do webhook para auditoria
  UNIQUE(user_id, cohort_id)
);

-- PROGRESSO DO ALUNO POR AULA
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  watch_time_seconds INT DEFAULT 0,  -- tempo acumulado assistido
  last_watched_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- AVALIAÇÕES DAS AULAS
CREATE TABLE lesson_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- BANNERS (dentro de cursos, acima das capas dos módulos)
CREATE TABLE banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  link_url TEXT,
  link_target TEXT DEFAULT '_blank',
  is_active BOOLEAN DEFAULT true,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- course_id OU module_id deve ser preenchido (validar na aplicação)
);

-- COMUNIDADE — GALERIAS (categorias de tópicos)
CREATE TABLE community_galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMUNIDADE — TÓPICOS
CREATE TABLE community_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES community_galleries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_moderated BOOLEAN DEFAULT true,  -- false = aguardando moderação
  views_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMUNIDADE — RESPOSTAS
CREATE TABLE community_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES community_topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content_html TEXT NOT NULL,
  is_moderated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMUNIDADE — CURTIDAS
CREATE TABLE community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES community_topics(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES community_replies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_id),
  UNIQUE(user_id, reply_id)
);

-- CONFIGURAÇÕES DA PLATAFORMA (whitelabel)
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICAÇÕES DOS ALUNOS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOG DE ACESSO (sessões dos alunos)
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id),
  action TEXT NOT NULL,  -- 'login', 'lesson_view', 'lesson_complete', 'logout'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WEBHOOK LOG
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  user_id UUID REFERENCES users(id)
);

-- ANOTAÇÕES DOS ALUNOS
CREATE TABLE lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAVORITOS DOS ALUNOS
CREATE TABLE lesson_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);
```

### 2.2 Índices de performance

```sql
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_cohort ON enrollments(cohort_id);
CREATE INDEX idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX idx_access_logs_user ON access_logs(user_id);
CREATE INDEX idx_access_logs_created ON access_logs(created_at DESC);
CREATE INDEX idx_community_topics_gallery ON community_topics(gallery_id);
CREATE INDEX idx_community_replies_topic ON community_replies(topic_id);
CREATE INDEX idx_lessons_module ON lessons(module_id);
CREATE INDEX idx_modules_course ON modules(course_id);
```

### 2.3 Row Level Security (RLS) — Supabase

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Alunos só veem/editam seus próprios dados
CREATE POLICY "users_own_data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "progress_own" ON lesson_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ratings_own" ON lesson_ratings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notes_own" ON lesson_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "favorites_own" ON lesson_favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notifications_own" ON notifications FOR SELECT USING (auth.uid() = user_id);

-- Admins têm acesso total (via service role key no servidor)
```

---

## 3. REGRAS DE NEGÓCIO CRÍTICAS

### 3.1 Drip Content — Lógica de Liberação

**Hierarquia de herança:**
1. Se o **módulo** tiver `release_type = 'locked'` → todas as aulas do módulo estão bloqueadas, independente da config individual de cada aula.
2. Se o módulo tiver outro `release_type` e ainda não estiver liberado para o aluno → aulas bloqueadas.
3. Se o módulo estiver liberado → cada aula é avaliada individualmente pelo seu próprio `release_type`.

**Cálculo de liberação por aluno:**

```typescript
function isContentReleased(
  releaseType: string,
  releaseDays: number | null,
  releaseDate: Date | null,
  enrolledAt: Date
): { released: boolean; releaseAt: Date | null } {
  switch (releaseType) {
    case 'immediate':
      return { released: true, releaseAt: null };
    case 'locked':
      return { released: false, releaseAt: null };
    case 'days_after_enrollment':
      const releaseAt = new Date(enrolledAt);
      releaseAt.setDate(releaseAt.getDate() + releaseDays!);
      return { released: new Date() >= releaseAt, releaseAt };
    case 'fixed_date':
      return { released: new Date() >= releaseDate!, releaseAt: releaseDate };
  }
}
```

**Nota:** Para `days_after_enrollment`, usar a `enrolled_at` da matrícula do aluno na turma que dá acesso ao curso.

### 3.2 Acesso a Cursos

- Um aluno acessa um curso se: tiver matrícula ativa (`is_active = true`, `expires_at > NOW() ou null`) em uma turma que tenha aquele curso na tabela `cohort_courses`.
- Se tiver múltiplas matrículas ativas em turmas diferentes que dão acesso ao mesmo curso, usar a mais antiga (`enrolled_at` menor) como referência para drip relativo.

### 3.3 Acesso à Comunidade

- Um aluno acessa a comunidade se tiver matrícula ativa em uma turma onde `cohort_courses.has_community_access = true` para algum curso.
- O acesso à comunidade é unificado — todas as galerias são visíveis para quem tem acesso, independente da turma.

### 3.4 Cursos "Para Venda"

- Cursos com `is_for_sale = true` aparecem em uma seção "Outros cursos disponíveis" na biblioteca do aluno.
- O aluno não acessa o conteúdo, apenas vê a capa, título e botão redirecionando para `sale_url`.

### 3.5 Proteção de Acesso a Conteúdo

- Todas as rotas de aula devem verificar no servidor (Server Action ou API Route) se o aluno tem matrícula válida + o conteúdo está liberado.
- Nunca confiar apenas no frontend para bloquear conteúdo.

---

## 4. ESTRUTURA DE ROTAS (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
├── (student)/                        # Layout com sidebar do aluno
│   ├── dashboard/page.tsx            # Biblioteca de cursos
│   ├── courses/[courseId]/page.tsx   # Módulos do curso
│   ├── lessons/[lessonId]/page.tsx   # Player + conteúdo da aula
│   ├── community/page.tsx            # Lista de galerias
│   ├── community/[galleryId]/page.tsx
│   ├── community/[galleryId]/[topicId]/page.tsx
│   ├── profile/page.tsx              # Dados pessoais, trocar senha
│   └── notifications/page.tsx
│
├── (admin)/                          # Layout do painel admin
│   ├── admin/dashboard/page.tsx      # Métricas gerais
│   ├── admin/courses/page.tsx        # Lista de cursos
│   ├── admin/courses/new/page.tsx
│   ├── admin/courses/[courseId]/page.tsx         # Editar curso
│   ├── admin/courses/[courseId]/modules/page.tsx
│   ├── admin/courses/[courseId]/modules/[moduleId]/page.tsx  # Editar módulo + aulas
│   ├── admin/students/page.tsx       # Lista de alunos
│   ├── admin/students/new/page.tsx
│   ├── admin/students/[userId]/page.tsx
│   ├── admin/cohorts/page.tsx
│   ├── admin/cohorts/new/page.tsx
│   ├── admin/cohorts/[cohortId]/page.tsx
│   ├── admin/community/page.tsx      # Galerias + moderação
│   ├── admin/banners/page.tsx
│   ├── admin/reports/page.tsx
│   ├── admin/settings/page.tsx       # Whitelabel, integrações
│   └── admin/youtube/page.tsx        # OAuth YouTube
│
└── api/
    ├── webhooks/enrollment/route.ts  # POST — cadastro de aluno via webhook
    ├── youtube/callback/route.ts     # OAuth callback YouTube
    ├── youtube/videos/route.ts       # GET — lista vídeos do canal
    └── lesson-progress/route.ts      # POST — tracking de watch time
```

---

## 5. FUNCIONALIDADES DO PAINEL DO ALUNO

### 5.1 Biblioteca de Cursos (`/dashboard`)

- Grid de cards com: capa do curso, título, barra de progresso (% de aulas concluídas).
- Separado em dois blocos: **Meus Cursos** (tem acesso) e **Cursos Disponíveis** (à venda).
- Card de curso à venda: capa + título + botão "Saiba Mais" → abre `sale_url` em nova aba.
- Seção "Continue de onde parou": última aula acessada (via `access_logs`).

### 5.2 Curso — Lista de Módulos (`/courses/[courseId]`)

- Banners ativos do curso acima da grade de módulos.
- Grid de cards de módulos com: capa, título, quantidade de aulas, progresso do aluno.
- Módulos bloqueados mostram ícone de cadeado + mensagem (ex: "Disponível em 12/05/2025" ou "Bloqueado pelo administrador").

### 5.3 Módulo — Lista de Aulas (dentro de `/courses/[courseId]` ou modal/drawer)

- Lista vertical de aulas com: thumbnail YouTube, título, duração, status (concluída ✓ / bloqueada 🔒 / disponível).
- Aulas bloqueadas mostram data de liberação se disponível.

### 5.4 Player de Aula (`/lessons/[lessonId]`)

- Player YouTube embeddado (iframe responsivo, sem sugestões ao fim, sem branding do YouTube visível quando possível via `rel=0&modestbranding=1`).
- Sidebar com lista de aulas do módulo (navegação direta).
- Abaixo do player:
  - Tabs: **Descrição** (HTML renderizado) / **Anexos** / **Anotações** / **Avaliação**.
  - Botão "Marcar como concluída" (toggle — pode desmarcar).
  - Botão "Salvar nos favoritos".
- Navegação: botões "Aula anterior" / "Próxima aula".
- Breadcrumb: Biblioteca → Nome do Curso → Nome do Módulo → Nome da Aula.
- Tracking: ao abrir a aula, registrar em `access_logs`. Periodicamente (a cada 30s via ping) atualizar `watch_time_seconds` em `lesson_progress`.

### 5.5 Comunidade

- Lista de galerias com capa, título, contador de tópicos.
- Dentro de uma galeria: lista de tópicos (título, autor, data, contagem de respostas, curtidas, tópicos fixados no topo).
- Tópico: conteúdo HTML, respostas aninhadas (1 nível), curtidas em tópico e resposta.
- Criar tópico: editor de texto rico (usar TipTap ou Quill).
- Notificação quando alguém responde ao tópico do aluno.

### 5.6 Perfil do Aluno

- Editar nome, telefone, avatar (upload para Supabase Storage).
- Trocar senha.
- Ver histórico de matrículas.

---

## 6. FUNCIONALIDADES DO PAINEL ADMIN

### 6.1 Dashboard Admin

Métricas em cards:
- Total de alunos ativos
- Novas matrículas (últimos 7 dias / 30 dias)
- Aulas mais assistidas (top 10)
- Progresso médio por curso
- Rating médio por curso
- Alunos que acessaram hoje / esta semana

### 6.2 Gestão de Cursos

**Lista de cursos:**
- Tabela com: capa (thumbnail), título, nº de módulos, nº de aulas, publicado (toggle), à venda (toggle).
- Drag-and-drop para reordenar cursos.
- Botão criar novo curso.

**Edição de curso:**
- Campos: título, descrição, capa (upload), publicado, à venda, URL de venda.
- Lista de módulos com drag-and-drop para reordenar.
- Botão adicionar módulo.
- Seção de banners do curso.

**Edição de módulo:**
- Campos: título, descrição, capa (upload).
- Configuração de drip: seletor de tipo (Imediato / Bloqueado / X dias após matrícula / Data fixa) com campos condicionais.
- Lista de aulas com drag-and-drop para reordenar.
- Botão adicionar aula.

**Edição de aula:**
- Campos: título, configuração de drip (idêntica ao módulo).
- Seleção de vídeo YouTube: campo de busca → lista vídeos do canal do admin → seleciona → salva `youtube_video_id`.
- Editor HTML para descrição (usar TipTap).
- Gerenciamento de anexos: upload de arquivos, reordenar, remover.

### 6.3 Integração YouTube (OAuth 2.0)

**Fluxo:**
1. Admin acessa `/admin/settings` → aba "YouTube".
2. Botão "Conectar conta YouTube" → redireciona para OAuth Google.
3. Callback salva `access_token` e `refresh_token` criptografados em `platform_settings`.
4. A partir daí, ao editar uma aula, o campo de vídeo exibe busca em tempo real nos vídeos do canal autenticado.
5. A busca usa `search.list` da YouTube Data API v3 filtrando por `forMine=true`.
6. Exibir thumbnail, título, duração e data de publicação de cada vídeo na lista de resultados.
7. Implementar refresh automático do token quando expirado.

**Scopes necessários:**
- `https://www.googleapis.com/auth/youtube.readonly`

### 6.4 Gestão de Turmas

- CRUD de turmas (nome, descrição).
- Dentro de cada turma: lista de cursos vinculados (com toggle de acesso à comunidade).
- Botão para adicionar/remover cursos da turma.
- Lista de alunos matriculados na turma (com data de matrícula e expiração).

### 6.5 Gestão de Alunos

**Lista de alunos:**
- Tabela com busca por nome/e-mail, filtro por turma, filtro por status (ativo/inativo).
- Colunas: avatar, nome, e-mail, turma(s), data de matrícula, último acesso, status.
- Exportar em CSV.

**Criar aluno manualmente:**
- Campos: nome, e-mail, telefone, senha temporária (ou enviar magic link).
- Selecionar turma(s) e data de expiração (opcional).
- Enviar e-mail de boas-vindas automaticamente.

**Editar aluno:**
- Editar todos os dados.
- Adicionar/remover matrículas.
- Ver progresso por curso.
- Ver histórico de acesso (log de sessões).
- Bloquear/desbloquear acesso.

### 6.6 Banners

- Criar banner vinculado a um curso específico OU a um módulo específico.
- Upload de imagem, URL de destino (opcional), nova aba (toggle).
- Ativar/desativar sem remover.
- Reordenar banners dentro do mesmo curso/módulo.

### 6.7 Comunidade — Admin

- CRUD de galerias: título, descrição, capa, posição, ativo/inativo.
- Configurar quais turmas/cursos têm acesso à comunidade (via `cohort_courses.has_community_access`).
- Fila de moderação: tópicos e respostas com `is_moderated = false`.
- Fixar/desafixar tópicos.
- Deletar tópicos ou respostas.

### 6.8 Relatórios

**Aba "Aulas":**
- Top 10 aulas mais assistidas (por `access_logs` com `action = 'lesson_view'`).
- Média de watch time por aula.
- Taxa de conclusão por aula (% de alunos com acesso que marcaram concluída).
- Rating médio por aula.

**Aba "Cursos":**
- Progresso médio por curso.
- Taxa de conclusão por curso.
- Alunos que nunca acessaram.

**Aba "Alunos":**
- Busca por aluno: ver histórico completo (quais aulas assistiu, quando, por quanto tempo).
- Filtro por período.

**Aba "Turmas":**
- Progresso médio da turma por curso.
- Alunos mais ativos vs. inativos.

**Exportação:** todos os relatórios exportáveis em CSV.

### 6.9 Configurações da Plataforma (Whitelabel)

- Logo da plataforma (upload).
- Cor primária e cor de destaque (color picker).
- Nome da plataforma.
- Favicon (upload).
- E-mail remetente (Resend sender).
- Texto de rodapé.
- Configurações de comunidade: moderação automática (on/off).

---

## 7. WEBHOOK DE MATRÍCULA

### Endpoint

```
POST /api/webhooks/enrollment
Content-Type: application/json
Authorization: Bearer {WEBHOOK_SECRET}
```

### Payload esperado

```json
{
  "event": "enrollment.created",
  "student": {
    "name": "Nome Completo",
    "email": "aluno@email.com",
    "phone": "+5511999999999"
  },
  "cohort_id": "uuid-da-turma",
  "expires_at": "2026-01-01T00:00:00Z"
}
```

### Lógica de processamento

1. Validar `Authorization` header contra `WEBHOOK_SECRET`.
2. Verificar se já existe usuário com o e-mail.
3. Se não existe: criar usuário + enviar e-mail de boas-vindas com link de definição de senha (Supabase Auth `inviteUserByEmail`).
4. Se já existe: usar usuário existente.
5. Verificar se já existe matrícula ativa na turma — se sim, ignorar ou atualizar `expires_at`.
6. Criar matrícula com `source = 'webhook'` e salvar `webhook_payload` para auditoria.
7. Retornar `{ success: true, user_id: "...", enrollment_id: "..." }`.
8. Em caso de erro: retornar `{ success: false, error: "..." }` com status 4xx/5xx.
9. Logar tudo em `webhook_logs`.

---

## 8. SISTEMA DE NOTIFICAÇÕES

**Triggers automáticos:**
- Novo aluno cadastrado → e-mail de boas-vindas.
- Nova aula publicada em curso com alunos matriculados → notificação in-app.
- Resposta em tópico da comunidade do aluno → notificação in-app + e-mail (configurável).
- Conteúdo desbloqueado (drip) → notificação in-app.

**Interface:**
- Sino no header com badge de contagem de não lidas.
- Dropdown com lista de últimas 10 notificações.
- Página `/notifications` com histórico completo.

---

## 9. SEGURANÇA

- Todas as rotas `(student)` e `(admin)` protegidas com middleware Next.js que verifica sessão Supabase.
- Rotas admin verificam `role = 'admin'` além da sessão.
- Webhook validado via `Authorization: Bearer` com secret.
- YouTube tokens armazenados criptografados (usar `crypto` nativo do Node com chave derivada de `SUPABASE_SERVICE_ROLE_KEY`).
- Upload de arquivos: validar tipo MIME e tamanho máximo (imagens: 5MB, anexos: 50MB).
- Rate limiting no endpoint de webhook (usar `@upstash/ratelimit` ou solução simples com timestamp em Redis/Supabase).
- Proteção contra acesso direto a URLs de aulas bloqueadas: sempre verificar no servidor.

---

## 10. EMAILS TRANSACIONAIS (Resend)

Templates necessários:
1. **Boas-vindas** — enviado ao criar conta via webhook. Inclui link de definição de senha.
2. **Reset de senha** — link para `/reset-password`.
3. **Nova aula disponível** — notificação de conteúdo desbloqueado.
4. **Resposta na comunidade** — aviso de resposta ao tópico.

Todos os e-mails devem usar o nome e logo da plataforma vindos de `platform_settings`.

---

## 11. COMPONENTES DE UI ESSENCIAIS

Usar **shadcn/ui** como base de componentes com **Tailwind CSS**.

**Componentes customizados a criar:**
- `YouTubePlayer` — wrapper do iframe com suporte a tracking de watch time.
- `ContentCard` — card reutilizável para curso/módulo com capa, título, progresso e status de bloqueio.
- `DripBadge` — badge visual indicando status de liberação ("Disponível", "Bloqueado", "Libera em DD/MM").
- `RichTextEditor` — TipTap configurado com: negrito, itálico, links, listas, headings, imagens.
- `VideoSelector` — modal de busca de vídeos YouTube com debounce de 500ms.
- `DragSortList` — wrapper de `@dnd-kit/sortable` para reordenação.
- `ProgressBar` — barra de progresso por curso/módulo.
- `BannerCarousel` — exibição de banners com suporte a imagem e link.
- `AdminDataTable` — tabela com paginação, busca e filtros (usar TanStack Table).

---

## 12. DEPENDÊNCIAS NPM

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "typescript": "^5.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.1.0",
    "tailwindcss": "^3.0.0",
    "@shadcn/ui": "latest",
    "@tiptap/react": "^2.0.0",
    "@tiptap/starter-kit": "^2.0.0",
    "@tiptap/extension-image": "^2.0.0",
    "@tiptap/extension-link": "^2.0.0",
    "@dnd-kit/core": "^6.0.0",
    "@dnd-kit/sortable": "^7.0.0",
    "@tanstack/react-table": "^8.0.0",
    "resend": "^2.0.0",
    "googleapis": "^140.0.0",
    "lucide-react": "latest",
    "date-fns": "^3.0.0",
    "react-hook-form": "^7.0.0",
    "zod": "^3.0.0",
    "@hookform/resolvers": "^3.0.0",
    "sonner": "^1.0.0"
  }
}
```

---

## 13. FLUXO DE DESENVOLVIMENTO SUGERIDO (ordem de implementação)

1. Setup do projeto Next.js + Supabase + TypeScript + shadcn/ui
2. Schema do banco (migrations SQL)
3. Autenticação (login, logout, reset senha, middleware de proteção de rotas)
4. Estrutura de layouts (student layout + admin layout)
5. CRUD de Cursos + Módulos + Aulas (admin)
6. Integração YouTube OAuth + seletor de vídeos
7. Sistema de matrículas e turmas (admin)
8. Biblioteca de cursos + player de aula (aluno)
9. Lógica de drip content
10. Progresso e conclusão de aulas
11. Comunidade
12. Banners
13. Webhook de matrícula
14. Sistema de notificações
15. Relatórios
16. Whitelabel / configurações
17. Refinamentos de UI, loading states, error handling

---

## 14. NOTAS FINAIS PARA O CLAUDE CODE

- **Sem `use client` desnecessário:** preferir Server Components sempre que possível. Usar `use client` apenas em componentes interativos.
- **Server Actions:** usar para mutações de dados (criar, editar, deletar) em vez de API Routes sempre que possível.
- **Tipos TypeScript:** gerar tipos a partir do schema Supabase (`supabase gen types typescript`).
- **Loading states:** toda listagem e formulário deve ter skeleton/spinner adequado.
- **Error handling:** usar `error.tsx` e `not-found.tsx` do App Router.
- **Mobile-first:** todos os layouts devem ser responsivos. O painel do aluno deve funcionar bem em mobile.
- **Admin é desktop-first:** o painel admin pode priorizar desktop, mas deve ser funcional em tablet.
- **Internacionalização:** todos os textos em português brasileiro.
- **Datas:** usar `date-fns` com locale `ptBR`.
- **Paginação:** todas as listagens com mais de 20 itens devem ter paginação server-side.
```
