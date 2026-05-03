"use client";

import { useState, useTransition } from "react";
import { Heart, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizePostHtml, timeAgoPtBr } from "@/lib/community";
import { isElevatedRole, type AccessRole } from "@/lib/access";
import { DecoratedAvatar } from "@/components/decorated-avatar";
import { LevelBadge } from "@/components/level-badge";
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
  authorDecorationUrl?: string | null;
  authorLevel?: number | null;
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
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  currentUserDecorationUrl?: string | null;
  currentUserLevel?: number | null;
  currentRole: AccessRole;
}

export function CommentThread({
  topicId,
  rootNodes,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  currentUserDecorationUrl,
  currentUserLevel,
  currentRole,
}: Props) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  // Comentários "otimistas" — adicionados imediatamente após enviar, sem
  // esperar o reload da página. Quando a action retorna, o id placeholder é
  // substituído pelo real (ou removido em caso de erro).
  const [localRoot, setLocalRoot] = useState<CommentNode[]>([]);
  const [localReplies, setLocalReplies] = useState<
    Record<string, CommentNode[]>
  >({});

  function buildOptimistic(
    parentId: string | null,
    body: string,
  ): CommentNode {
    return {
      id: `optimistic-${crypto.randomUUID()}`,
      authorId: currentUserId,
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatarUrl,
      authorDecorationUrl: currentUserDecorationUrl,
      authorLevel: currentUserLevel,
      contentHtml: body,
      likesCount: 0,
      createdAt: new Date().toISOString(),
      liked: false,
      parentId,
      replies: [],
    };
  }

  function handleSubmitRoot(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const optimistic = buildOptimistic(null, sanitizePostHtml(trimmed));
    setLocalRoot((p) => [...p, optimistic]);
    setDraft("");

    startTransition(async () => {
      const res = await createReplyAction(topicId, null, trimmed);
      if (res.ok && res.data) {
        // Substitui o placeholder pelo id real (mantém posição/conteúdo)
        setLocalRoot((p) =>
          p.map((c) =>
            c.id === optimistic.id
              ? { ...c, id: res.data!.replyId, createdAt: res.data!.createdAt }
              : c,
          ),
        );
      } else {
        // Rollback
        setLocalRoot((p) => p.filter((c) => c.id !== optimistic.id));
        toast.error(res.error ?? "Falha ao enviar comentário.");
      }
    });
  }

  function addOptimisticReply(rootId: string, optimistic: CommentNode) {
    setLocalReplies((map) => ({
      ...map,
      [rootId]: [...(map[rootId] ?? []), optimistic],
    }));
  }

  function replaceOptimisticReply(
    rootId: string,
    optimisticId: string,
    realId: string,
    realCreatedAt: string,
  ) {
    setLocalReplies((map) => ({
      ...map,
      [rootId]: (map[rootId] ?? []).map((r) =>
        r.id === optimisticId
          ? { ...r, id: realId, createdAt: realCreatedAt }
          : r,
      ),
    }));
  }

  function removeOptimisticReply(rootId: string, optimisticId: string) {
    setLocalReplies((map) => ({
      ...map,
      [rootId]: (map[rootId] ?? []).filter((r) => r.id !== optimisticId),
    }));
  }

  // Agrega: nodes do servidor + nodes locais (ordem natural)
  const allRootNodes = [...rootNodes, ...localRoot];

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
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Comentar
          </button>
        </div>
      </form>

      {allRootNodes.length === 0 ? (
        <p className="py-6 text-center text-sm text-npb-text-muted">
          Seja o primeiro a comentar.
        </p>
      ) : (
        <ul className="space-y-4">
          {allRootNodes.map((node) => {
            const localChildren = localReplies[node.id] ?? [];
            const allChildren = [...node.replies, ...localChildren];
            return (
              <li key={node.id}>
                <CommentItem
                  node={node}
                  topicId={topicId}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  currentUserAvatarUrl={currentUserAvatarUrl}
                  currentUserDecorationUrl={currentUserDecorationUrl}
                  currentUserLevel={currentUserLevel}
                  currentRole={currentRole}
                  isReply={false}
                  onOptimisticReply={(opt) => addOptimisticReply(node.id, opt)}
                  onReplySuccess={(optId, realId, createdAt) =>
                    replaceOptimisticReply(node.id, optId, realId, createdAt)
                  }
                  onReplyFail={(optId) => removeOptimisticReply(node.id, optId)}
                />
                {allChildren.length > 0 && (
                  <ul className="mt-3 space-y-3 border-l-2 border-npb-border pl-4">
                    {allChildren.map((reply) => (
                      <li key={reply.id}>
                        <CommentItem
                          node={reply}
                          topicId={topicId}
                          currentUserId={currentUserId}
                          currentUserName={currentUserName}
                          currentUserAvatarUrl={currentUserAvatarUrl}
                          currentUserDecorationUrl={currentUserDecorationUrl}
                          currentUserLevel={currentUserLevel}
                          currentRole={currentRole}
                          isReply={true}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CommentItem({
  node,
  topicId,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  currentUserDecorationUrl,
  currentUserLevel,
  currentRole,
  isReply,
  onOptimisticReply,
  onReplySuccess,
  onReplyFail,
}: {
  node: CommentNode;
  topicId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  currentUserDecorationUrl?: string | null;
  currentUserLevel?: number | null;
  currentRole: AccessRole;
  isReply: boolean;
  onOptimisticReply?: (optimistic: CommentNode) => void;
  onReplySuccess?: (
    optimisticId: string,
    realId: string,
    createdAt: string,
  ) => void;
  onReplyFail?: (optimisticId: string) => void;
}) {
  const [liked, setLiked] = useState(node.liked);
  const [count, setCount] = useState(node.likesCount);
  const [pendingLike, startLike] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pendingReply, startReply] = useTransition();
  const [hidden, setHidden] = useState(false);

  const isOptimistic = node.id.startsWith("optimistic-");
  const canDelete =
    !isOptimistic &&
    (node.authorId === currentUserId || isElevatedRole(currentRole));
  const safeHtml = sanitizePostHtml(node.contentHtml);

  function handleLike() {
    if (isOptimistic) return; // ainda não foi salvo
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
    if (!trimmed || !onOptimisticReply) return;

    const optimistic: CommentNode = {
      id: `optimistic-${crypto.randomUUID()}`,
      authorId: currentUserId,
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatarUrl,
      authorDecorationUrl: currentUserDecorationUrl,
      authorLevel: currentUserLevel,
      contentHtml: sanitizePostHtml(trimmed),
      likesCount: 0,
      createdAt: new Date().toISOString(),
      liked: false,
      parentId: node.id,
      replies: [],
    };
    onOptimisticReply(optimistic);
    setReplyText("");
    setReplying(false);

    startReply(async () => {
      const res = await createReplyAction(topicId, node.id, trimmed);
      if (res.ok && res.data && onReplySuccess) {
        onReplySuccess(optimistic.id, res.data.replyId, res.data.createdAt);
      } else if (onReplyFail) {
        onReplyFail(optimistic.id);
        toast.error(res.error ?? "Falha ao responder.");
      }
    });
  }

  if (hidden) return null;

  return (
    <div
      className={`flex items-start gap-2.5 ${
        isOptimistic ? "opacity-70" : ""
      }`}
    >
      <DecoratedAvatar
        src={node.authorAvatarUrl}
        decorationUrl={node.authorDecorationUrl}
        name={node.authorName}
        size={32}
      />
      <div className="min-w-0 flex-1">
        {/* Estilo Twitter: avatar à esquerda, título e tempo na MESMA linha
            do avatar (sem card cinza ao redor). Conteúdo logo abaixo. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 leading-tight">
          <span className="text-sm font-semibold text-npb-text">
            {node.authorName}
          </span>
          <LevelBadge level={node.authorLevel} size={14} />
          <span className="text-[10px] text-npb-text-muted">
            {isOptimistic ? "enviando…" : timeAgoPtBr(node.createdAt)}
          </span>
        </div>
        <div
          className="community-html mt-0.5 text-sm text-npb-text"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />

        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={handleLike}
            disabled={pendingLike || isOptimistic}
            className={`inline-flex items-center gap-1 transition ${
              liked ? "text-red-400" : "text-npb-text-muted hover:text-red-400"
            } disabled:opacity-50`}
          >
            <Heart className={`h-3 w-3 ${liked ? "fill-current" : ""}`} />
            {count}
          </button>
          {!isReply && !isOptimistic && (
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
