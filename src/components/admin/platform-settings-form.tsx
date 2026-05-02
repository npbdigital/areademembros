"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, Film, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { CoverUpload } from "@/components/admin/cover-upload";
import { VideoPicker, type VideoPick } from "@/components/admin/video-picker";
import {
  type ActionResult,
  updatePlatformSettingsAction,
} from "@/app/(admin)/admin/settings/actions";

export interface PlatformSettingsFormValues {
  platformName: string;
  platformLogoUrl: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  welcomeEnabled: boolean;
  welcomeTitle: string;
  welcomeDescription: string;
  welcomeVideoId: string | null;
  welcomeTerms: string;
  welcomeButtonLabel: string;
  communityAutoApprove: boolean;
  communityMaxImageMb: number;
  communityMaxCommentChars: number;
  gamificationEnabled: boolean;
  xpLessonComplete: number;
  xpStreak7d: number;
  xpFirstAccessDay: number;
  xpLessonRated: number;
  xpCommentApproved: number;
  xpPostApproved: number;
  xpCourseCompleted: number;
  leaderboardVisibleToAdmin: boolean;
  leaderboardVisibleToModerator: boolean;
  leaderboardVisibleToStudent: boolean;
}

export function PlatformSettingsForm({
  initialValues: init,
}: {
  initialValues: PlatformSettingsFormValues;
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    updatePlatformSettingsAction,
    null,
  );

  const [welcomeVideo, setWelcomeVideo] = useState<{
    videoId: string;
    title?: string;
    thumbnail?: string;
  } | null>(
    init.welcomeVideoId
      ? {
          videoId: init.welcomeVideoId,
          thumbnail: `https://i.ytimg.com/vi/${init.welcomeVideoId}/mqdefault.jpg`,
        }
      : null,
  );

  // Quando o form carrega só com videoId (sem title), busca o título no
  // YouTube pra mostrar pro admin saber qual vídeo está vinculado.
  useEffect(() => {
    if (!welcomeVideo?.videoId || welcomeVideo.title) return;
    let cancelled = false;
    fetch(
      `/api/youtube/video-details?videoId=${encodeURIComponent(welcomeVideo.videoId)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.video?.title) {
          setWelcomeVideo((prev) =>
            prev && prev.videoId === data.video.videoId
              ? {
                  ...prev,
                  title: data.video.title,
                  thumbnail: data.video.thumbnail ?? prev.thumbnail,
                }
              : prev,
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [welcomeVideo?.videoId, welcomeVideo?.title]);

  function handlePickWelcomeVideo(v: VideoPick) {
    setWelcomeVideo({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* IDENTIDADE */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Identidade
        </legend>

        <div className="space-y-1.5">
          <Label htmlFor="platform_name" className="text-npb-text">
            Nome da plataforma <span className="text-npb-gold">*</span>
          </Label>
          <Input
            id="platform_name"
            name="platform_name"
            defaultValue={init.platformName}
            required
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
          <p className="text-xs text-npb-text-muted">
            Aparece no título da janela, e-mails e topbar.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-npb-text">Logo</Label>
          <CoverUpload
            name="platform_logo_url"
            defaultValue={init.platformLogoUrl}
            recommendedWidth={400}
            recommendedHeight={120}
            label="Logo da plataforma"
          />
          <p className="text-xs text-npb-text-muted">
            Formato horizontal, ~400×120 px. Aplicado automaticamente quando
            preenchido (em breve).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="primary_color" className="text-npb-text">
            Cor primária <span className="text-[10px] text-npb-text-muted">(em breve)</span>
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="primary_color"
              name="primary_color"
              defaultValue={init.primaryColor ?? "#c9922a"}
              className="h-10 w-16 cursor-pointer rounded-md border border-npb-border bg-npb-bg3"
            />
            <Input
              defaultValue={init.primaryColor ?? "#c9922a"}
              readOnly
              className="bg-npb-bg3 border-npb-border text-npb-text font-mono"
              onFocus={(e) => e.currentTarget.blur()}
            />
          </div>
          <p className="text-xs text-npb-text-muted">
            Salva o valor mas ainda não aplica em runtime — depende de refator
            do design system pra usar CSS vars.
          </p>
        </div>
      </fieldset>

      {/* E-MAIL */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          E-mail (Resend)
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email_from_name" className="text-npb-text">
              Nome do remetente
            </Label>
            <Input
              id="email_from_name"
              name="email_from_name"
              defaultValue={init.emailFromName ?? ""}
              placeholder="Academia NPB"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email_from_address" className="text-npb-text">
              E-mail do remetente
            </Label>
            <Input
              id="email_from_address"
              name="email_from_address"
              type="email"
              defaultValue={init.emailFromAddress ?? ""}
              placeholder="noreply@seudominio.com.br"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
        </div>
        <p className="text-xs text-npb-text-muted">
          O domínio precisa estar verificado no Resend (Domains → SPF/DKIM
          aplicados no DNS). Enquanto não preencher, os e-mails saem do default
          do Resend (`onboarding@resend.dev`), que só envia pro dono da conta.
        </p>
      </fieldset>

      {/* SUPORTE */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Suporte
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="support_email" className="text-npb-text">
              E-mail de suporte
            </Label>
            <Input
              id="support_email"
              name="support_email"
              type="email"
              defaultValue={init.supportEmail ?? ""}
              placeholder="suporte@seudominio.com.br"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
            <p className="text-[11px] text-npb-text-muted">
              Recebe os pedidos de suporte enviados pelos alunos.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support_whatsapp" className="text-npb-text">
              WhatsApp de suporte
            </Label>
            <Input
              id="support_whatsapp"
              name="support_whatsapp"
              defaultValue={init.supportWhatsapp ?? ""}
              placeholder="+5548988757616"
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
            <p className="text-[11px] text-npb-text-muted">
              Só dígitos com DDI (será usado em https://wa.me/...).
            </p>
          </div>
        </div>
      </fieldset>

      {/* BOAS-VINDAS (PRIMEIRO ACESSO) */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Pop-up de boas-vindas (primeiro acesso)
        </legend>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
          <input
            type="checkbox"
            name="welcome_enabled"
            defaultChecked={init.welcomeEnabled}
            className="mt-0.5 h-4 w-4 accent-npb-gold"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-npb-text">Ativo</div>
            <div className="text-xs text-npb-text-muted">
              Quando ligado, o aluno vê esse popup na primeira vez que acessar
              a plataforma. Após ele clicar em concordar, nunca mais aparece.
            </div>
          </div>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_title" className="text-npb-text">
            Título do popup
          </Label>
          <Input
            id="welcome_title"
            name="welcome_title"
            defaultValue={init.welcomeTitle}
            placeholder="Bem-vindo!"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_description" className="text-npb-text">
            Descrição (mensagem curta)
          </Label>
          <textarea
            id="welcome_description"
            name="welcome_description"
            defaultValue={init.welcomeDescription}
            rows={3}
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-npb-text">Vídeo de boas-vindas (opcional)</Label>
          <input
            type="hidden"
            name="welcome_video_id"
            value={welcomeVideo?.videoId ?? ""}
          />

          {welcomeVideo ? (
            <div className="flex gap-3 rounded-md border border-npb-gold-dim/50 bg-npb-bg3 p-3">
              <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded bg-black">
                {welcomeVideo.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={welcomeVideo.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center min-w-0">
                {welcomeVideo.title && (
                  <span className="line-clamp-2 text-sm font-medium text-npb-text">
                    {welcomeVideo.title}
                  </span>
                )}
                <span className="font-mono text-xs text-npb-text-muted">
                  {welcomeVideo.videoId}
                </span>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1.5">
                <VideoPicker
                  currentVideoId={welcomeVideo.videoId}
                  onPick={handlePickWelcomeVideo}
                />
                <button
                  type="button"
                  onClick={() => setWelcomeVideo(null)}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-xs text-npb-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-3 w-3" /> Remover
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-npb-border bg-npb-bg3 p-3">
              <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center rounded bg-npb-bg4 text-npb-text-muted">
                <Film className="h-5 w-5 opacity-50" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs text-npb-text-muted">
                  Nenhum vídeo selecionado.
                </span>
                <VideoPicker onPick={handlePickWelcomeVideo} />
              </div>
            </div>
          )}
          <p className="text-[11px] text-npb-text-muted">
            Quando selecionado, o player aparece no topo do popup de boas-vindas.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_terms" className="text-npb-text">
            Termos de uso / aceite
          </Label>
          <textarea
            id="welcome_terms"
            name="welcome_terms"
            defaultValue={init.welcomeTerms}
            rows={8}
            placeholder="Cole aqui o texto dos termos. Pode ser longo — vai ter scroll."
            className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim focus:ring-1 focus:ring-npb-gold-dim"
          />
          <p className="text-[11px] text-npb-text-muted">
            Texto exibido em uma área scrollável dentro do popup, acima do
            botão de aceite.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="welcome_button_label" className="text-npb-text">
            Texto do botão de aceite
          </Label>
          <Input
            id="welcome_button_label"
            name="welcome_button_label"
            defaultValue={init.welcomeButtonLabel}
            placeholder="Eu concordo com os termos"
            className="bg-npb-bg3 border-npb-border text-npb-text"
          />
        </div>
      </fieldset>

      {/* COMUNIDADE */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Comunidade
        </legend>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
          <input
            type="checkbox"
            name="community_auto_approve"
            defaultChecked={init.communityAutoApprove}
            className="mt-0.5 h-4 w-4 accent-npb-gold"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-npb-text">
              Aprovar posts automaticamente
            </div>
            <div className="text-xs text-npb-text-muted">
              Quando ligado, posts de aluno entram aprovados sem precisar passar
              pela fila de moderação. Posts de admin/moderador sempre entram
              aprovados.
            </div>
          </div>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="community_max_image_mb" className="text-npb-text">
              Tamanho máximo de imagem (MB)
            </Label>
            <Input
              id="community_max_image_mb"
              name="community_max_image_mb"
              type="number"
              min={1}
              max={50}
              defaultValue={init.communityMaxImageMb}
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="community_max_comment_chars"
              className="text-npb-text"
            >
              Tamanho máximo de comentário (caracteres)
            </Label>
            <Input
              id="community_max_comment_chars"
              name="community_max_comment_chars"
              type="number"
              min={100}
              max={50000}
              defaultValue={init.communityMaxCommentChars}
              className="bg-npb-bg3 border-npb-border text-npb-text"
            />
          </div>
        </div>
      </fieldset>

      {/* GAMIFICATION */}
      <fieldset className="space-y-4 rounded-2xl border border-npb-border bg-npb-bg2 p-6">
        <legend className="-ml-2 px-2 text-xs font-semibold uppercase tracking-wide text-npb-gold">
          Gamification
        </legend>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-npb-border bg-npb-bg3 p-3 transition-colors hover:border-npb-gold-dim">
          <input
            type="checkbox"
            name="gamification_enabled"
            defaultChecked={init.gamificationEnabled}
            className="mt-0.5 h-4 w-4 accent-npb-gold"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-npb-text">
              Sistema de XP / streak / conquistas ativo
            </div>
            <div className="text-xs text-npb-text-muted">
              Quando desligado, ações dos alunos não pontuam e o pill do topbar
              fica oculto. XP existente é preservado.
            </div>
          </div>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-npb-text">
            XP por ação
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              name="xp_lesson_complete"
              label="Concluir aula"
              defaultValue={init.xpLessonComplete}
            />
            <NumberField
              name="xp_streak_7d"
              label="Streak de 7 dias"
              defaultValue={init.xpStreak7d}
            />
            <NumberField
              name="xp_first_access_day"
              label="Primeiro acesso do dia"
              defaultValue={init.xpFirstAccessDay}
            />
            <NumberField
              name="xp_lesson_rated"
              label="Avaliar aula"
              defaultValue={init.xpLessonRated}
            />
            <NumberField
              name="xp_comment_approved"
              label="Comentário"
              defaultValue={init.xpCommentApproved}
            />
            <NumberField
              name="xp_post_approved"
              label="Post aprovado"
              defaultValue={init.xpPostApproved}
            />
            <NumberField
              name="xp_course_completed"
              label="Curso 100% concluído"
              defaultValue={init.xpCourseCompleted}
            />
          </div>
        </div>

        <div className="rounded-md border border-npb-border bg-npb-bg3 p-3">
          <p className="text-xs font-semibold text-npb-text">
            Reset trimestral fixo
          </p>
          <p className="mt-1 text-xs text-npb-text-muted">
            XP zera no 1º dia de cada trimestre civil (jan/abr/jul/out).
            Conquistas e streak histórico são preservados.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-npb-text">
            Quem pode ver o leaderboard?
          </p>
          <div className="flex flex-wrap gap-3">
            <CheckBox
              name="leaderboard_visible_to_admin"
              label="Admin"
              defaultChecked={init.leaderboardVisibleToAdmin}
            />
            <CheckBox
              name="leaderboard_visible_to_moderator"
              label="Moderador"
              defaultChecked={init.leaderboardVisibleToModerator}
            />
            <CheckBox
              name="leaderboard_visible_to_student"
              label="Alunos"
              defaultChecked={init.leaderboardVisibleToStudent}
            />
          </div>
        </div>
      </fieldset>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.ok && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Configurações salvas.</span>
        </div>
      )}

      <div>
        <SubmitButton>Salvar configurações</SubmitButton>
      </div>
    </form>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-[11px] text-npb-text-muted">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        max={9999}
        defaultValue={defaultValue}
        className="bg-npb-bg3 border-npb-border text-npb-text"
      />
    </div>
  );
}

function CheckBox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-npb-border bg-npb-bg3 px-3 py-1.5 text-sm text-npb-text transition hover:border-npb-gold-dim">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-npb-gold"
      />
      {label}
    </label>
  );
}
