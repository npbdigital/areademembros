"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import {
  completeOnboardingAction,
  uploadOnboardingAvatarAction,
} from "@/app/(student)/onboarding/actions";

interface Props {
  userId: string;
  initialFullName: string;
  email: string;
  initialAvatarUrl: string | null;
  nextUrl: string;
}

export function OnboardingForm({
  initialFullName,
  email,
  initialAvatarUrl,
  nextUrl,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadOnboardingAvatarAction(fd);
    setUploading(false);
    if (res.ok && res.url) {
      setAvatarUrl(res.url);
      toast.success("Foto carregada!");
    } else {
      toast.error(res.error ?? "Falha no upload.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Preencha o nome.");
    if (password && password !== confirmPassword) {
      return toast.error("Senhas não coincidem.");
    }
    if (password && password.length < 6) {
      return toast.error("Senha precisa ter pelo menos 6 caracteres.");
    }

    startTransition(async () => {
      const res = await completeOnboardingAction({
        fullName: fullName.trim(),
        password: password || undefined,
        avatarUrl,
      });
      if (res.ok) {
        toast.success("Tudo pronto! Bem-vindo(a).");
        router.push(nextUrl);
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  function handleSkip() {
    startTransition(async () => {
      // Marca como concluído mesmo sem mudanças (libera o nextUrl)
      const res = await completeOnboardingAction({
        fullName: fullName.trim() || "Aluno",
      });
      if (res.ok) {
        router.push(nextUrl);
      } else {
        toast.error(res.error ?? "Falha.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <label className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border-2 border-npb-gold bg-npb-bg3 transition hover:border-npb-gold-light">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-npb-gold">
              <UserIcon className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAvatarUpload(f);
            }}
            className="hidden"
          />
        </label>
        <p className="text-[11px] text-npb-text-muted">
          Foto (opcional · max 5MB)
        </p>
      </div>

      {/* Nome */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
          Seu nome <span className="text-npb-gold">*</span>
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Como quer ser chamado(a)"
          className="w-full rounded-md border border-npb-border bg-npb-bg3 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
      </div>

      {/* Email (readonly) */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-npb-text-muted">
          E-mail
        </label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full cursor-not-allowed rounded-md border border-npb-border bg-npb-bg3/50 px-3 py-2 text-sm text-npb-text-muted outline-none"
        />
      </div>

      {/* Nova senha */}
      <div className="space-y-3 rounded-md border border-npb-border bg-npb-bg3 p-4">
        <p className="text-xs font-semibold text-npb-text">
          Nova senha (opcional)
        </p>
        <p className="-mt-2 text-[11px] text-npb-text-muted">
          Deixe em branco pra manter a senha que veio no convite. Pra criar
          uma própria, preencha os 2 campos.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha (mín. 6 caracteres)"
          className="w-full rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirme a nova senha"
          disabled={!password}
          className="w-full rounded-md border border-npb-border bg-npb-bg2 px-3 py-2 text-sm text-npb-text outline-none focus:border-npb-gold-dim disabled:opacity-40"
        />
      </div>

      {/* Botões */}
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={pending || uploading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-npb-gold px-4 py-2.5 text-sm font-bold text-black transition hover:bg-npb-gold-light disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            "Concluir e entrar"
          )}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={pending}
          className="text-xs text-npb-text-muted hover:text-npb-text"
        >
          Pular essa etapa
        </button>
      </div>
    </form>
  );
}
