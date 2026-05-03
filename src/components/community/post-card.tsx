"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart, MessageCircle, MoreHorizontal, Pencil, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { timeAgoPtBr, videoEmbedUrl } from "@/lib/community";
import { isElevatedRole, type AccessRole } from "@/lib/access";
import {
  deleteTopicAction,
  toggleTopicLikeAction,
} from "@/app/(student)/community/actions";
import { PostModal } from "@/components/community/create-post-button";
import { DecoratedAvatar } from "@/components/decorated-avatar";
import { LevelBadge } from "@/components/level-badge";

export interface PostCardData {
  id: string;
  title: string;
  contentHtml: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  likesCount: number;
  repliesCount: number;
  isPinned?: boolean;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorDecorationUrl?: string | null;
  authorLevel?: number | null;
  liked: boolean;
  pageSlug: string;
  pageId: string;
  pageTitle: string;
}

interface Props {
  post: PostCardData;
  currentRole: AccessRole;
  currentUserId: string;
}

export function PostCard({ post, currentRole, currentUserId }: Props) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likesCount);
  const [pendingLike, startLikeTransition] = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);

  const isAuthor = post.authorId === currentUserId;
  const canEdit = isAuthor || isElevatedRole(currentRole);
  const canDelete = isAuthor || isElevatedRole(currentRole);

  const embed = videoEmbedUrl(post.videoUrl);
  const preview = stripHtml(post.contentHtml ?? "").slice(0, 240);
  const firstImageUrl = extractFirstImage(post.contentHtml);
  const detailUrl = `/community/${post.pageSlug}/post/${post.id}`;

  function handleLike() {
    setLiked((p) => !p);
    setLikes((c) => (liked ? Math.max(c - 1, 0) : c + 1));
    startLikeTransition(async () => {
      const res = await toggleTopicLikeAction(post.id);
      if (!res.ok) {
        setLiked((p) => !p);
        setLikes((c) => (liked ? c + 1 : Math.max(c - 1, 0)));
        toast.error(res.error ?? "Falha ao curtir.");
      }
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Excluir "${post.title}"?`)) return;
    startDeleteTransition(async () => {
      const res = await deleteTopicAction(post.id, post.pageSlug);
      if (res.ok) {
        setHidden(true);
        toast.success("Publicação excluída.");
      } else {
        toast.error(res.error ?? "Falha ao excluir.");
      }
    });
  }

  if (hidden) return null;

  return (
    <li
      className={`rounded-xl border p-5 transition hover:border-npb-gold/40 ${
        post.isPinned
          ? "border-npb-gold/40 bg-npb-gold/5"
          : "border-npb-border bg-npb-bg2"
      }`}
    >
      <div className="flex items-start gap-3">
        <DecoratedAvatar
          src={post.authorAvatarUrl}
          decorationUrl={post.authorDecorationUrl}
          name={post.authorName}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 rounded bg-npb-gold/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-npb-gold">
                <Pin className="h-2.5 w-2.5" />
                Fixado
              </span>
            )}
            <span className="text-sm font-semibold text-npb-text">
              {post.authorName}
            </span>
            <LevelBadge level={post.authorLevel} size={16} />
            <span className="text-xs text-npb-text-muted">
              {timeAgoPtBr(post.createdAt)}
            </span>
          </div>
          <Link
            href={detailUrl}
            className="mt-1 block text-base font-bold text-npb-text hover:text-npb-gold"
          >
            {post.title}
          </Link>
        </div>

        {(canEdit || canDelete) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="Opções"
              className="rounded-md p-1 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-md border border-npb-border bg-npb-bg3 py-1 shadow-lg">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditingOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-npb-text hover:bg-npb-bg4"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pendingDelete}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir
                  </button>
                )}
              </div>
            )}

            {editingOpen && (
              <PostModal
                pageId={post.pageId}
                pageTitle={post.pageTitle}
                editing={{
                  topicId: post.id,
                  title: post.title,
                  bodyHtml: post.contentHtml ?? "",
                  videoUrl: post.videoUrl,
                }}
                onClose={() => setEditingOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {(preview || firstImageUrl) && (
        <Link
          href={detailUrl}
          className="mt-3 flex items-start gap-3 text-sm leading-relaxed text-npb-text-muted hover:text-npb-text"
        >
          {preview && (
            <span className="min-w-0 flex-1">
              {preview}
              {(post.contentHtml?.length ?? 0) > 240 && "…"}
            </span>
          )}
          {firstImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstImageUrl}
              alt=""
              aria-hidden
              className="h-20 w-20 flex-shrink-0 rounded-lg border border-npb-border bg-npb-bg3 object-cover"
            />
          )}
        </Link>
      )}

      {/* Vídeo embaixo do texto, conforme decisão de produto */}
      {embed && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-npb-border bg-black">
          <iframe
            src={embed}
            title={post.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs">
        <button
          type="button"
          onClick={handleLike}
          disabled={pendingLike}
          className={`inline-flex items-center gap-1.5 transition ${
            liked
              ? "text-red-400"
              : "text-npb-text-muted hover:text-red-400"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          <span className="font-semibold">{likes}</span>
        </button>
        <Link
          href={detailUrl}
          className="inline-flex items-center gap-1.5 text-npb-text-muted hover:text-npb-gold"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="font-semibold">{post.repliesCount}</span>
          <span className="hidden sm:inline">
            {post.repliesCount === 1 ? "comentário" : "comentários"}
          </span>
        </Link>
      </div>
    </li>
  );
}

export function Avatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 overflow-hidden rounded-full bg-npb-bg3 ${className ?? "h-9 w-9"}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs font-bold text-npb-gold">
          {(name || "?")[0]?.toUpperCase()}
        </div>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrai a 1ª `<img src="...">` do conteúdo HTML do post pra usar como
 * thumb na descrição curta. Ignora iframes (vídeos vão embaixo).
 */
function extractFirstImage(html: string | null | undefined): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}
