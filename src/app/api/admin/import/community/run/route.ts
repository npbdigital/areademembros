import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { extractCircleImageUrls } from "@/lib/circle-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Executa o import seletivo respeitando as decisoes do admin.
 *
 * Body (JSON):
 *   {
 *     authorDecisions: {
 *       [authorMemberId]: { action: "use_existing"|"create_fictitious"|"skip",
 *                            userId?: string,  // pra use_existing
 *                            email?: string, fullName?: string, avatarUrl?: string }
 *     },
 *     posts: [{ postId, pageId, title, htmlBody, authorMemberId, createdAtIso,
 *                likesCount, migrateImages: bool }],
 *     comments: [{ commentId, postId, parentId, authorMemberId, bodyHtml, createdAtIso }]
 *   }
 *
 * Retorna log detalhado: contadores + erros por post.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }
  const approverId = user.id;

  type AuthorDecision =
    | { action: "use_existing"; userId: string }
    | { action: "create_fictitious"; email: string; fullName: string; avatarUrl?: string | null }
    | { action: "skip" };

  interface RunBody {
    authorDecisions: Record<string, AuthorDecision>;
    posts: Array<{
      postId: string;
      pageId: string;
      title: string;
      htmlBody: string;
      authorMemberId: string;
      createdAtIso: string;
      likesCount: number;
      migrateImages: boolean;
    }>;
    comments: Array<{
      commentId: string;
      postId: string; // Circle post id
      parentId: string | null; // Circle comment id of parent
      authorMemberId: string;
      bodyHtml: string;
      createdAtIso: string;
    }>;
  }

  const body = (await req.json().catch(() => null)) as RunBody | null;
  if (!body || !body.authorDecisions || !Array.isArray(body.posts)) {
    return NextResponse.json(
      { ok: false, error: "Payload inválido." },
      { status: 400 },
    );
  }

  const sb = createAdminClient();

  // ETAPA 1: resolve autores -> user_ids reais
  // Cria fictícios marcados pra criação, valida existentes.
  const authorToUserId = new Map<string, string>(); // authorMemberId -> user_id
  const authorCreated: string[] = [];
  const authorErrors: Array<{ authorMemberId: string; error: string }> = [];

  for (const [memberId, decision] of Object.entries(body.authorDecisions)) {
    if (decision.action === "skip") continue;

    if (decision.action === "use_existing") {
      authorToUserId.set(memberId, decision.userId);
      continue;
    }

    // create_fictitious
    const email = decision.email.toLowerCase().trim();
    const fullName = decision.fullName.trim();

    try {
      // Ja existe pelo email?
      const { data: existing } = await sb
        .schema("membros")
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        authorToUserId.set(memberId, (existing as { id: string }).id);
        continue;
      }

      // Cria fictício direto no auth.users + membros.users
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password: crypto.randomUUID(), // senha aleatória — fictício não loga
        email_confirm: true,
        user_metadata: { full_name: fullName, source: "circle_import" },
      });

      if (createErr || !created?.user) {
        // Se já existe em auth (mas não em membros.users), busca via listUsers
        if (createErr?.message?.toLowerCase().includes("already")) {
          const { data: listResult } = await sb.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          const found = listResult.users?.find(
            (u) => u.email?.toLowerCase() === email,
          );
          if (found) {
            await sb
              .schema("membros")
              .from("users")
              .upsert(
                {
                  id: found.id,
                  email,
                  full_name: fullName,
                  avatar_url: decision.avatarUrl ?? null,
                  role: "ficticio",
                  is_active: true,
                },
                { onConflict: "id" },
              );
            authorToUserId.set(memberId, found.id);
            continue;
          }
        }
        throw new Error(createErr?.message ?? "createUser sem retorno");
      }

      const userId = created.user.id;
      await sb
        .schema("membros")
        .from("users")
        .upsert(
          {
            id: userId,
            email,
            full_name: fullName,
            avatar_url: decision.avatarUrl ?? null,
            role: "ficticio",
            is_active: true,
          },
          { onConflict: "id" },
        );

      authorToUserId.set(memberId, userId);
      authorCreated.push(memberId);
    } catch (e) {
      authorErrors.push({
        authorMemberId: memberId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ETAPA 2: importa posts dos autores resolvidos
  // Mantém mapa circlePostId -> topicId pra ligar comments depois.
  const postIdMap = new Map<string, string>();
  const postsCreated: string[] = [];
  const postErrors: Array<{ postId: string; error: string }> = [];

  for (const p of body.posts) {
    const userId = authorToUserId.get(p.authorMemberId);
    if (!userId) {
      postErrors.push({
        postId: p.postId,
        error: "Autor não resolvido (skipado ou erro na criação).",
      });
      continue;
    }
    if (!p.pageId) {
      postErrors.push({
        postId: p.postId,
        error: "Página da comunidade não mapeada pro space.",
      });
      continue;
    }

    try {
      // Migração de imagens (opcional por post)
      let finalHtml = p.htmlBody;
      if (p.migrateImages) {
        finalHtml = await migrateCircleImages(p.htmlBody, sb);
      }

      const { data: created, error } = await sb
        .schema("membros")
        .from("community_topics")
        .insert({
          page_id: p.pageId,
          user_id: userId,
          title: p.title.slice(0, 200),
          content_html: finalHtml,
          status: "approved",
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          likes_count: p.likesCount,
          is_moderated: true,
          created_at: p.createdAtIso || new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !created) {
        throw new Error(error?.message ?? "INSERT sem retorno");
      }

      const topicId = (created as { id: string }).id;
      postIdMap.set(p.postId, topicId);
      postsCreated.push(topicId);
    } catch (e) {
      postErrors.push({
        postId: p.postId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ETAPA 3: importa comments (só os de posts que entraram)
  // Comments têm parent_id que aponta pra OUTRO comment do Circle.
  // Primeiro insere os de nível 0 (sem parentId), depois os filhos.
  const commentIdMap = new Map<string, string>(); // circle comment id -> reply id
  const commentsCreated: string[] = [];
  const commentErrors: Array<{ commentId: string; error: string }> = [];

  // Comentários top-level primeiro
  const topLevel = body.comments.filter((c) => !c.parentId);
  const childLevel = body.comments.filter((c) => c.parentId);

  for (const c of topLevel) {
    const topicId = postIdMap.get(c.postId);
    if (!topicId) continue; // post não foi importado, comment não entra

    const userId = authorToUserId.get(c.authorMemberId);
    if (!userId) {
      commentErrors.push({
        commentId: c.commentId,
        error: "Autor do comment não resolvido.",
      });
      continue;
    }

    try {
      const { data: rep, error } = await sb
        .schema("membros")
        .from("community_replies")
        .insert({
          topic_id: topicId,
          user_id: userId,
          content_html: c.bodyHtml,
          parent_id: null,
          is_moderated: true,
          created_at: c.createdAtIso || new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !rep) throw new Error(error?.message ?? "INSERT sem retorno");
      commentIdMap.set(c.commentId, (rep as { id: string }).id);
      commentsCreated.push((rep as { id: string }).id);
    } catch (e) {
      commentErrors.push({
        commentId: c.commentId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Comentários filhos (resolução do parent_id)
  for (const c of childLevel) {
    const topicId = postIdMap.get(c.postId);
    if (!topicId) continue;
    const parentReplyId = c.parentId ? commentIdMap.get(c.parentId) : null;
    const userId = authorToUserId.get(c.authorMemberId);
    if (!userId) {
      commentErrors.push({
        commentId: c.commentId,
        error: "Autor do comment não resolvido.",
      });
      continue;
    }

    try {
      const { data: rep, error } = await sb
        .schema("membros")
        .from("community_replies")
        .insert({
          topic_id: topicId,
          user_id: userId,
          content_html: c.bodyHtml,
          parent_id: parentReplyId ?? null,
          is_moderated: true,
          created_at: c.createdAtIso || new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !rep) throw new Error(error?.message ?? "INSERT sem retorno");
      commentIdMap.set(c.commentId, (rep as { id: string }).id);
      commentsCreated.push((rep as { id: string }).id);
    } catch (e) {
      commentErrors.push({
        commentId: c.commentId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Trigger no banco ja recalcula replies_count automaticamente quando
  // INSERT/DELETE em community_replies, entao nao precisa fazer manual.

  return NextResponse.json({
    ok: true,
    summary: {
      authorsCreated: authorCreated.length,
      authorErrors: authorErrors.length,
      postsCreated: postsCreated.length,
      postErrors: postErrors.length,
      commentsCreated: commentsCreated.length,
      commentErrors: commentErrors.length,
    },
    errors: {
      authors: authorErrors,
      posts: postErrors,
      comments: commentErrors,
    },
  });
}

/**
 * Migra imagens hospedadas no Circle pro nosso Supabase Storage e
 * reescreve o HTML com as novas URLs. Roda dentro do request — pode
 * adicionar 1-3s dependendo da quantidade de imagens.
 *
 * Bucket usado: course-covers (publico, ja existe). Pasta: circle-import/.
 */
async function migrateCircleImages(
  html: string,
  sb: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const urls = extractCircleImageUrls(html);
  if (urls.length === 0) return html;

  let result = html;
  for (const originalUrl of urls) {
    try {
      const res = await fetch(originalUrl);
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("gif")
            ? "gif"
            : "jpg";
      const path = `circle-import/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await sb.storage
        .from("course-covers")
        .upload(path, buf, {
          contentType,
          upsert: false,
        });
      if (upErr) continue;

      const { data: pub } = sb.storage.from("course-covers").getPublicUrl(path);
      if (pub?.publicUrl) {
        // Substitui no HTML — escape RegExp na URL original
        const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "g"), pub.publicUrl);
      }
    } catch {
      // Imagem que falhar fica como tá (URL Circle) — pelo menos aparece
      // enquanto o Circle estiver no ar.
    }
  }
  return result;
}
