"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { emitirVoucherAction, buscarClienteAction, type EmitirState } from "@/app/assistencia/vouchers-actions";
import { MOTIVOS_VOUCHER, MOTIVO_VOUCHER_LABELS, TIPOS_BENEFICIO, TIPO_BENEFICIO_LABELS, somenteDigitos, type TipoBeneficio, type PreenchimentoVoucher } from "@/lib/vouchersCore";


const campo = "text-sm rounded border px-2.5 py-2 w-full";
const campoStyle = { borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" };

function Rotulo({ texto, obrigatorio, children }: { texto: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
      <span>
        {texto}
        {obrigatorio ? <span style={{ color: "var(--status-critical)" }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function EmitirVoucherForm({ inicial, validadePadrao, hoje }: { inicial: PreenchimentoVoucher; validadePadrao: string; hoje: string }) {
  const [state, action, pending] = useActionState<EmitirState, FormData>(emitirVoucherAction, undefined);
  const [nome, setNome] = useState(inicial.clienteNome ?? "");
  const [cpf, setCpf] = useState(inicial.clienteCpf ?? "");
  const [telefone, setTelefone] = useState(inicial.clienteTelefone ?? "");
  const [tipo, setTipo] = useState<TipoBeneficio>("percentual_desconto");
  const [motivo, setMotivo] = useState(inicial.motivo ?? "");
  const [busca, startBusca] = useTransition();
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null);

  function buscarCpf() {
    if (somenteDigitos(cpf).length !== 11) return;
    startBusca(async () => {
      const c = await buscarClienteAction(cpf);
      if (!c) {
        setAvisoBusca("CPF não encontrado no cadastro do Protheus. Preencha nome e telefone à mão.");
        return;
      }
      setAvisoBusca(null);
      if (!nome.trim()) setNome(c.nome);
      if (!telefone.trim() && c.telefone) setTelefone(c.telefone);
    });
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="origem" value={inicial.origem ?? "manual"} />
      <input type="hidden" name="origem_id" value={inicial.origemId ?? ""} />
      {inicial.avisoOrigem ? (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--brand-orange-soft)", color: "var(--text-primary)" }}>
          {inicial.avisoOrigem}
        </p>
      ) : null}

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <legend className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Cliente
        </legend>
        <Rotulo texto="CPF" obrigatorio>
          <input
            name="cliente_cpf"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            onBlur={buscarCpf}
            inputMode="numeric"
            placeholder="000.000.000-00"
            className={campo}
            style={campoStyle}
            required
          />
        </Rotulo>
        <Rotulo texto="Nome completo" obrigatorio>
          <input name="cliente_nome" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} style={campoStyle} required />
        </Rotulo>
        <Rotulo texto="Telefone (WhatsApp)">
          <input name="cliente_telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" className={campo} style={campoStyle} />
        </Rotulo>
        {busca || avisoBusca ? (
          <p className="text-xs sm:col-span-3" style={{ color: "var(--text-muted)" }}>
            {busca ? "Buscando o CPF no cadastro…" : avisoBusca}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <legend className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Benefício
        </legend>
        <Rotulo texto="Tipo" obrigatorio>
          <select name="tipo_beneficio" value={tipo} onChange={(e) => setTipo(e.target.value as TipoBeneficio)} className={campo} style={campoStyle}>
            {TIPOS_BENEFICIO.map((t) => (
              <option key={t} value={t}>
                {TIPO_BENEFICIO_LABELS[t]}
              </option>
            ))}
          </select>
        </Rotulo>
        {tipo === "percentual_desconto" || tipo === "valor_desconto" ? (
          <Rotulo texto={tipo === "percentual_desconto" ? "Desconto (%)" : "Desconto (R$)"} obrigatorio>
            <input name="valor_beneficio" inputMode="decimal" placeholder={tipo === "percentual_desconto" ? "10" : "100,00"} className={campo} style={campoStyle} required />
          </Rotulo>
        ) : (
          <input type="hidden" name="valor_beneficio" value="" />
        )}
        <Rotulo texto={tipo === "brinde" ? "Qual brinde" : "Descrição (opcional)"} obrigatorio={tipo === "brinde"}>
          <input
            name="descricao_beneficio"
            placeholder={tipo === "brinde" ? "Jogo de copos" : "Ex.: em qualquer colchão"}
            className={campo}
            style={campoStyle}
            required={tipo === "brinde"}
          />
        </Rotulo>
        <Rotulo texto="Compra mínima (R$, opcional)">
          <input name="valor_minimo_compra" inputMode="decimal" placeholder="Sem mínimo" className={campo} style={campoStyle} />
        </Rotulo>
        <Rotulo texto="Válido até" obrigatorio>
          <input name="data_validade" type="date" defaultValue={validadePadrao} min={hoje} className={campo} style={campoStyle} required />
        </Rotulo>
      </fieldset>

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <legend className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Motivo
        </legend>
        <Rotulo texto="Motivo" obrigatorio>
          <select name="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} style={campoStyle} required>
            <option value="" disabled>
              Escolha…
            </option>
            {MOTIVOS_VOUCHER.map((m) => (
              <option key={m} value={m}>
                {MOTIVO_VOUCHER_LABELS[m]}
              </option>
            ))}
          </select>
        </Rotulo>
        <Rotulo texto="Pedido / protocolo de origem">
          <input name="pedido_origem" defaultValue={inicial.pedidoOrigem ?? ""} className={campo} style={campoStyle} />
        </Rotulo>
        <Rotulo texto="Observação" obrigatorio={motivo === "outro"}>
          <input name="observacao" defaultValue={inicial.observacao ?? ""} className={campo} style={campoStyle} required={motivo === "outro"} />
        </Rotulo>
      </fieldset>

      {state?.error ? (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--status-critical) 15%, var(--surface-1))", color: "var(--text-primary)" }}>
          {state.error}
          {state.voucherAtivoId ? (
            <>
              {" "}
              <Link href={`/assistencia/vouchers/${state.voucherAtivoId}`} className="underline font-semibold">
                Ver o voucher ativo
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Emitindo…" : "Emitir voucher"}
      </button>
    </form>
  );
}
