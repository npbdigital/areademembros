import { getNextPopupForUser } from "@/lib/push";
import { BroadcastPopup } from "@/components/student/broadcast-popup";

/**
 * Server component que busca o próximo popup pendente do aluno e
 * renderiza o modal. Quando não tem nada pendente, retorna null.
 *
 * Plugado no student layout pra rodar em toda navegação.
 */
export async function BroadcastPopupGate({ userId }: { userId: string }) {
  const popup = await getNextPopupForUser(userId);
  if (!popup) return null;
  return <BroadcastPopup popup={popup} />;
}
