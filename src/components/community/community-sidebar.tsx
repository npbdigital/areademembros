"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/emoji-picker";
import type {
  CommunityPageRow,
  CommunitySidebarLinkRow,
  CommunitySpaceRow,
} from "@/lib/community";
import {
  createPageAction,
  createSidebarLinkAction,
  createSpaceAction,
  deletePageAction,
  deleteSidebarLinkAction,
  deleteSpaceAction,
  updatePageAction,
  updateSpaceAction,
} from "@/app/(admin)/admin/community/actions";

interface Props {
  spaces: CommunitySpaceRow[];
  pages: CommunityPageRow[];
  links: CommunitySidebarLinkRow[];
  unreadByPage?: Record<string, number>;
  /** Quando true, mostra controles inline pra criar/editar/excluir */
  canManage?: boolean;
}

export function CommunitySidebar({
  spaces,
  pages,
  links,
  unreadByPage = {},
  canManage = false,
}: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  // agrupa páginas por space_id
  const pagesBySpace = new Map<string | null, CommunityPageRow[]>();
  for (const p of pages) {
    const arr = pagesBySpace.get(p.space_id) ?? [];
    arr.push(p);
    pagesBySpace.set(p.space_id, arr);
  }
  const orphanPages = pagesBySpace.get(null) ?? [];

  return (
    <aside className="flex h-full w-full flex-col border-r border-npb-border bg-npb-bg2 md:w-64 md:min-w-64">
      {/* Voltar ao menu principal — visível em mobile (no drawer) e desktop
          (a StudentSidebar é escondida em /community) */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 border-b border-npb-border bg-npb-bg3 px-4 py-2.5 text-xs text-npb-text-muted transition-colors hover:bg-npb-bg4 hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao menu principal
      </Link>

      <div className="border-b border-npb-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Smile className="h-5 w-5 text-npb-gold" />
          <h2 className="text-sm font-bold text-npb-text">Comunidade</h2>
        </div>
        <form
          action={query ? `/community/search?q=${encodeURIComponent(query)}` : undefined}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-npb-text-muted" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full rounded-md border border-npb-border bg-npb-bg3 py-1.5 pl-8 pr-3 text-xs text-npb-text outline-none placeholder:text-npb-text-muted/60 focus:border-npb-gold-dim"
          />
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto npb-scrollbar p-3">
        {/* FEED — atalho fixo no topo */}
        <Link
          href="/community/feed"
          className={cn(
            "mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
            pathname === "/community/feed"
              ? "bg-npb-gold text-black"
              : "bg-npb-gold/15 text-npb-gold hover:bg-npb-gold/25",
          )}
        >
          <LayoutList className="h-4 w-4" />
          Feed
        </Link>

        {/* ESPAÇOS COM PÁGINAS */}
        {spaces.map((s) => {
          const spacePages = pagesBySpace.get(s.id) ?? [];
          return (
            <SpaceGroup
              key={s.id}
              space={s}
              pages={spacePages}
              pathname={pathname}
              unreadByPage={unreadByPage}
              canManage={canManage}
            />
          );
        })}

        {/* PÁGINAS ÓRFÃS (sem espaço atribuído) */}
        {orphanPages.length > 0 && (
          <SpaceGroup
            space={null}
            pages={orphanPages}
            pathname={pathname}
            unreadByPage={unreadByPage}
            canManage={canManage}
          />
        )}

        {canManage && (
          <CreateSpaceButton />
        )}

        {/* LINKS / ATALHOS */}
        {(links.length > 0 || canManage) && (
          <>
            <div className="my-4 border-t border-npb-border" />
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-npb-text-muted">
                Links
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {links.map((l) => (
                <SidebarLinkRow key={l.id} link={l} canManage={canManage} />
              ))}
              {canManage && <CreateLinkButton />}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}

function SpaceGroup({
  space,
  pages,
  pathname,
  unreadByPage,
  canManage,
}: {
  space: CommunitySpaceRow | null;
  pages: CommunityPageRow[];
  pathname: string;
  unreadByPage: Record<string, number>;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);

  return (
    <div className="mb-3">
      <div className="group flex items-center gap-1 px-2 py-1.5 text-sm font-bold text-npb-text">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 hover:text-npb-gold"
          disabled={!space}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="truncate">{space?.title ?? "Sem espaço"}</span>
        </button>
        {canManage && space && (
          <SpaceActions space={space} onEdit={() => setEditing(true)} />
        )}
      </div>

      {editing && space && (
        <EditSpaceForm space={space} onClose={() => setEditing(false)} />
      )}

      {open && (
        <div className="flex flex-col gap-0.5">
          {pages.map((p) => {
            const href = p.slug ? `/community/${p.slug}` : "#";
            const active = p.slug
              ? pathname === href || pathname.startsWith(`${href}/`)
              : false;
            const unread = unreadByPage[p.id] ?? 0;
            return (
              <PageRow
                key={p.id}
                page={p}
                active={active}
                href={href}
                unread={unread}
                canManage={canManage}
              />
            );
          })}
          {canManage && <CreatePageButton spaceId={space?.id ?? null} />}
        </div>
      )}
    </div>
  );
}

function PageRow({
  page,
  active,
  href,
  unread,
  canManage,
}: {
  page: CommunityPageRow;
  active: boolean;
  href: string;
  unread: number;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <EditPageForm page={page} onClose={() => setEditing(false)} />;
  }

  return (
    <div className="group relative">
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-npb-gold/15 text-npb-gold"
            : "text-npb-text-muted hover:bg-npb-bg3 hover:text-npb-text",
        )}
      >
        <span className="text-base leading-none">{page.icon ?? "💬"}</span>
        <span className="flex-1 truncate">{page.title}</span>
        {unread > 0 && (
          <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
      {canManage && (
        <PageActions page={page} onEdit={() => setEditing(true)} />
      )}
    </div>
  );
}

function SidebarLinkRow({
  link,
  canManage,
}: {
  link: CommunitySidebarLinkRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Remover atalho "${link.label}"?`)) return;
    startTransition(async () => {
      const res = await deleteSidebarLinkAction(link.id);
      if (res.ok) {
        toast.success("Atalho removido.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="group relative">
      <a
        href={link.url}
        target={link.open_in_new_tab ? "_blank" : "_self"}
        rel={link.open_in_new_tab ? "noopener noreferrer" : undefined}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-npb-text-muted transition-colors hover:bg-npb-bg3 hover:text-npb-text"
      >
        <span className="text-base leading-none">{link.icon ?? "🔗"}</span>
        <span className="flex-1 truncate">{link.label}</span>
        {link.open_in_new_tab && (
          <ExternalLink className="h-3 w-3 opacity-50" />
        )}
      </a>
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-npb-text-muted hover:bg-red-500/10 hover:text-red-400 group-hover:block"
          title="Remover"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================
// ADMIN INLINE FORMS / MENUS
// ============================================================

function SpaceActions({
  space,
  onEdit,
}: {
  space: CommunitySpaceRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  function handleDelete() {
    if (
      !confirm(
        `Excluir espaço "${space.title}"? Páginas ficam órfãs (sem espaço).`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteSpaceAction(space.id);
      if (res.ok) {
        toast.success("Espaço excluído.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        className="rounded p-0.5 text-npb-text-muted opacity-0 transition group-hover:opacity-100 hover:bg-npb-bg3 hover:text-npb-text"
        title="Opções"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {openMenu && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-md border border-npb-border bg-npb-bg3 py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-npb-text hover:bg-npb-bg4"
          >
            <Pencil className="h-3 w-3" />
            Renomear
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              handleDelete();
            }}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function PageActions({
  page,
  onEdit,
}: {
  page: CommunityPageRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  function handleDelete() {
    if (!confirm(`Excluir página "${page.title}"? Posts dela serão deletados.`))
      return;
    startTransition(async () => {
      const res = await deletePageAction(page.id);
      if (res.ok) {
        toast.success("Página excluída.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpenMenu((v) => !v);
        }}
        className="hidden rounded p-1 text-npb-text-muted hover:bg-npb-bg4 hover:text-npb-text group-hover:block"
        title="Opções"
      >
        <MoreHorizontal className="h-3 w-3" />
      </button>
      {openMenu && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-md border border-npb-border bg-npb-bg3 py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-npb-text hover:bg-npb-bg4"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              handleDelete();
            }}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function CreateSpaceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title", title.trim());
      const res = await createSpaceAction(null, fd);
      if (res.ok) {
        setTitle("");
        setOpen(false);
        toast.success("Espaço criado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 flex w-full items-center gap-2 rounded-md border border-dashed border-npb-border px-3 py-1.5 text-xs text-npb-text-muted transition hover:border-npb-gold-dim hover:text-npb-gold"
      >
        <Plus className="h-3 w-3" />
        Adicionar espaço
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 flex items-center gap-1.5">
      <input
        type="text"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nome do espaço"
        className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-md bg-npb-gold px-2 py-1 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3"
      >
        <X className="h-3 w-3" />
      </button>
    </form>
  );
}

function EditSpaceForm({
  space,
  onClose,
}: {
  space: CommunitySpaceRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(space.title);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title", title.trim());
      const res = await updateSpaceAction(space.id, null, fd);
      if (res.ok) {
        toast.success("Salvo.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mb-2 flex items-center gap-1.5 px-2">
      <input
        type="text"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-npb-gold px-2 py-1 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3"
      >
        <X className="h-3 w-3" />
      </button>
    </form>
  );
}

function CreatePageButton({ spaceId }: { spaceId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("💬");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("icon", icon || "💬");
      if (spaceId) fd.append("space_id", spaceId);
      const res = await createPageAction(null, fd);
      if (res.ok) {
        setTitle("");
        setOpen(false);
        toast.success("Página criada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-npb-text-muted transition hover:bg-npb-bg3 hover:text-npb-gold"
      >
        <Plus className="h-3 w-3" />
        Adicionar página
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex items-center gap-1.5 px-2">
      <EmojiPicker value={icon} onChange={setIcon} size={32} />
      <input
        type="text"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nome da página"
        className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-md bg-npb-gold px-2 py-1 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3"
      >
        <X className="h-3 w-3" />
      </button>
    </form>
  );
}

function EditPageForm({
  page,
  onClose,
}: {
  page: CommunityPageRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(page.icon ?? "💬");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("icon", icon || "💬");
      if (page.space_id) fd.append("space_id", page.space_id);
      if (page.slug) fd.append("slug", page.slug);
      if (page.description) fd.append("description", page.description);
      const res = await updatePageAction(page.id, null, fd);
      if (res.ok) {
        toast.success("Salvo.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5 px-2 py-1">
      <EmojiPicker value={icon} onChange={setIcon} size={32} />
      <input
        type="text"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-npb-gold px-2 py-1 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3"
      >
        <X className="h-3 w-3" />
      </button>
    </form>
  );
}

function CreateLinkButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("🔗");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("label", label.trim());
      fd.append("url", url.trim());
      fd.append("icon", icon || "🔗");
      const res = await createSidebarLinkAction(null, fd);
      if (res.ok) {
        setLabel("");
        setUrl("");
        setOpen(false);
        toast.success("Atalho adicionado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-npb-text-muted transition hover:bg-npb-bg3 hover:text-npb-gold"
      >
        <Plus className="h-3 w-3" />
        Adicionar link
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5 px-2">
      <div className="flex items-center gap-1.5">
        <EmojiPicker value={icon} onChange={setIcon} size={32} />
        <input
          type="text"
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 rounded-md border border-npb-border bg-npb-bg3 px-2 py-1.5 text-xs text-npb-text outline-none focus:border-npb-gold-dim"
        />
        <button
          type="submit"
          disabled={pending || !label.trim() || !url.trim()}
          className="rounded-md bg-npb-gold px-2 py-1 text-xs font-semibold text-black hover:bg-npb-gold-light disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-npb-text-muted hover:bg-npb-bg3"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </form>
  );
}
