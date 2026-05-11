"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Play,
  RotateCcw,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================
// Tipos espelhando o response do /analyze
// ============================================================

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

interface AnalyzeResponse {
  ok: boolean;
  error?: string;
  summary?: {
    totalPosts: number;
    totalComments: number;
    totalAuthors: number;
    matchedAuthors: number;
    unmatchedAuthors: number;
    felipePosts: number;
    totalImages: number;
    spacesWithoutPage: Array<{ id: string; name: string; slug: string }>;
  };
  authors?: AnalyzedAuthor[];
  posts?: AnalyzedPost[];
  comments?: AnalyzedComment[];
}

type AuthorAction = "skip" | "use_existing" | "create_fictitious";

interface AuthorDecisionState {
  action: AuthorAction;
  // Pra use_existing: o userId selecionado (default vem do matchedUserId).
  userId?: string;
  // Pra create_fictitious: dados editáveis.
  email?: string;
  fullName?: string;
}

// ============================================================
// Componente
// ============================================================

export function CircleImportPanel() {
  const [postsFile, setPostsFile] = useState<File | null>(null);
  const [commentsFile, setCommentsFile] = useState<File | null>(null);
  const [membersFile, setMembersFile] = useState<File | null>(null);
  const [spacesFile, setSpacesFile] = useState<File | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);

  // Decisões do admin
  const [authorDecisions, setAuthorDecisions] = useState<Record<string, AuthorDecisionState>>({});
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [migrateImages, setMigrateImages] = useState(true);
  const [previewPost, setPreviewPost] = useState<AnalyzedPost | null>(null);

  const [result, setResult] = useState<{
    summary: { authorsCreated: number; postsCreated: number; commentsCreated: number; authorErrors: number; postErrors: number; commentErrors: number };
    errors: { authors: Array<{ authorMemberId: string; error: string }>; posts: Array<{ postId: string; error: string }>; comments: Array<{ commentId: string; error: string }> };
  } | null>(null);

  // Autores sem Felipe
  const visibleAuthors = useMemo(
    () => (analysis?.authors ?? []).filter((a) => !a.isFelipe),
    [analysis],
  );
  const visiblePosts = useMemo(
    () => (analysis?.posts ?? []).filter((p) => !p.isFelipe),
    [analysis],
  );
  const visibleComments = useMemo(
    () => (analysis?.comments ?? []).filter((c) => !c.isFelipe),
    [analysis],
  );

  // ============================================================
  // Handlers
  // ============================================================

  async function handleAnalyze() {
    if (!postsFile) {
      toast.error("Selecione ao menos o posts.csv");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAuthorDecisions({});
    setSelectedPosts(new Set());
    try {
      const fd = new FormData();
      fd.append("posts", postsFile);
      if (commentsFile) fd.append("comments", commentsFile);
      if (membersFile) fd.append("members", membersFile);
      if (spacesFile) fd.append("spaces", spacesFile);

      const res = await fetch("/api/admin/import/community/analyze", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!data.ok) {
        toast.error(data.error ?? "Falha na análise");
        return;
      }
      setAnalysis(data);

      // Inicializa decisões com defaults (todas SKIP — admin marca o que quer)
      const decisions: Record<string, AuthorDecisionState> = {};
      for (const a of data.authors ?? []) {
        if (a.isFelipe) continue;
        decisions[a.authorMemberId] = {
          action: "skip",
          userId: a.matchedUserId ?? undefined,
          email: a.email ?? "",
          fullName: a.authorName,
        };
      }
      setAuthorDecisions(decisions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setAnalyzing(false);
    }
  }

  function setAuthorAction(authorMemberId: string, action: AuthorAction) {
    setAuthorDecisions((prev) => ({
      ...prev,
      [authorMemberId]: { ...prev[authorMemberId], action },
    }));
  }

  function setAuthorField(
    authorMemberId: string,
    field: "email" | "fullName" | "userId",
    value: string,
  ) {
    setAuthorDecisions((prev) => ({
      ...prev,
      [authorMemberId]: { ...prev[authorMemberId], [field]: value },
    }));
  }

  function acceptAllMatches() {
    setAuthorDecisions((prev) => {
      const next = { ...prev };
      for (const a of visibleAuthors) {
        if (a.matchedUserId) {
          next[a.authorMemberId] = {
            ...next[a.authorMemberId],
            action: "use_existing",
            userId: a.matchedUserId,
          };
        }
      }
      return next;
    });
    toast.success("Matches aceitos. Revise os sem match.");
  }

  function createFictitiousForAll() {
    setAuthorDecisions((prev) => {
      const next = { ...prev };
      for (const a of visibleAuthors) {
        if (!a.matchedUserId && a.email) {
          next[a.authorMemberId] = {
            ...next[a.authorMemberId],
            action: "create_fictitious",
            email: a.email,
            fullName: a.authorName,
          };
        }
      }
      return next;
    });
    toast.success("Sem-match marcados pra criar fictício. Revise.");
  }

  function togglePost(postId: string) {
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function toggleAllPostsInSpace(spaceSlug: string, mark: boolean) {
    const idsInSpace = visiblePosts.filter((p) => p.spaceSlug === spaceSlug).map((p) => p.postId);
    setSelectedPosts((prev) => {
      const next = new Set(prev);
      for (const id of idsInSpace) {
        if (mark) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function markAllPosts() {
    setSelectedPosts(new Set(visiblePosts.map((p) => p.postId)));
  }

  function unmarkAllPosts() {
    setSelectedPosts(new Set());
  }

  /** Posts onde o autor não tem decisão válida (skip/sem userId/sem email) ficam vermelhos. */
  function isAuthorReady(authorMemberId: string): boolean {
    const d = authorDecisions[authorMemberId];
    if (!d || d.action === "skip") return false;
    if (d.action === "use_existing") return !!d.userId;
    if (d.action === "create_fictitious") return !!(d.email && d.fullName);
    return false;
  }

  async function handleRun() {
    if (selectedPosts.size === 0) {
      toast.error("Marque ao menos 1 post.");
      return;
    }
    // Valida que todo post selecionado tem autor decidido
    const blocked = visiblePosts.filter(
      (p) => selectedPosts.has(p.postId) && !isAuthorReady(p.authorMemberId),
    );
    if (blocked.length > 0) {
      toast.error(
        `${blocked.length} post(s) selecionados têm autor sem decisão. Resolva os autores primeiro.`,
      );
      return;
    }
    if (!analysis?.summary) return;

    setRunning(true);
    setResult(null);
    try {
      // Monta payload com posts selecionados e decisões dos autores envolvidos
      const involvedAuthorIds = new Set<string>();
      const postsPayload = visiblePosts
        .filter((p) => selectedPosts.has(p.postId))
        .map((p) => {
          involvedAuthorIds.add(p.authorMemberId);
          return {
            postId: p.postId,
            pageId: p.pageId!,
            title: p.title,
            htmlBody: p.htmlBody,
            authorMemberId: p.authorMemberId,
            createdAtIso: p.createdAtIso,
            likesCount: p.likesCount,
            migrateImages,
          };
        });

      // Comments dos posts selecionados (autor também precisa estar resolvido)
      const selectedPostsCircleIds = new Set(
        visiblePosts.filter((p) => selectedPosts.has(p.postId)).map((p) => p.postId),
      );
      const commentsPayload = visibleComments
        .filter((c) => selectedPostsCircleIds.has(c.postId))
        .filter((c) => isAuthorReady(c.authorMemberId))
        .map((c) => {
          involvedAuthorIds.add(c.authorMemberId);
          return {
            commentId: c.commentId,
            postId: c.postId,
            parentId: c.parentId,
            authorMemberId: c.authorMemberId,
            bodyHtml: c.bodyHtml,
            createdAtIso: c.createdAtIso,
          };
        });

      // Decisões só dos autores envolvidos
      const decisionsPayload: Record<string, { action: AuthorAction; userId?: string; email?: string; fullName?: string; avatarUrl?: string | null }> = {};
      for (const memberId of Array.from(involvedAuthorIds)) {
        const d = authorDecisions[memberId];
        if (!d) continue;
        const author = visibleAuthors.find((a) => a.authorMemberId === memberId);
        decisionsPayload[memberId] = {
          action: d.action,
          userId: d.userId,
          email: d.email,
          fullName: d.fullName,
          avatarUrl: author?.avatarUrl ?? null,
        };
      }

      const res = await fetch("/api/admin/import/community/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorDecisions: decisionsPayload,
          posts: postsPayload,
          comments: commentsPayload,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "Falha no import");
        return;
      }
      setResult(data);
      toast.success(`Importado: ${data.summary.postsCreated} posts, ${data.summary.commentsCreated} comments.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setAnalysis(null);
    setAuthorDecisions({});
    setSelectedPosts(new Set());
    setResult(null);
    setPostsFile(null);
    setCommentsFile(null);
    setMembersFile(null);
    setSpacesFile(null);
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Tela 1: upload */}
      {!analysis && (
        <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
          <h2 className="mb-3 text-sm font-bold text-npb-text">1. Suba os CSVs do Circle</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FileInput label="posts.csv (obrigatório)" file={postsFile} onChange={setPostsFile} disabled={analyzing} />
            <FileInput label="comments.csv" file={commentsFile} onChange={setCommentsFile} disabled={analyzing} />
            <FileInput label="members.csv (pra match por email)" file={membersFile} onChange={setMembersFile} disabled={analyzing} />
            <FileInput label="spaces.csv (opcional)" file={spacesFile} onChange={setSpacesFile} disabled={analyzing} />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!postsFile || analyzing}
              className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Analisar arquivos
            </button>
          </div>
        </div>
      )}

      {/* Sumário */}
      {analysis?.summary && (
        <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-npb-text">Análise</h2>
            <button
              type="button"
              onClick={reset}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs font-semibold text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Recomeçar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Posts (sem Felipe)" value={visiblePosts.length} tone="success" />
            <Stat label="Comments" value={visibleComments.length} tone="success" />
            <Stat label="Autores" value={visibleAuthors.length} />
            <Stat
              label="Autores c/ match"
              value={visibleAuthors.filter((a) => a.matchedUserId).length}
              tone="success"
            />
            <Stat
              label="Sem match"
              value={visibleAuthors.filter((a) => !a.matchedUserId).length}
              tone="warning"
            />
            <Stat label="Posts do Felipe (ignorados)" value={analysis.summary.felipePosts} />
            <Stat label="Imagens no HTML" value={analysis.summary.totalImages} />
            <Stat
              label="Spaces sem página"
              value={analysis.summary.spacesWithoutPage.length}
              tone={analysis.summary.spacesWithoutPage.length > 0 ? "danger" : "muted"}
            />
          </div>
          {analysis.summary.spacesWithoutPage.length > 0 && (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-300">
              <strong>Atenção:</strong> {analysis.summary.spacesWithoutPage.length} space(s) do Circle não têm página correspondente.
              Posts desses spaces vão falhar — crie as páginas antes (slugs:{" "}
              {analysis.summary.spacesWithoutPage.map((s) => s.slug).join(", ")}).
            </div>
          )}
        </div>
      )}

      {/* Autores */}
      {analysis?.authors && visibleAuthors.length > 0 && (
        <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-npb-text">
              2. Decida cada autor ({visibleAuthors.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={acceptAllMatches}
                disabled={running}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <UserCheck className="h-3 w-3" /> Aceitar todos matches
              </button>
              <button
                type="button"
                onClick={createFictitiousForAll}
                disabled={running}
                className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
              >
                <UserPlus className="h-3 w-3" /> Criar fictício pros sem-match
              </button>
            </div>
          </div>
          <p className="mb-3 text-[11px] text-npb-text-muted">
            Default: skipar (não importa nada do autor). Use os atalhos acima ou ajuste um a um.
          </p>
          <div className="space-y-2">
            {visibleAuthors.map((a) => {
              const d = authorDecisions[a.authorMemberId];
              const ready = isAuthorReady(a.authorMemberId);
              return (
                <AuthorRow
                  key={a.authorMemberId}
                  author={a}
                  decision={d ?? { action: "skip" }}
                  ready={ready}
                  onAction={(action) => setAuthorAction(a.authorMemberId, action)}
                  onField={(field, value) => setAuthorField(a.authorMemberId, field, value)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Posts */}
      {analysis?.posts && visiblePosts.length > 0 && (
        <div className="rounded-xl border border-npb-border bg-npb-bg2 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-npb-text">
              3. Selecione os posts ({selectedPosts.size}/{visiblePosts.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={markAllPosts}
                disabled={running}
                className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1 text-[11px] font-semibold text-npb-text hover:border-npb-gold-dim disabled:opacity-50"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={unmarkAllPosts}
                disabled={running}
                className="rounded-md border border-npb-border bg-npb-bg3 px-2 py-1 text-[11px] font-semibold text-npb-text-muted hover:text-npb-text disabled:opacity-50"
              >
                Desmarcar todos
              </button>
            </div>
          </div>
          <PostsBySpace
            posts={visiblePosts}
            selectedPosts={selectedPosts}
            onTogglePost={togglePost}
            onToggleSpace={toggleAllPostsInSpace}
            onPreview={setPreviewPost}
            isAuthorReady={isAuthorReady}
            authorDecisions={authorDecisions}
          />
        </div>
      )}

      {/* Executar */}
      {analysis && selectedPosts.size > 0 && (
        <div className="rounded-xl border border-npb-gold/30 bg-npb-gold/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-npb-text">4. Executar import</h2>
              <p className="mt-1 text-[11px] text-npb-text-muted">
                {selectedPosts.size} post(s) + comments associados + autores envolvidos.
              </p>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-npb-text-muted">
                <input
                  type="checkbox"
                  checked={migrateImages}
                  onChange={(e) => setMigrateImages(e.target.checked)}
                  className="h-3.5 w-3.5 accent-npb-gold"
                />
                <ImageIcon className="h-3 w-3" />
                Migrar imagens hospedadas no Circle pro nosso Storage
                <span className="text-npb-text-muted/60">(recomendado)</span>
              </label>
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-md bg-npb-gold px-4 py-2 text-sm font-bold text-black hover:bg-npb-gold-light disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Importar selecionados
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <h2 className="mb-2 text-sm font-bold text-emerald-400">Resultado</h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Stat label="Autores criados" value={result.summary.authorsCreated} tone="success" />
            <Stat label="Posts criados" value={result.summary.postsCreated} tone="success" />
            <Stat label="Comments criados" value={result.summary.commentsCreated} tone="success" />
            <Stat label="Falhas autores" value={result.summary.authorErrors} tone={result.summary.authorErrors > 0 ? "danger" : "muted"} />
            <Stat label="Falhas posts" value={result.summary.postErrors} tone={result.summary.postErrors > 0 ? "danger" : "muted"} />
            <Stat label="Falhas comments" value={result.summary.commentErrors} tone={result.summary.commentErrors > 0 ? "danger" : "muted"} />
          </div>
          {(result.errors.posts.length > 0 || result.errors.authors.length > 0 || result.errors.comments.length > 0) && (
            <details className="mt-3 rounded-md border border-red-500/30 bg-red-500/5">
              <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-red-400">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Ver erros
              </summary>
              <ul className="space-y-1 border-t border-red-500/30 p-3 text-[11px] text-red-300">
                {result.errors.authors.map((e, i) => (
                  <li key={`a${i}`}>Autor {e.authorMemberId}: {e.error}</li>
                ))}
                {result.errors.posts.map((e, i) => (
                  <li key={`p${i}`}>Post {e.postId}: {e.error}</li>
                ))}
                {result.errors.comments.map((e, i) => (
                  <li key={`c${i}`}>Comment {e.commentId}: {e.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Modal preview */}
      {previewPost && (
        <PreviewModal post={previewPost} onClose={() => setPreviewPost(null)} />
      )}
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function FileInput({ label, file, onChange, disabled }: { label: string; file: File | null; onChange: (f: File | null) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-npb-text-muted">{label}</label>
      <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-text">
        <Upload className="h-4 w-4" />
        <span className="flex-1 truncate">{file?.name ?? "Escolher arquivo"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
    </div>
  );
}

function AuthorRow({
  author,
  decision,
  ready,
  onAction,
  onField,
}: {
  author: AnalyzedAuthor;
  decision: AuthorDecisionState;
  ready: boolean;
  onAction: (action: AuthorAction) => void;
  onField: (field: "email" | "fullName" | "userId", value: string) => void;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        decision.action === "skip"
          ? "border-npb-border bg-npb-bg3/40"
          : ready
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-yellow-500/40 bg-yellow-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {/* Avatar + info */}
        <div className="flex items-center gap-2 min-w-[200px] flex-1">
          {author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-npb-bg3 text-xs font-bold text-npb-gold">
              {author.authorName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-npb-text">
              {author.authorName}
              {author.matchedUserId && (
                <span title="Aluno já existe no banco" className="rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold text-emerald-400">
                  MATCH
                </span>
              )}
            </div>
            <div className="text-[11px] text-npb-text-muted">
              {author.email ?? "(sem email)"} · {author.postsCount} posts · {author.commentsCount} comments
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-1">
          <ActionBtn current={decision.action} value="use_existing" onClick={() => onAction("use_existing")} disabled={!author.matchedUserId}>
            <UserCheck className="h-3 w-3" /> Vincular
          </ActionBtn>
          <ActionBtn current={decision.action} value="create_fictitious" onClick={() => onAction("create_fictitious")}>
            <UserPlus className="h-3 w-3" /> Fictício
          </ActionBtn>
          <ActionBtn current={decision.action} value="skip" onClick={() => onAction("skip")}>
            <X className="h-3 w-3" /> Skipar
          </ActionBtn>
        </div>
      </div>

      {/* Detalhes da ação */}
      {decision.action === "use_existing" && author.matchedUserId && (
        <p className="mt-2 text-[11px] text-emerald-400">
          → Posts entram como <strong>{author.matchedUserFullName ?? "(aluno)"}</strong> ({author.email})
        </p>
      )}
      {decision.action === "create_fictitious" && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-npb-text-muted">Nome</label>
            <input
              type="text"
              value={decision.fullName ?? ""}
              onChange={(e) => onField("fullName", e.target.value)}
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-npb-text-muted">Email</label>
            <input
              type="email"
              value={decision.email ?? ""}
              onChange={(e) => onField("email", e.target.value)}
              className="w-full rounded-md border border-npb-border bg-npb-bg2 px-2 py-1 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ current, value, onClick, disabled, children }: { current: AuthorAction; value: AuthorAction; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition disabled:opacity-30 ${
        active
          ? "bg-npb-gold text-black"
          : "border border-npb-border bg-npb-bg3 text-npb-text-muted hover:border-npb-gold-dim hover:text-npb-gold"
      }`}
    >
      {children}
    </button>
  );
}

function PostsBySpace({
  posts,
  selectedPosts,
  onTogglePost,
  onToggleSpace,
  onPreview,
  isAuthorReady,
  authorDecisions,
}: {
  posts: AnalyzedPost[];
  selectedPosts: Set<string>;
  onTogglePost: (id: string) => void;
  onToggleSpace: (slug: string, mark: boolean) => void;
  onPreview: (p: AnalyzedPost) => void;
  isAuthorReady: (memberId: string) => boolean;
  authorDecisions: Record<string, AuthorDecisionState>;
}) {
  // Agrupa por space
  const groups = useMemo(() => {
    const map = new Map<string, AnalyzedPost[]>();
    for (const p of posts) {
      const arr = map.get(p.spaceSlug) ?? [];
      arr.push(p);
      map.set(p.spaceSlug, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);

  return (
    <div className="space-y-3">
      {groups.map(([slug, items]) => {
        const selectedInSpace = items.filter((p) => selectedPosts.has(p.postId)).length;
        return (
          <div key={slug} className="rounded-md border border-npb-border">
            <div className="flex items-center justify-between border-b border-npb-border bg-npb-bg3 px-3 py-2">
              <div className="text-xs font-bold text-npb-text">
                {items[0].spaceName}{" "}
                <span className="font-normal text-npb-text-muted">
                  ({selectedInSpace}/{items.length})
                </span>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => onToggleSpace(slug, true)} className="text-[10px] font-semibold text-npb-gold hover:underline">
                  marcar todos
                </button>
                <span className="text-[10px] text-npb-text-muted">·</span>
                <button type="button" onClick={() => onToggleSpace(slug, false)} className="text-[10px] font-semibold text-npb-text-muted hover:text-npb-text">
                  limpar
                </button>
              </div>
            </div>
            <ul className="divide-y divide-npb-border/50">
              {items.map((p) => {
                const ready = isAuthorReady(p.authorMemberId);
                const dec = authorDecisions[p.authorMemberId];
                return (
                  <li key={p.postId} className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-npb-bg3/30">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(p.postId)}
                      disabled={!ready}
                      onChange={() => onTogglePost(p.postId)}
                      className="mt-1 h-3.5 w-3.5 accent-npb-gold disabled:opacity-30"
                      title={!ready ? "Decida o autor primeiro" : ""}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onPreview(p)}
                        className="block text-left font-medium text-npb-text hover:text-npb-gold"
                      >
                        {p.title}
                      </button>
                      <div className="text-[10px] text-npb-text-muted">
                        <span className={ready ? "text-emerald-400" : "text-yellow-400"}>
                          {p.authorName}
                          {ready
                            ? dec?.action === "use_existing"
                              ? " ✓ vinculado"
                              : " ✓ fictício"
                            : " ⚠ sem decisão"}
                        </span>
                        {" · "}
                        {p.createdAtIso ? new Date(p.createdAtIso).toLocaleDateString("pt-BR") : "?"}
                        {" · "}
                        👍 {p.likesCount} · 💬 {p.commentsCount}
                        {p.imagesCount > 0 && ` · 🖼 ${p.imagesCount}`}
                      </div>
                      {p.bodyPreview && (
                        <div className="mt-0.5 line-clamp-1 text-[10px] text-npb-text-muted/80">{p.bodyPreview}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PreviewModal({ post, onClose }: { post: AnalyzedPost; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-npb-border bg-npb-bg2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase text-npb-gold">{post.spaceName}</div>
            <h3 className="text-base font-bold text-npb-text">{post.title}</h3>
            <p className="text-[11px] text-npb-text-muted">
              {post.authorName} · {post.createdAtIso ? new Date(post.createdAtIso).toLocaleString("pt-BR") : "?"} · 👍 {post.likesCount} · 💬 {post.commentsCount}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-npb-bg3">
            <X className="h-4 w-4 text-npb-text-muted" />
          </button>
        </div>
        <div
          className="prose prose-sm prose-invert max-w-none text-sm text-npb-text"
          dangerouslySetInnerHTML={{ __html: post.htmlBody }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: number; tone?: "success" | "warning" | "danger" | "muted" }) {
  const colors: Record<typeof tone, string> = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
    danger: "border-red-500/30 bg-red-500/5 text-red-400",
    muted: "border-npb-border bg-npb-bg3/40 text-npb-text-muted",
  };
  return (
    <div className={`rounded-md border p-2 ${colors[tone]}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-npb-text">{value}</div>
    </div>
  );
}
