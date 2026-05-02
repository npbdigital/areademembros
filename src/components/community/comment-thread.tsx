"use client";

import { useState, useTransition } from "react";
import { Heart, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sanitizePostHtml, timeAgoPtBr } from "@/lib/community";
import { isElevatedRole, type AccessRole } from "@/lib/access";
import { Avatar } from "@/components/community/post-card";
import {
  createReplyAction,
  deleteReplyAction,
  toggleReplyLikeAction,
} from "@/app/(student)/community/actions";

export interface CommentNode {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  contentHtml: string;
  likesCount: number;
  createdAt: string;
  liked: boolean;
  parentId: string | null;
  replies: CommentNode[];
}

interface Props {
  topicId: string;
  rootNodes: CommentNode[];
  currentUserId: string;
  currentRole: AccessRole;
}

export function CommentThread({
  topicId,
  rootNodes,
  currentUserId,
  currentRole,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmitRoot(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createReplyAction(topicId, null, trimmed);
      if (res.ok) {
        setDraft("");
        toast.success("Comentário enviado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmitRoot} className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={10_000}
          placeholder="Escreva um comentário…"
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-npb-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Comentar
          </button>
        </div>
      </form>

      {rootNodes.length === 0 ? (
        <p className="py-6 text-center text-sm text-npb-text-muted">
          Seja o primeiro a comentar.
        </p>
      ) : (
        <ul className="space-y-4">
          {rootNodes.map((node) => (
            <li key={node.id}>
              <CommentItem
                node={node}
                topicId={topicId}
                currentUserId={currentUserId}
                currentRole={currentRole}
                isReply={false}
              />
              {node.replies.length > 0 && (
                <ul className="mt-3 space-y-3 border-l-2 border-npb-border pl-4">
                  {node.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentItem
                        node={reply}
                        topicId={topicId}
                        currentUserId={currentUserId}
                        currentRole={currentRole}
                        isReply={true}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({
  node,
  topicId,
  currentUserId,
  currentRole,
  isReply,
}: {
  node: CommentNode;
  topicId: string;
  currentUserId: string;
  currentRole: AccessRole;
  isReply: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(node.liked);
  const [count, setCount] = useState(node.likesCount);
  const [pendingLike, startLike] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pendingReply, startReply] = useTransition();
  const [hidden, setHidden] = useState(false);

  const canDelete =
    node.authorId === currentUserId || isElevatedRole(currentRole);
  const safeHtml = sanitizePostHtml(node.contentHtml);

  function handleLike() {
    setLiked((p) => !p);
    setCount((c) => (liked ? Math.max(c - 1, 0) : c + 1));
    startLike(async () => {
      const res = await toggleReplyLikeAction(node.id);
      if (!res.ok) {
        setLiked((p) => !p);
        setCount((c) => (liked ? c + 1 : Math.max(c - 1, 0)));
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Excluir este comentário?")) return;
    startDelete(async () => {
      const res = await deleteReplyAction(node.id);
      if (res.ok) {
        setHidden(true);
        toast.success("Comentário excluído.");
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) return;
    startReply(async () => {
      const res = await createReplyAction(topicId, node.id, trimmed);
      if (res.ok) {
        setReplyText("");
        setReplying(false);
        toast.success("Resposta enviada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (hidden) return null;

  return (
    <div className="flex items-start gap-2.5">
      <Avatar
        src={node.authorAvatarUrl}
        name={node.authorName}
        className="h-7 w-7"
      />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-npb-bg3 p-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-npb-text">
              {node.authorName}
            </span>
            <span className="text-[10px] text-npb-text-muted">
              {timeAgoPtBr(node.createdAt)}
            </span>
          </div>
          <div
            className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-npb-text"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>

        <div className="mt-1.5 flex items-center gap-3 px-1 text-[11px]">
          <button
            type="button"
            onClick={handleLike}
            disabled={pendingLike}
            className={`inline-flex items-center gap-1 transition ${
              liked ? "text-red-400" : "text-npb-text-muted hover:text-red-400"
            }`}
          >
            <Heart className={`h-3 w-3 ${liked ? "fill-current" : ""}`} />
            {count}
          </button>
          {!isReply && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="inline-flex items-center gap-1 text-npb-text-muted hover:text-npb-gold"
            >
              <MessageCircle className="h-3 w-3" />
              Responder
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pendingDelete}
              className="inline-flex items-center gap-1 text-npb-text-muted hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              Excluir
            </button>
          )}
        </div>

        {replying && !isReply && (
          <form onSubmit={handleReplySubmit} className="mt-2 space-y-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              maxLength={10_000}
              placeholder={`Responder a ${node.authorName}…`}
              className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplying(false)}
                className="rounded-md px-2 py-1 text-xs text-npb-text-muted hover:text-npb-text"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pendingReply || !replyText.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-3 py-1 text-xs font-semibold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
              >
                {pendingReply && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Enviar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
