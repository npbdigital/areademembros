# Especificação Técnica — Área de Membros (Clone Circle.so)
**Stack:** Next.js 14 (App Router) + Supabase + Tailwind CSS  
**Deploy:** Vercel

---

## 1. ARQUITETURA GERAL

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (community)/
│   ├── layout.tsx              ← Layout com sidebar
│   ├── page.tsx                ← Redirect para primeiro espaço
│   └── [spaceSlug]/
│       ├── page.tsx            ← Feed do espaço
│       └── post/[postId]/
│           └── page.tsx        ← Post individual com comentários
├── admin/
│   ├── layout.tsx
│   ├── page.tsx                ← Dashboard admin
│   ├── posts/page.tsx          ← Fila de moderação
│   ├── spaces/page.tsx         ← Gerenciar espaços e links
│   └── members/page.tsx        ← Gerenciar membros
├── api/
│   ├── posts/route.ts
│   ├── posts/[id]/approve/route.ts
│   ├── posts/[id]/like/route.ts
│   ├── comments/route.ts
│   └── search/route.ts
└── components/
    ├── layout/
    │   ├── Sidebar.tsx
    │   ├── SidebarSection.tsx
    │   └── SearchBar.tsx
    ├── feed/
    │   ├── Feed.tsx
    │   ├── PostCard.tsx
    │   ├── CreatePostModal.tsx
    │   └── VideoEmbed.tsx
    ├── post/
    │   ├── PostDetail.tsx
    │   ├── CommentThread.tsx
    │   ├── CommentItem.tsx
    │   └── LikeButton.tsx
    └── ui/
        ├── Avatar.tsx
        ├── Badge.tsx
        └── RichTextEditor.tsx
```

---

## 2. SCHEMA SUPABASE

### Execute no SQL Editor do Supabase:

```sql
-- ==========================================
-- TABELAS PRINCIPAIS
-- ==========================================

-- Perfis de usuários (extende auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Espaços (seções da sidebar)
CREATE TABLE spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '💬',
  sort_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links personalizados da sidebar
CREATE TABLE sidebar_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '🔗',
  sort_order INT DEFAULT 0,
  open_in_new_tab BOOLEAN DEFAULT TRUE,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,                          -- HTML do rich text editor
  video_url TEXT,                     -- URL YouTube/Vimeo
  image_url TEXT,                     -- URL da imagem (Supabase Storage)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Curtidas
CREATE TABLE post_likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Comentários (suporta aninhamento 1 nível)
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- NULL = comentário raiz
  body TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Curtidas em comentários
CREATE TABLE comment_likes (
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX idx_posts_space_id ON posts(space_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Auto-criar perfil ao registrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Atualizar likes_count nos posts
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_count_trigger
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Atualizar comments_count nos posts
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE sidebar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Profiles: todos leem, só o próprio usuário edita
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Spaces: todos leem, só admin/moderador escreve
CREATE POLICY "spaces_read" ON spaces FOR SELECT USING (true);
CREATE POLICY "spaces_write" ON spaces FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Sidebar links: todos leem, só admin escreve
CREATE POLICY "links_read" ON sidebar_links FOR SELECT USING (true);
CREATE POLICY "links_write" ON sidebar_links FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Posts: membros leem aprovados; admin/mod leem todos; autor vê o próprio
CREATE POLICY "posts_read_approved" ON posts FOR SELECT USING (
  status = 'approved'
  OR auth.uid() = author_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_admin" ON posts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (
  auth.uid() = author_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Curtidas
CREATE POLICY "likes_read" ON post_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comentários: todos leem em posts aprovados, membros inserem
CREATE POLICY "comments_read" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (
  auth.uid() = author_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Comment likes
CREATE POLICY "comment_likes_read" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- DADOS INICIAIS (seed)
-- ==========================================

INSERT INTO spaces (name, slug, icon, sort_order) VALUES
  ('Comece Aqui', 'comece-aqui', '🚀', 1),
  ('Geral', 'geral', '💬', 2),
  ('Dúvidas', 'duvidas', '❓', 3),
  ('Conquistas', 'conquistas', '🏆', 4);

INSERT INTO sidebar_links (label, url, icon, sort_order) VALUES
  ('Aulas da Mentoria', 'https://seusite.com/aulas', '🎓', 1),
  ('Grupo no WhatsApp', 'https://wa.me/grouplink', '📱', 2),
  ('Suporte', 'https://seusite.com/suporte', '🆘', 3);
```

---

## 3. VARIÁVEIS DE AMBIENTE

Crie `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hblyregbowxaxzpnerhf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
NEXT_PUBLIC_SITE_NAME=Mentoria 20K
NEXT_PUBLIC_SITE_LOGO_URL=/logo.png
```

---

## 4. DEPENDÊNCIAS (package.json)

```bash
npx create-next-app@latest community --typescript --tailwind --app
cd community
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link
npm install lucide-react
npm install react-hot-toast
npm install date-fns
```

---

## 5. COMPONENTES — DESCRIÇÃO DETALHADA

### 5.1 Sidebar (`components/layout/Sidebar.tsx`)

**Visual:** Coluna fixa de ~260px, fundo escuro (#1a1a1a), logo no topo, scroll independente.

**Estrutura:**
```
[Logo + Nome da Comunidade]
[SearchBar]
──────────────
[Seção: Espaços]
  • Ícone + Nome do espaço (link ativo destacado com cor brand)
──────────────
[Seção: Links]
  • Ícone + Label + ↗ (abre em nova aba)
──────────────
[Avatar + Nome do usuário logado]
[Sair]
```

**Dados:** Busca `spaces` e `sidebar_links` do Supabase no Server Component (layout).

**Estado ativo:** Compara `spaceSlug` da URL com `space.slug`.

---

### 5.2 SearchBar (`components/layout/SearchBar.tsx`)

- Input com ícone de lupa
- Ao digitar, faz `GET /api/search?q=termo`
- A API busca em `posts.title` e `posts.body` (full-text search do Postgres)
- Exibe dropdown com resultados inline
- Clica no resultado → navega para `/[spaceSlug]/post/[postId]`

**SQL para full-text search:**
```sql
SELECT p.*, s.slug as space_slug
FROM posts p
JOIN spaces s ON p.space_id = s.id
WHERE p.status = 'approved'
AND to_tsvector('portuguese', p.title || ' ' || COALESCE(p.body, ''))
    @@ plainto_tsquery('portuguese', $1)
LIMIT 10;
```

---

### 5.3 Feed (`components/feed/Feed.tsx`)

**Dados:** Server Component com `revalidate = 60` ou client com SWR.

```ts
// Query básica
const { data: posts } = await supabase
  .from('posts')
  .select(`
    *,
    author:profiles(id, name, avatar_url),
    space:spaces(name, slug)
  `)
  .eq('space_id', spaceId)
  .eq('status', 'approved')
  .order('created_at', { ascending: false })
  .range(0, 19); // paginação: 20 por vez
```

**Renderização do card:**
- Avatar circular + nome + data relativa (ex: "há 2 horas" com date-fns)
- Título em negrito
- Preview do body: strip HTML, máximo 200 chars + "... ver mais"
- Se `video_url`: miniatura do YouTube
- Se `image_url`: imagem com aspect-ratio 16:9
- Rodapé: [❤️ N curtidas] [💬 N comentários]

**Paginação:** Botão "Carregar mais" ou scroll infinito com IntersectionObserver.

---

### 5.4 CreatePostModal (`components/feed/CreatePostModal.tsx`)

**Campos:**
1. **Título** — input text, obrigatório, max 150 chars
2. **Descrição** — TipTap rich text (bold, italic, links, listas)
3. **Vídeo** — input URL (YouTube/Vimeo), valida o formato e exibe preview
4. **Imagem** — upload direto para Supabase Storage bucket `post-images`

**Submit:**
```ts
// 1. Upload imagem se houver
const { data: imgData } = await supabase.storage
  .from('post-images')
  .upload(`${userId}/${Date.now()}.jpg`, file);

// 2. Inserir post com status 'pending'
await supabase.from('posts').insert({
  space_id: currentSpaceId,
  author_id: userId,
  title,
  body: editorHTML,
  video_url: videoUrl || null,
  image_url: imgData?.path ? supabase.storage.from('post-images').getPublicUrl(imgData.path).data.publicUrl : null,
  status: 'pending'
});
```

**Após submit:** Toast "Publicação enviada para aprovação! ✅"

---

### 5.5 VideoEmbed (`components/feed/VideoEmbed.tsx`)

Converte URL em embed:
- YouTube: `https://youtube.com/watch?v=ID` → `https://www.youtube.com/embed/ID`
- Vimeo: `https://vimeo.com/ID` → `https://player.vimeo.com/video/ID`

```tsx
function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  
  return null;
}
```

Renderiza `<iframe>` com aspect-ratio 16:9.

---

### 5.6 PostDetail (`components/post/PostDetail.tsx`)

- Título completo
- Body HTML completo (sanitize com DOMPurify antes de `dangerouslySetInnerHTML`)
- Vídeo embed se houver
- Imagem se houver
- LikeButton
- CommentThread

---

### 5.7 CommentThread (`components/post/CommentThread.tsx`)

**Estrutura:**
```
[Avatar] [Nome] [Data]
[Texto do comentário]
[❤️ N] [↩ Responder]
  └─ [Resposta 1]
  └─ [Resposta 2]
  └─ [Input de nova resposta]
[Input de novo comentário raiz]
```

**Query:**
```ts
// Busca comentários raiz + respostas em uma query
const { data } = await supabase
  .from('comments')
  .select(`*, author:profiles(id, name, avatar_url)`)
  .eq('post_id', postId)
  .is('parent_id', null)
  .order('created_at', { ascending: true });

// Para cada comentário, busca respostas
const { data: replies } = await supabase
  .from('comments')
  .select(`*, author:profiles(id, name, avatar_url)`)
  .eq('post_id', postId)
  .not('parent_id', 'is', null)
  .order('created_at', { ascending: true });
```

---

### 5.8 LikeButton (`components/post/LikeButton.tsx`)

- Verifica se o usuário já curtiu (busca em `post_likes`)
- Toggle: INSERT ou DELETE
- Atualização otimista (UI muda imediatamente, rollback se erro)

```ts
const handleLike = async () => {
  if (!user) return toast.error('Faça login para curtir');
  
  setLiked(prev => !prev); // otimista
  setCount(prev => liked ? prev - 1 : prev + 1);
  
  if (liked) {
    await supabase.from('post_likes')
      .delete().eq('post_id', postId).eq('user_id', user.id);
  } else {
    await supabase.from('post_likes')
      .insert({ post_id: postId, user_id: user.id });
  }
};
```

---

## 6. PAINEL ADMIN

### Rota: `/admin/posts`

**Tabela de posts pendentes:**

| Autor | Título | Espaço | Data | Ações |
|-------|--------|--------|------|-------|
| Nome  | Titulo | Geral  | Hoje | [✅ Aprovar] [❌ Rejeitar] |

**API Route:**
```ts
// app/api/posts/[id]/approve/route.ts
export async function POST(req, { params }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  // Verifica se é admin/moderador
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  
  if (!['admin', 'moderator'].includes(profile.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  await supabase.from('posts').update({
    status: 'approved',
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq('id', params.id);
  
  return Response.json({ success: true });
}
```

### Rota: `/admin/spaces`

- CRUD completo de espaços (nome, slug, ícone, ordem)
- CRUD de links da sidebar (label, URL, ícone, nova aba, ordem)
- Drag-and-drop para reordenar (biblioteca: `@dnd-kit/core`)

### Rota: `/admin/members`

- Lista todos os membros
- Botão para promover a moderador ou admin
- Botão para banir (apagar conta via Supabase Admin API)

---

## 7. STORAGE SUPABASE

Crie o bucket `post-images` no Supabase Storage:
- **Public:** SIM
- **Allowed MIME types:** image/jpeg, image/png, image/webp, image/gif
- **Max size:** 5MB

**Policy do bucket:**
```sql
-- Qualquer autenticado pode fazer upload
CREATE POLICY "auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- Qualquer um pode ler
CREATE POLICY "public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

-- Só o dono pode deletar
CREATE POLICY "owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 8. AUTENTICAÇÃO

Use `@supabase/auth-helpers-nextjs` com middleware para proteger rotas:

```ts
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');
  const isAdminPage = req.nextUrl.pathname.startsWith('/admin');
  
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  if (isAdminPage && session) {
    // Verifica role no JWT ou faz query
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single();
    
    if (!['admin', 'moderator'].includes(profile?.role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
```

---

## 9. VISUAL / TEMA

Inspirado no screenshot (tema escuro, cor brand laranja):

```css
/* tailwind.config.ts — extend colors */
colors: {
  brand: {
    DEFAULT: '#df9223',
    dark: '#be7c1e',
    light: '#f0a83a',
  },
  surface: {
    DEFAULT: '#1a1b1e',   /* fundo principal */
    2: '#25262b',          /* sidebar */
    3: '#2c2d32',          /* cards */
    4: '#3a3b40',          /* hover */
  }
}
```

**Fonte sugerida:** `Sora` (display/títulos) + `DM Sans` (body) — ambas Google Fonts.

---

## 10. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1 — Base (2–3 dias)
- [ ] Criar projeto Next.js
- [ ] Configurar Supabase (rodar o SQL acima)
- [ ] Configurar autenticação (email/senha)
- [ ] Layout com sidebar funcional
- [ ] Feed básico listando posts aprovados

### Fase 2 — Posts (2 dias)
- [ ] Modal de criação de post
- [ ] Upload de imagem
- [ ] Embed de vídeo
- [ ] Rich text editor (TipTap)

### Fase 3 — Interações (1–2 dias)
- [ ] Curtidas com atualização otimista
- [ ] Comentários e respostas
- [ ] Curtidas em comentários

### Fase 4 — Admin (2 dias)
- [ ] Fila de moderação
- [ ] CRUD de espaços e links
- [ ] Gerenciar membros

### Fase 5 — Polimento (1 dia)
- [ ] Busca full-text
- [ ] Paginação/scroll infinito
- [ ] Responsivo mobile
- [ ] Loading states e empty states
- [ ] Deploy na Vercel

---

## 11. PONTOS DE ATENÇÃO

1. **DOMPurify:** Sempre sanitize o HTML do TipTap antes de renderizar para evitar XSS.
   ```ts
   import DOMPurify from 'isomorphic-dompurify';
   const clean = DOMPurify.sanitize(post.body);
   ```

2. **Revalidação:** Use `revalidatePath('/[slug]')` nas server actions após aprovação de posts.

3. **Realtime (opcional):** Supabase suporta subscriptions — pode adicionar notificação em tempo real quando um novo post é aprovado ou comentário é feito.
   ```ts
   supabase.channel('posts').on('postgres_changes', 
     { event: 'INSERT', schema: 'public', table: 'posts', filter: 'status=eq.approved' },
     (payload) => { /* atualiza feed */ }
   ).subscribe();
   ```

4. **SEO:** Posts individuais devem ter `generateMetadata` com título e description do post.

5. **Slugs de espaço:** Mantenha sempre lowercase, sem espaços (use `slug` para URL, `name` para exibição).
