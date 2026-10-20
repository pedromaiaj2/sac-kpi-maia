import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getCdSession } from "@/app/assistencia/cd-actions";

export type SuprimentoCdActor = { name: string; role: "cd" | "admin" };

// Quem pode entrar na fila do Rafael: sessão PIN de CD, ou (supervisão) um
// perfil Supabase Auth de admin/assistência -- mesmo padrão de
// requireEncomendaActor (encomendaAuth.ts), sem fábrica (não existe aqui).
// admin/assistência contam como "admin" pro resto do módulo (mesmo
// agrupamento que cancelPedido/denyPedido já fazem em encomendas-actions.ts).
export async function requireSuprimentoCdActor(): Promise<SuprimentoCdActor> {
  const cdName = await getCdSession();
  if (cdName) return { name: cdName, role: "cd" };

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    if (data && (data.role === "admin" || data.role === "assistencia")) {
      return { name: data.full_name, role: "admin" };
    }
  }

  redirect("/assistencia/encomendas/cd/login");
}
