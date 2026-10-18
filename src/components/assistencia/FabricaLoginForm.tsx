"use client";

import { useActionState } from "react";
import { fabricaSignIn, type FabricaFormState } from "@/app/assistencia/fabrica-actions";
import { PIN_LENGTH } from "@/lib/pinConfig";
import { usePinAutoSubmit } from "./usePinAutoSubmit";
import {
  loginInputClassName,
  loginInputStyle,
  loginCardClassName,
  loginButtonClassName,
  loginButtonStyle,
  loginErrorClassName,
  loginErrorStyle,
} from "./LoginFormShell";

// Mesma migração de CdLoginForm.tsx (Design System unificado, 18/10/2026).
export function FabricaLoginForm() {
  const [state, formAction, pending] = useActionState<FabricaFormState, FormData>(fabricaSignIn, undefined);
  const { formRef, onPinChange } = usePinAutoSubmit(pending);

  return (
    <form ref={formRef} action={formAction} className={loginCardClassName}>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        Seu nome
        <input name="name" type="text" required autoComplete="off" className={loginInputClassName} style={loginInputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
        PIN
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          pattern={`\\d{4,${PIN_LENGTH}}`}
          maxLength={PIN_LENGTH}
          required
          autoComplete="off"
          onChange={onPinChange}
          className={`${loginInputClassName} text-center text-2xl tracking-[0.5em]`}
          style={loginInputStyle}
        />
      </label>
      {state?.error ? (
        <p className={loginErrorClassName} style={loginErrorStyle}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={loginButtonClassName} style={loginButtonStyle}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
