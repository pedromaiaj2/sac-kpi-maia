import { redirect } from "next/navigation";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";
import { FabricaLoginForm } from "@/components/assistencia/FabricaLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

// Migrado pra LoginFormShell, mesmo motivo de encomendas/cd/login/page.tsx.
export default async function FabricaLoginPage() {
  const existingSession = await getFabricaSession();
  if (existingSession) {
    redirect("/assistencia/encomendas/fila");
  }

  return (
    <LoginFormShell roleTitle="Fábrica" roleSubtitle="Veja os pedidos solicitados e marque o que já entrou em produção." backHref="/assistencia/encomendas">
      <FabricaLoginForm />
    </LoginFormShell>
  );
}
