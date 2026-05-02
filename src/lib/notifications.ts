/**
 * Helpers pra criar notificações in-app (+ e-mail opcional).
 *
 * Tabela: membros.notifications (id, user_id, title, body, link, is_read, created_at)
 * RLS: aluno lê apenas as próprias.
 *
 * Escritas vêm sempre do server via service_role (silent-fail).
 */

import { createAdminClient } from "@/lib/supabase/server";
import { notificationEmailHtml, sendEmail } from "@/lib/email/resend";
import { getPlatformSettings } from "@/lib/settings";
import { type PushCategory, tryPushToUser } from "@/lib/push";

export interface NotifyParams {
  userId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /**
   * Categoria pra disparo de push notification. Quando passada, dispara
   * push pra todas as subscriptions ativas do user (respeitando
   * preferências). Sem categoria = só in-app, sem push.
   */
  pushCategory?: PushCategory;
}

export async function tryNotify(params: NotifyParams): Promise<void> {
  try {
    if (!params.userId || !params.title) return;
    const supabase = createAdminClient();
    await supabase.schema("membros").from("notifications").insert({
      user_id: params.userId,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    });

    // Push (best-effort, não bloqueia)
    if (params.pushCategory) {
      await tryPushToUser({
        userId: params.userId,
        category: params.pushCategory,
        payload: {
          title: params.title,
          body: params.body ?? undefined,
          link: params.link ?? undefined,
        },
      });
    }
  } catch {
    // best-effort
  }
}

export async function tryNotifyMany(
  userIds: string[],
  payload: Omit<NotifyParams, "userId">,
): Promise<void> {
  try {
    if (userIds.length === 0 || !payload.title) return;
    const supabase = createAdminClient();
    await supabase
      .schema("membros")
      .from("notifications")
      .insert(
        userIds.map((userId) => ({
          user_id: userId,
          title: payload.title,
          body: payload.body ?? null,
          link: payload.link ?? null,
        })),
      );

    // Push em batch (best-effort, não bloqueia)
    if (payload.pushCategory) {
      await Promise.all(
        userIds.map((userId) =>
          tryPushToUser({
            userId,
            category: payload.pushCategory!,
            payload: {
              title: payload.title,
              body: payload.body ?? undefined,
              link: payload.link ?? undefined,
            },
          }),
        ),
      );
    }
  } catch {
    // best-effort
  }
}

export interface NotifyAndEmailParams extends NotifyParams {
  /** Texto do botão CTA no e-mail. Default "Ver na plataforma". */
  ctaLabel?: string;
}

/**
 * Cria notificação in-app E envia e-mail (se o user opt-in).
 *
 * O e-mail só sai se:
 *   - userExists em membros.users
 *   - email_notifications_enabled = true (default)
 *   - tem e-mail no profile
 *
 * Sempre cria a notificação in-app (independente do canal de e-mail).
 */
/**
 * Pega todos os user_ids que têm matrícula ativa em alguma turma que
 * inclui o curso passado. Usado pra notificar quando um curso é publicado
 * ou ganha uma aula nova.
 */
export async function getActiveEnrollmentsForCourse(
  courseId: string,
): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data: cohortRows } = await supabase
      .schema("membros")
      .from("cohort_courses")
      .select("cohort_id")
      .eq("course_id", courseId);
    const cohortIds = ((cohortRows ?? []) as Array<{ cohort_id: string }>)
      .map((r) => r.cohort_id);
    if (cohortIds.length === 0) return [];

    const nowIso = new Date().toISOString();
    const { data: enrollRows } = await supabase
      .schema("membros")
      .from("enrollments")
      .select("user_id, expires_at")
      .in("cohort_id", cohortIds)
      .eq("is_active", true);

    const userIds = new Set<string>();
    for (const row of (enrollRows ?? []) as Array<{
      user_id: string;
      expires_at: string | null;
    }>) {
      if (!row.expires_at || row.expires_at > nowIso) {
        userIds.add(row.user_id);
      }
    }
    return Array.from(userIds);
  } catch {
    return [];
  }
}

/**
 * Notifica todos os matriculados ativos de um curso. Quando withEmail=true,
 * dispara também e-mail Resend pra cada um (respeitando preferência
 * email_notifications_enabled). Sem e-mail é a forma padrão (eventos de
 * volume alto tipo "nova aula").
 */
export async function notifyEnrolledInCourse(params: {
  courseId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  ctaLabel?: string;
  withEmail?: boolean;
  pushCategory?: PushCategory;
}): Promise<void> {
  const userIds = await getActiveEnrollmentsForCourse(params.courseId);
  if (userIds.length === 0) return;

  // In-app + push (se pushCategory passada) sempre, em batch
  await tryNotifyMany(userIds, {
    title: params.title,
    body: params.body,
    link: params.link,
    pushCategory: params.pushCategory,
  });

  if (params.withEmail) {
    // E-mail individual (notifyAndEmail já cria a notif in-app — então
    // aqui só dispara o e-mail respeitando opt-in). Pra evitar criar
    // notif duplicada, mando direto via sendEmail aqui.
    try {
      const supabase = createAdminClient();
      const { data: profiles } = await supabase
        .schema("membros")
        .from("users")
        .select("id, email, full_name, email_notifications_enabled")
        .in("id", userIds)
        .eq("email_notifications_enabled", true);

      const settings = await getPlatformSettings(supabase);
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const ctaUrl = params.link
        ? params.link.startsWith("http")
          ? params.link
          : `${appUrl}${params.link.startsWith("/") ? "" : "/"}${params.link}`
        : null;

      await Promise.allSettled(
        ((profiles ?? []) as Array<{
          email: string;
          full_name: string | null;
        }>).map((p) =>
          sendEmail({
            to: p.email,
            subject: params.title,
            html: notificationEmailHtml({
              recipientName: p.full_name,
              title: params.title,
              body: params.body,
              ctaLabel: params.ctaLabel ?? "Acessar curso",
              ctaUrl,
              platformName: settings.platformName,
              platformLogoUrl: settings.platformLogoUrl,
              preferencesUrl: `${appUrl}/profile`,
            }),
          }),
        ),
      );
    } catch {
      // best-effort
    }
  }
}

export async function notifyAndEmail(
  params: NotifyAndEmailParams,
): Promise<void> {
  // 1. Notif in-app sempre
  await tryNotify(params);

  // 2. E-mail se habilitado
  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .schema("membros")
      .from("users")
      .select("email, full_name, email_notifications_enabled")
      .eq("id", params.userId)
      .maybeSingle();

    const p = profile as
      | {
          email: string;
          full_name: string | null;
          email_notifications_enabled: boolean | null;
        }
      | null;

    if (!p || !p.email || p.email_notifications_enabled === false) return;

    const settings = await getPlatformSettings(supabase);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const ctaUrl = params.link
      ? params.link.startsWith("http")
        ? params.link
        : `${appUrl}${params.link.startsWith("/") ? "" : "/"}${params.link}`
      : null;

    await sendEmail({
      to: p.email,
      subject: params.title,
      html: notificationEmailHtml({
        recipientName: p.full_name,
        title: params.title,
        body: params.body,
        ctaLabel: params.ctaLabel ?? "Ver na plataforma",
        ctaUrl,
        platformName: settings.platformName,
        platformLogoUrl: settings.platformLogoUrl,
        preferencesUrl: `${appUrl}/profile`,
      }),
    });
  } catch {
    // best-effort
  }
}
