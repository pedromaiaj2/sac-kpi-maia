"use client";

import { useActionState } from "react";
import { driverSignIn, type DriverFormState } from "@/app/assistencia/driver-actions";
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

export function MotoristaLoginForm() {
  const [state, formAction, pending] = useActionState<DriverFormState, FormData>(driverSignIn, undefined);
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
