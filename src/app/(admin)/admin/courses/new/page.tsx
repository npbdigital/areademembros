import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CourseForm } from "@/components/admin/course-form";
import { createCourseAction } from "../actions";

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/courses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-npb-text-muted hover:text-npb-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para a lista
      </Link>
      <h1 className="mb-1 text-xl font-bold text-npb-text">Novo curso</h1>
      <p className="mb-6 text-sm text-npb-text-muted">
        Preencha o básico aqui. Módulos, aulas e drip você configura depois,
        dentro do curso.
      </p>

      <div className="rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <CourseForm
          action={createCourseAction}
          submitLabel="Criar curso"
          pendingLabel="Criando..."
        />
      </div>
    </div>
  );
}
