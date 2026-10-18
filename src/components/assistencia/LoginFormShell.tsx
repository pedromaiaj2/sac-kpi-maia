import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Casca visual compartilhada pras telas de login -- pedido do Victor
// 24/09/2026 (redesenho "Tela 2"), aplicada primeiro em 2 exemplos reais
// (login por e-mail/senha do admin e por nome/PIN do financeiro) antes de
// estender pras outras 7. Cada tela continua com sua própria Server Action
// (PIN ou Supabase Auth, cada papel com o mecanismo que já tem hoje) -- só
// o visual em volta do formulário é compartilhado.
export function LoginFormShell({
  roleTitle,
  roleSubtitle,
  backHref = "/assistencia",
  children,
}: {
  roleTitle: string;
  roleSubtitle: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        {/* Pílula flutuante minimalista (era pílula com borda + hover
            verde) -- migração pro Design System unificado, pedido do Victor
            18/10/2026: "transforme-o em pílula flutuante minimalista
            (rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600)".
            var(--surface-2)/var(--brand-green-soft) em vez dos tons zinc
            literais pra continuar respeitando os tokens de tema (claro/
            escuro) em vez de uma cor fixa que só funciona no claro. */}
        <Link
          href={backHref}
          className="self-start inline-flex items-center gap-1.5 text-sm py-2 px-4 rounded-full transition-colors duration-200 hover:bg-[var(--brand-green-soft)]"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Voltar para seleção de perfil
        </Link>

        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold tracking-wide" style={{ color: "var(--brand-green)" }}>
              Acessar como {roleTitle}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {roleSubtitle}
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

// Casca do card de formulário -- era `rounded-xl border` + uma faixa
// colorida de 3px no topo (verde ou laranja, variava por papel). Migração
// pro Design System unificado, pedido do Victor 18/10/2026: "cantos muito
// mais suaves e arredondados (rounded-2xl)... flutue elegantemente usando
// uma sombra suave" -- `.cartao` é a mesma casca sem borda/com sombra já
// usada na Home (inicio/page.tsx) e em /kpis/logistica, sem faixa de cor
// nenhuma (identidade de papel não precisa mais disso, mesma lógica que já
// valeu pro redesenho do seletor de perfil em 24/09/2026 -- "cor de borda
// única, não mais alternando laranja/verde por papel"). Mais respiro
// (p-8, era p-6).
export const loginCardClassName = "cartao p-8 flex flex-col gap-4";

// Input moderno (era `rounded-lg border` com anel de foco de 2px) --
// cantos bem arredondados + borda sutil + foco suave (ring-1), pedido do
// Victor 18/10/2026.
export const loginInputClassName =
  "rounded-xl border px-4 py-2.5 text-sm tracking-wide transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] focus:border-[var(--brand-green)]";
export const loginInputStyle = { borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" };

// Botão "Entrar" em pílula (era `rounded-lg` reto, cor fixa em hex
// `#1B5E3C` em vez do token `var(--brand-green)`) -- pedido do Victor
// 18/10/2026: "formato de pílula totalmente arredondada... hover suave".
// `hover:brightness-90` em vez de um 2º token de "verde mais escuro" --
// funciona em cima de QUALQUER cor de fundo (útil se um papel um dia
// precisar de botão numa cor diferente) sem precisar inventar
// `--brand-green-dark` só pra isso.
export const loginButtonClassName =
  "rounded-full px-5 py-3 font-semibold tracking-wide text-white transition-all duration-200 hover:brightness-90 disabled:opacity-60 disabled:hover:brightness-100";
export const loginButtonStyle = { background: "var(--brand-green)" };

// Erro discreto (era texto solto, sem fundo nenhum) -- "mensagem de erro...
// de forma elegante, com fonte vermelha discreta e bem posicionada, sem
// deformar o layout do card". `color-mix` pro fundo soft -- mesma receita
// já usada em NavBadge.tsx/globals.css, não precisa de token novo.
export const loginErrorClassName = "text-sm font-medium rounded-lg px-3 py-2";
export const loginErrorStyle = { color: "var(--status-critical)", background: "color-mix(in srgb, var(--status-critical) 10%, transparent)" };
