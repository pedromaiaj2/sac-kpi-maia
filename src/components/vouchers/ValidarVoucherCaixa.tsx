"use client";

import { useCallback, useState, useTransition } from "react";
import { Camera, CheckCircle2, XCircle } from "lucide-react";
import { consultarVoucherAction, baixarVoucherAction } from "@/app/assistencia/vouchers-actions";
import { beneficioTitulo, beneficioDetalhe, dataBr, mensagemResultado } from "@/lib/vouchersCore";
import type { VisaoCaixa } from "@/lib/vouchers";
import { LeitorQr } from "./LeitorQr";

const campo = "text-base rounded-lg border px-3 py-2.5 w-full";
const campoStyle = { borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" };

// Tela do caixa: consulta o voucher (digitado ou pela câmera) e dá baixa
// conferindo os 3 primeiros dígitos do CPF do documento do cliente. Tudo
// que importa é decidido no servidor (vouchers-actions.ts).
export function ValidarVoucherCaixa() {
  const [codigo, setCodigo] = useState("");
  const [camera, setCamera] = useState(false);
  const [visao, setVisao] = useState<VisaoCaixa | null>(null);
  const [baixado, setBaixado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cpf3, setCpf3] = useState("");
  const [cupom, setCupom] = useState("");
  const [pending, start] = useTransition();

  const consultar = useCallback((texto: string) => {
    setErro(null);
    setBaixado(false);
    setVisao(null);
    setCpf3("");
    setCupom("");
    start(async () => {
      const r = await consultarVoucherAction(texto);
      if ("erro" in r) setErro(r.erro);
      else setVisao(r);
    });
  }, []);

  const lidoPelaCamera = useCallback(
    (texto: string) => {
      setCamera(false);
      setCodigo(texto);
      consultar(texto);
    },
    [consultar],
  );

  function baixar() {
    if (!visao?.codigo) return;
    setErro(null);
    start(async () => {
      const r = await baixarVoucherAction(visao.codigo!, cpf3, cupom);
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }
      if (r.resultado === "ok") {
        setBaixado(true);
        setVisao(r);
      } else if (r.resultado === "cpf_nao_confere") {
        setErro(mensagemResultado("cpf_nao_confere"));
      } else {
        setVisao(r);
      }
    });
  }

  function novo() {
    setCodigo("");
    setVisao(null);
    setBaixado(false);
    setErro(null);
  }

  const v = visao?.voucher;
  const valido = visao?.resultado === "ok" && !baixado;

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (codigo.trim()) consultar(codigo);
        }}
        className="flex flex-col gap-2"
      >
        <label className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Código do voucher
        </label>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="MAIA-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={`${campo} font-semibold tracking-wider`}
            style={campoStyle}
          />
          <button
            type="submit"
            disabled={pending || !codigo.trim()}
            className="text-sm font-semibold px-4 rounded-lg disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Consultar
          </button>
        </div>
        {camera ? (
          <LeitorQr onLido={lidoPelaCamera} onFechar={() => setCamera(false)} />
        ) : (
          <button type="button" onClick={() => setCamera(true)} className="self-start inline-flex items-center gap-2 text-sm underline" style={{ color: "var(--text-secondary)" }}>
            <Camera size={16} aria-hidden />
            Ler o QR pela câmera
          </button>
        )}
      </form>

      {pending ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Consultando…
        </p>
      ) : null}

      {visao ? (
        <section
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{
            border: `3px solid ${valido || baixado ? "var(--status-good)" : "var(--status-critical)"}`,
            background: `color-mix(in srgb, ${valido || baixado ? "var(--status-good)" : "var(--status-critical)"} 10%, var(--surface-1))`,
          }}
        >
          <div className="flex items-center gap-3">
            {valido || baixado ? (
              <CheckCircle2 size={36} aria-hidden style={{ color: "var(--status-good)" }} />
            ) : (
              <XCircle size={36} aria-hidden style={{ color: "var(--status-critical)" }} />
            )}
            <div>
              <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                {baixado ? "BAIXA FEITA" : valido ? "VÁLIDO" : "NÃO PODE SER USADO"}
              </p>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                {baixado ? "Voucher usado nesta venda. Aplique o benefício." : mensagemResultado(visao.resultado, { usadoEm: v?.usadoEm, lojaUso: v?.lojaUsoNome })}
              </p>
            </div>
          </div>

          {v ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                  Benefício
                </dt>
                <dd className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {beneficioTitulo(v)}
                </dd>
                {beneficioDetalhe(v) ? <dd style={{ color: "var(--text-secondary)" }}>{beneficioDetalhe(v)}</dd> : null}
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                  Titular
                </dt>
                <dd style={{ color: "var(--text-primary)" }}>{v.nome}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                  CPF
                </dt>
                <dd className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {v.cpfMascarado}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                  Válido até
                </dt>
                <dd style={{ color: "var(--text-primary)" }}>{dataBr(v.dataValidade)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                  Código
                </dt>
                <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {v.codigo}
                </dd>
              </div>
            </dl>
          ) : null}

          {valido ? (
            <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Para dar baixa, confira o documento com foto do cliente:
              </p>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                3 primeiros dígitos do CPF no documento
                <input
                  value={cpf3}
                  onChange={(e) => setCpf3(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  inputMode="numeric"
                  placeholder="000"
                  className={`${campo} w-32 tracking-widest`}
                  style={campoStyle}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Nº do cupom fiscal ou do pedido da venda
                <input value={cupom} onChange={(e) => setCupom(e.target.value)} className={campo} style={campoStyle} />
              </label>
              <button
                type="button"
                onClick={baixar}
                disabled={pending || cpf3.length !== 3 || !cupom.trim()}
                className="self-start text-base font-bold px-5 py-2.5 rounded-lg disabled:opacity-60"
                style={{ background: "var(--status-good)", color: "#fff" }}
              >
                Dar baixa
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {erro ? (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--status-critical) 15%, var(--surface-1))", color: "var(--text-primary)" }}>
          {erro}
        </p>
      ) : null}

      {visao ? (
        <button type="button" onClick={novo} className="self-start text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Consultar outro voucher
        </button>
      ) : null}
    </div>
  );
}
