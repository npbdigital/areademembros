import { redirect } from "next/navigation";
import { Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CommunityIndex() {
  const supabase = createClient();
  const { data } = await supabase
    .schema("membros")
    .from("community_galleries")
    .select("slug")
    .eq("is_active", true)
    .not("slug", "is", null)
    .order("position", { ascending: true })
    .limit(1);

  const first = (data?.[0] as { slug: string } | undefined)?.slug;

  if (first) {
    redirect(`/community/${first}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-dashed border-npb-border bg-npb-bg2/50 p-8 text-center">
        <Smile className="mx-auto h-10 w-10 text-npb-text-muted" />
        <h1 className="mt-4 text-lg font-bold text-npb-text">
          Comunidade vazia
        </h1>
        <p className="mt-2 text-sm text-npb-text-muted">
          Os espaços ainda não foram criados. Volte em breve.
        </p>
      </div>
    </div>
  );
}
