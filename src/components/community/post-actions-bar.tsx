"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { isElevatedRole, type AccessRole } from "@/lib/access";
import { deleteTopicAction } from "@/app/(student)/community/actions";
import {
  approvePostAction,
  rejectPostAction,
  toggleTopicPinAction,
} from "@/app/(admin)/admin/community/actions";
import { PostModal } from "@/components/community/create-post-button";

interface Props {
  topicId: string;
  authorId: string;
  currentUserId: string;
  currentRole: AccessRole;
  status: string;
  isPinned?: boolean;
  pageId: string;
  pageSlug: string;
  pageTitle: string;
  title: string;
  contentHtml: string | null;
  videoUrl: string | null;
}

export function PostActionsBar({
  topicId,
  authorId,
  currentUserId,
  currentRole,
  status,
  isPinned = false,
  pageId,
  pageSlug,
  pageTitle,
  title,
  contentHtml,
  videoUrl,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [pendingDelete, startDelete] = useTransition();
  const [pendingMod, startMod] = useTransition();
  const [pendingPin, startPin] = useTransition();

  const isAuthor = authorId === currentUserId;
  const elevated = isElevatedRole(currentRole);
  const canEdit = isAuthor || elevated;
  const canDelete = isAuthor || elevated;
  const canModerate = elevated && status !== "approved";
  const canPin = elevated && status === "approved";

  function handleTogglePin() {
    setMenuOpen(false);
    startPin(async () => {
      const res = await toggleTopicPinAction(topicId, !isPinned);
      if (res.ok) {
        toast.success(isPinned ? "Post desafixado." : "Post fixado no topo.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Excluir "${title}"?`)) return;
    startDelete(async () => {
      const res = await deleteTopicAction(topicId, pageSlug);
      if (res.ok) {
        toast.success("Publicação excluída.");
        router.push(`/community/${pageSlug}`);
      } else {
        toast.error(res.error ?? "Falha ao excluir.");
      }
    });
  }

  function handleApprove() {
    startMod(async () => {
      const res = await approvePostAction(topicId);
      if (res.ok) {
        toast.success("Publicação aprovada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleReject() {
    if (!confirm("Rejeitar esta publicação?")) return;
    startMod(async () => {
      const res = await rejectPostAction(topicId);
      if (res.ok) {
        toast.success("Publicação rejeitada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {canModerate && (
        <>
          <button
            type="button"
            onClick={handleReject}
            disabled={pendingMod}
            className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/5 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            {pendingMod ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Rejeitar
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pendingMod}
            className="inline-flex items-center gap-1 rounded-md bg-green-500 px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
          >
            {pendingMod ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Aprovar
          </button>
        </>
      )}

      {(canEdit || canDelete) && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="Opções"
            className="rounded-md p-1.5 text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text"
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
              {canPin && (
                <button
                  type="button"
                  onClick={handleTogglePin}
                  disabled={pendingPin}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-npb-text hover:bg-npb-bg4"
                >
                  {isPinned ? (
                    <PinOff className="h-3 w-3" />
                  ) : (
                    <Pin className="h-3 w-3" />
                  )}
                  {isPinned ? "Desafixar" : "Fixar no topo"}
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
              pageId={pageId}
              pageTitle={pageTitle}
              editing={{
                topicId,
                title,
                bodyHtml: contentHtml ?? "",
                videoUrl,
              }}
              onClose={() => setEditingOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
