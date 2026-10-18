"use client";

import { useActionState } from "react";
import { redefinirSenha, type RedefinirSenhaFormState } from "@/app/assistencia/redefinir-senha/actions";
import {
  loginInputClassName,
  loginInputStyle,
  loginCardClassName,
  loginButtonClassName,
  loginButtonStyle,
  loginErrorClassName,
  loginErrorStyle,
} from "./LoginFormShell";

// Mesma migração dos formulários de login (Design System unificado,
// 18/10/2026) -- essa tela é a última etapa do mesmo fluxo de acesso.
export function RedefinirSenhaForm({ tokenHash }: { tokenHash: string }) {
  const [state, formAction, pending] = useActionState<RedefinirSenhaFormState, FormData>(redefinirSenha, undefined);

  return (
    <form action={formAction} className={loginCardClassName}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Nova senha
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={loginInputClassName}
          style={loginInputStyle}
        />
      </label>
      {state?.error ? (
        <p className={loginErrorClassName} style={loginErrorStyle}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={loginButtonClassName} style={loginButtonStyle}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
