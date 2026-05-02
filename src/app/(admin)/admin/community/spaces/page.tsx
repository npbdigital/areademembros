import Link from "next/link";
import { ArrowLeft, GalleryHorizontal } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { GalleryListEditor } from "@/components/admin/community/gallery-list-editor";

export const dynamic = "force-dynamic";

export default async function CommunitySpacesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .schema("membros")
    .from("community_galleries")
    .select("id, title, slug, icon, description, position, is_active")
    .order("position", { ascending: true });

  const items = (data ?? []) as Array<{
    id: string;
    title: string;
    slug: string | null;
    icon: string | null;
    description: string | null;
    position: number;
    is_active: boolean;
  }>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/community"
          className="inline-flex items-center gap-1 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <h1 className="mt-3 inline-flex items-center gap-2 text-xl font-bold text-npb-text">
          <GalleryHorizontal className="h-5 w-5 text-npb-gold" />
          Espaços da comunidade
        </h1>
        <p className="text-sm text-npb-text-muted">
          Galerias visíveis na sidebar da comunidade. Marque &quot;ativo&quot; pra
          exibir aos alunos.
        </p>
      </div>

      <GalleryListEditor items={items} />
    </div>
  );
}
