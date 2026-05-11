import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  extractCircleImageUrls,
  findAuthorEmail,
  findCircleMember,
  parseCommentsCsv,
  parseMembersCsv,
  parsePostsCsv,
  parseSpacesCsv,
} from "@/lib/circle-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzedAuthor {
  authorMemberId: string;
  authorName: string;
  email: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  postsCount: number;
  commentsCount: number;
  isFelipe: boolean;
  /** Se acharmos no nosso banco pelo email */
  matchedUserId: string | null;
  matchedUserFullName: string | null;
}

interface AnalyzedPost {
  postId: string;
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
  pageId: string | null;
  createdAtIso: string;
  title: string;
  bodyPreview: string;
  htmlBody: string;
  authorMemberId: string;
  authorName: string;
  likesCount: number;
  commentsCount: number;
  imagesCount: number;
  isFelipe: boolean;
}

interface AnalyzedComment {
  commentId: string;
  postId: string;
  parentId: string | null;
  createdAtIso: string;
  authorMemberId: string;
  authorName: string;
  bodyPreview: string;
  bodyHtml: string;
  isFelipe: boolean;
}

export async function POST(req: NextRequest) {
  // Auth admin
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

  const formData = await req.formData();
  const postsFile = formData.get("posts") as File | null;
  const commentsFile = formData.get("comments") as File | null;
  const membersFile = formData.get("members") as File | null;
  const spacesFile = formData.get("spaces") as File | null;

  if (!postsFile) {
    return NextResponse.json(
      { ok: false, error: "posts.csv obrigatório." },
      { status: 400 },
    );
  }

  const postsText = await postsFile.text();
  const commentsText = commentsFile ? await commentsFile.text() : "";
  const membersText = membersFile ? await membersFile.text() : "";
  const spacesText = spacesFile ? await spacesFile.text() : "";

  const posts = parsePostsCsv(postsText);
  const comments = commentsText ? parseCommentsCsv(commentsText) : [];
  const members = membersText ? parseMembersCsv(membersText) : [];
  const spaces = spacesText ? parseSpacesCsv(spacesText) : [];

  // Map space_id -> {name, slug}
  const spacesMap = new Map<string, { name: string; slug: string }>();
  for (const s of spaces) {
    spacesMap.set(s.id, { name: s.name, slug: s.slug });
  }

  // Carrega community_pages pra mapear slug -> page_id
  const sb = createAdminClient();
  const { data: pagesRaw } = await sb
    .schema("membros")
    .from("community_pages")
    .select("id, slug, title")
    .eq("is_active", true);
  const pagesMap = new Map<string, { id: string; title: string }>();
  for (const p of (pagesRaw ?? []) as Array<{ id: string; slug: string; title: string }>) {
    pagesMap.set(p.slug, { id: p.id, title: p.title });
  }

  // Felipe — detecta pelo nome (todos os "Felipe Sempe")
  const isFelipeAuthor = (name: string) =>
    name.trim().toLowerCase() === "felipe sempe";

  // Agrega autores únicos com qtd de posts/comments
  const authorsAggMap = new Map<
    string,
    { name: string; postsCount: number; commentsCount: number }
  >();
  for (const p of posts) {
    if (!p.authorMemberId) continue;
    const cur = authorsAggMap.get(p.authorMemberId) ?? {
      name: p.authorName,
      postsCount: 0,
      commentsCount: 0,
    };
    cur.postsCount += 1;
    authorsAggMap.set(p.authorMemberId, cur);
  }
  for (const c of comments) {
    if (!c.authorMemberId) continue;
    const cur = authorsAggMap.get(c.authorMemberId) ?? {
      name: c.authorName,
      postsCount: 0,
      commentsCount: 0,
    };
    cur.commentsCount += 1;
    authorsAggMap.set(c.authorMemberId, cur);
  }

  // Junta com info do members.csv + cruza com nosso banco
  const allEmails: string[] = [];
  const authorInfo: Array<{
    authorMemberId: string;
    authorName: string;
    email: string | null;
    avatarUrl: string | null;
    headline: string | null;
    bio: string | null;
    postsCount: number;
    commentsCount: number;
    isFelipe: boolean;
  }> = [];

  for (const [memberId, agg] of Array.from(authorsAggMap.entries())) {
    const member = findCircleMember(agg.name, members);
    const email = member?.email ?? findAuthorEmail(agg.name, members);
    if (email) allEmails.push(email);
    authorInfo.push({
      authorMemberId: memberId,
      authorName: agg.name,
      email: email ?? null,
      avatarUrl: member?.avatarUrl ?? null,
      headline: member?.headline ?? null,
      bio: member?.bio ?? null,
      postsCount: agg.postsCount,
      commentsCount: agg.commentsCount,
      isFelipe: isFelipeAuthor(agg.name),
    });
  }

  // Cross-reference com membros.users pra ver quais já existem
  const userByEmail = new Map<string, { id: string; full_name: string | null }>();
  if (allEmails.length > 0) {
    const { data: usersData } = await sb
      .schema("membros")
      .from("users")
      .select("id, email, full_name")
      .in("email", allEmails);
    for (const u of (usersData ?? []) as Array<{
      id: string;
      email: string;
      full_name: string | null;
    }>) {
      userByEmail.set(u.email.toLowerCase(), { id: u.id, full_name: u.full_name });
    }
  }

  const analyzedAuthors: AnalyzedAuthor[] = authorInfo.map((a) => {
    const matched = a.email ? userByEmail.get(a.email) : undefined;
    return {
      ...a,
      matchedUserId: matched?.id ?? null,
      matchedUserFullName: matched?.full_name ?? null,
    };
  });

  // Posts analisados
  const analyzedPosts: AnalyzedPost[] = posts.map((p) => {
    const space = spacesMap.get(p.spaceId);
    const page = space ? pagesMap.get(space.slug) ?? null : null;
    const imageUrls = extractCircleImageUrls(p.htmlBody);
    return {
      postId: p.id,
      spaceId: p.spaceId,
      spaceName: space?.name ?? "?",
      spaceSlug: space?.slug ?? "?",
      pageId: page?.id ?? null,
      createdAtIso: p.createdAtIso,
      title: p.title,
      bodyPreview: stripHtml(p.htmlBody || p.body).slice(0, 200),
      htmlBody: p.htmlBody || p.body,
      authorMemberId: p.authorMemberId,
      authorName: p.authorName,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      imagesCount: imageUrls.length,
      isFelipe: isFelipeAuthor(p.authorName),
    };
  });

  // Comments analisados
  const analyzedComments: AnalyzedComment[] = comments.map((c) => ({
    commentId: c.id,
    postId: c.postId,
    parentId: c.parentId,
    createdAtIso: c.createdAtIso,
    authorMemberId: c.authorMemberId,
    authorName: c.authorName,
    bodyPreview: stripHtml(c.body).slice(0, 200),
    bodyHtml: c.body,
    isFelipe: isFelipeAuthor(c.authorName),
  }));

  // Spaces sem match em community_pages — admin precisa criar antes
  const spacesWithoutPage: Array<{ id: string; name: string; slug: string }> = [];
  for (const s of spaces) {
    if (!pagesMap.has(s.slug)) {
      spacesWithoutPage.push({ id: s.id, name: s.name, slug: s.slug });
    }
  }

  // Sumario
  const totalImages = analyzedPosts.reduce((acc, p) => acc + p.imagesCount, 0);
  const summary = {
    totalPosts: analyzedPosts.length,
    totalComments: analyzedComments.length,
    totalAuthors: analyzedAuthors.length,
    matchedAuthors: analyzedAuthors.filter((a) => a.matchedUserId).length,
    unmatchedAuthors: analyzedAuthors.filter((a) => !a.matchedUserId && !a.isFelipe).length,
    felipePosts: analyzedPosts.filter((p) => p.isFelipe).length,
    totalImages,
    spacesWithoutPage,
  };

  return NextResponse.json({
    ok: true,
    summary,
    authors: analyzedAuthors,
    posts: analyzedPosts,
    comments: analyzedComments,
    pagesAvailable: Array.from(pagesMap.entries()).map(([slug, p]) => ({
      slug,
      pageId: p.id,
      title: p.title,
    })),
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
