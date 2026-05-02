"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { timeAgoPtBr, videoEmbedUrl } from "@/lib/community";
import { isElevatedRole, type AccessRole } from "@/lib/access";
import {
  deleteTopicAction,
  toggleTopicLikeAction,
} from "@/app/(student)/community/actions";

export interface PostCardData {
  id: string;
  title: string;
  contentHtml: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  likesCount: number;
  repliesCount: number;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  liked: boolean;
  gallerySlug: string;
}

interface Props {
  post: PostCardData;
  currentRole: AccessRole;
}

export function PostCard({ post, currentRole }: Props) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likesCount);
  const [pendingLike, startLikeTransition] = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  const embed = videoEmbedUrl(post.videoUrl);
  const preview = stripHtml(post.contentHtml ?? "").slice(0, 240);
  const detailUrl = `/community/${post.gallerySlug}/post/${post.id}`;

  function handleLike() {
    setLiked((p) => !p);
    setLikes((c) => (liked ? Math.max(c - 1, 0) : c + 1));
    startLikeTransition(async () => {
      const res = await toggleTopicLikeAction(post.id);
      if (!res.ok) {
        // rollback
        setLiked((p) => !p);
        setLikes((c) => (liked ? c + 1 : Math.max(c - 1, 0)));
        toast.error(res.error ?? "Falha ao curtir.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir "${post.title}"?`)) return;
    startDeleteTransition(async () => {
      const res = await deleteTopicAction(post.id, post.gallerySlug);
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
    <li className="rounded-xl border border-npb-border bg-npb-bg2 p-5 transition hover:border-npb-gold/40">
      <div className="flex items-start gap-3">
        <Avatar
          src={post.authorAvatarUrl}
          name={post.authorName}
          className="h-9 w-9"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-npb-text">
              {post.authorName}
            </span>
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
        {isElevatedRole(currentRole) && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pendingDelete}
            title="Excluir publicação"
            className="rounded-md p-1 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {preview && (
        <Link
          href={detailUrl}
          className="mt-3 block text-sm leading-relaxed text-npb-text-muted hover:text-npb-text"
        >
          {preview}
          {(post.contentHtml?.length ?? 0) > 240 && "…"}
        </Link>
      )}

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

      {post.imageUrl && !embed && (
        <Link href={detailUrl} className="mt-3 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.title}
            className="aspect-video w-full rounded-lg border border-npb-border object-cover"
          />
        </Link>
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
          <Heart
            className={`h-4 w-4 ${liked ? "fill-current" : ""}`}
          />
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
