import Image from "next/image";
import Link from "next/link";
import { RedefinirSenhaForm } from "@/components/assistencia/RedefinirSenhaForm";
import { loginErrorClassName, loginErrorStyle } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Definir nova senha
            </h1>
          </div>
        </div>

        {token_hash ? (
          <RedefinirSenhaForm tokenHash={token_hash} />
        ) : (
          <p className={`${loginErrorClassName} text-center`} style={loginErrorStyle}>
            Link inválido. Peça um novo link de redefinição.
          </p>
        )}

        <Link
          href="/assistencia/login"
          className="self-center inline-flex items-center gap-1.5 text-sm py-2 px-4 rounded-full transition-colors duration-200 hover:bg-[var(--brand-green-soft)]"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
