import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Um cliente só por processo, sem o timer de renovação de sessão -- achado
// 21/10/2026 (a assistencia chegava a 1,6 GB em ~50 min e o PM2 reiniciava):
// fora do navegador o auth-js liga um setInterval de 30 s em todo
// createClient com autoRefreshToken (padrão true), e esse timer segura o
// cliente vivo pra sempre. Como getSupabaseAdmin() é chamado várias vezes
// por requisição, milhares de clientes se acumulavam por hora. Chave de
// serviço não tem sessão nenhuma pra renovar, então o mesmo cliente serve
// todas as requisições.
let cliente: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars ausentes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)");
  }
  cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}
