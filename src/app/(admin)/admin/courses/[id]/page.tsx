import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GalleryHorizontalEnd, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CourseForm } from "@/components/admin/course-form";
import { AddChildForm } from "@/components/admin/add-child-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { BannerForm } from "@/components/admin/banner-form";
import {
  SortableModulesList,
  type SortableModule,
} from "@/components/admin/sortable-modules-list";
import { SortableBannersList } from "@/components/admin/sortable-banners-list";
import {
  createBannerAction,
  createModuleAction,
  deleteCourseAction,
  updateCourseAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const courseId = params.id;

  const { data: course } = await supabase
    .schema("membros")
    .from("courses")
    .select(
      "id, title, description, cover_url, is_published, is_for_sale, sale_url",
    )
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  const { data: modules } = await supabase
    .schema("membros")
    .from("modules")
    .select("id, title, position, release_type, cover_url")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  // Conta aulas por módulo
  const moduleIds = (modules ?? []).map((m) => m.id);
  const lessonCounts: Record<string, number> = {};
  if (moduleIds.length > 0) {
    const { data: lessons } = await supabase
      .schema("membros")
      .from("lessons")
      .select("module_id")
      .in("module_id", moduleIds);
    for (const l of lessons ?? []) {
      lessonCounts[l.module_id] = (lessonCounts[l.module_id] ?? 0) + 1;
    }
  }

  // Banners do curso
  const { data: banners } = await supabase
    .schema("membros")
    .from("banners")
    .select("id, image_url, link_url, link_target, is_active, position")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  const updateAction = updateCourseAction.bind(null, courseId);
  const deleteAction = deleteCourseAction.bind(null, courseId);
  const createModule = createModuleAction.bind(null, courseId);
  const createBanner = createBannerAction.bind(null, courseId);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para a lista
        </Link>
        <DeleteButton
          action={deleteAction}
          confirmMessage={`Excluir o curso "${course.title}"? Todos os módulos e aulas dentro dele também serão removidos. Não dá pra desfazer.`}
          label="Excluir curso"
        />
      </div>

      {/* Detalhes do curso */}
      <section>
        <h1 className="mb-1 text-xl font-bold text-npb-text">
          {course.title}
        </h1>
        <p className="mb-6 text-sm text-npb-text-muted">
          Edite os detalhes principais. Módulos e aulas ficam logo abaixo.
        </p>
        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
          <CourseForm
            action={updateAction}
            initialValues={course}
            submitLabel="Salvar alterações"
            successMessage="Curso atualizado."
          />
        </div>
      </section>

      {/* Módulos */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Módulos</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {modules?.length ?? 0}
          </span>
        </div>

        <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          <div className="mb-4">
            <AddChildForm
              action={createModule}
              placeholder="Título do novo módulo"
              buttonLabel="Adicionar módulo"
            />
          </div>

          {modules && modules.length > 0 ? (
            <SortableModulesList
              courseId={courseId}
              modules={modules as SortableModule[]}
              lessonCounts={lessonCounts}
            />
          ) : (
            <p className="px-2 py-6 text-center text-sm text-npb-text-muted">
              Nenhum módulo ainda. Adicione o primeiro acima.
            </p>
          )}
        </div>
      </section>

      {/* Banners */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <GalleryHorizontalEnd className="h-5 w-5 text-npb-gold" />
          <h2 className="text-lg font-bold text-npb-text">Banners</h2>
          <span className="rounded bg-npb-bg3 px-2 py-0.5 text-xs text-npb-text-muted">
            {banners?.length ?? 0}
          </span>
        </div>
        <p className="mb-4 text-xs text-npb-text-muted">
          Aparecem em carousel acima da grade de módulos pros alunos
          matriculados nesse curso.
        </p>

        <div className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-4">
          <details className="rounded-lg border border-npb-border bg-npb-bg3 p-4">
            <summary className="cursor-pointer text-sm font-medium text-npb-text">
              + Adicionar banner
            </summary>
            <div className="mt-4">
              <BannerForm
                action={createBanner}
                submitLabel="Adicionar banner"
                successMessage="Banner adicionado."
                resetOnSuccess
              />
            </div>
          </details>

          {banners && banners.length > 0 ? (
            <SortableBannersList
              courseId={courseId}
              banners={banners.map((b) => ({
                id: b.id,
                image_url: b.image_url,
                link_url: b.link_url,
                link_target: b.link_target,
                is_active: b.is_active,
                position: b.position,
              }))}
            />
          ) : (
            <p className="py-4 text-center text-sm text-npb-text-muted">
              Nenhum banner ainda. Adicione o primeiro acima.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

