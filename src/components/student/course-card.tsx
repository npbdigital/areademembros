import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface BaseProps {
  title: string;
  coverUrl: string | null;
}

interface OwnedCourseCardProps extends BaseProps {
  courseId: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  /** Quando definido, o card abre direto na última aula assistida (com vídeo). */
  resumeLessonId?: string | null;
}

export function OwnedCourseCard({
  courseId,
  title,
  coverUrl,
  progress,
  totalLessons,
  completedLessons,
  resumeLessonId,
}: OwnedCourseCardProps) {
  const href = resumeLessonId
    ? `/lessons/${resumeLessonId}`
    : `/courses/${courseId}`;
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
    >
      <CoverImage coverUrl={coverUrl} title={title} />
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-npb-text">
          {title}
        </h3>
        <div className="mt-3 flex items-center justify-between text-xs text-npb-text-muted">
          <span>
            {completedLessons}/{totalLessons} aulas
          </span>
          <span className="font-semibold text-npb-gold">{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-npb-bg4">
          <div
            className="h-full bg-npb-gold-gradient"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

interface SaleCourseCardProps extends BaseProps {
  saleUrl: string | null;
}

export function SaleCourseCard({ title, coverUrl, saleUrl }: SaleCourseCardProps) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    saleUrl ? (
      <a
        href={saleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 transition hover:border-npb-gold/60 hover:shadow-npb-card-hover"
      >
        {children}
      </a>
    ) : (
      <div className="block overflow-hidden rounded-xl border border-npb-border bg-npb-bg2 opacity-70">
        {children}
      </div>
    );

  return (
    <Wrapper>
      <CoverImage coverUrl={coverUrl} title={title} />
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-npb-text">
          {title}
        </h3>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-npb-gold">
          {saleUrl ? (
            <>
              Saiba mais
              <ExternalLink className="h-3.5 w-3.5" />
            </>
          ) : (
            <span className="text-npb-text-muted">Em breve</span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

function CoverImage({
  coverUrl,
  title,
}: {
  coverUrl: string | null;
  title: string;
}) {
  return (
    <div className="relative aspect-[5/7] w-full overflow-hidden bg-npb-bg3">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-npb-text-muted">
          Sem capa
        </div>
      )}
    </div>
  );
}
