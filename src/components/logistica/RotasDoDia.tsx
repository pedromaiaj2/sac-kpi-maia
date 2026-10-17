"use client";

import { useState } from "react";
import { ModalLogistica } from "./ModalLogistica";
import {
  grupoDaCarga,
  minutosDesde,
  regioesVisiveis,
  resumirRotas,
  STATUS_CARGA_ORDEM,
  type CargaRota,
  type NotaRota,
  type ResumoRotas,
  type RotasDoDia as Rotas,
} from "@/lib/rotasDoDiaCore";

// Mural "Rotas de hoje" -- pedido do Victor 17/10/2026: as rotas do dia no
// topo da logística, antes dos KPIs, com a luz verde de "ao vivo", mais
// detalhe que o Monitor de Cargas e separado em nossos e terceirizados. Os
// dados vêm da rodada rápida do sync (a cada 10 min) e a página recarrega
// sozinha (FiltrosLogistica).

// Em rota sem nenhuma baixa nova há mais que isso: destaca em amarelo.
const MINUTOS_SEM_BAIXA_ALERTA = 90;

const COR = {
  entregue: "var(--status-good)",
  parcial: "var(--status-warning)",
  voltou: "var(--status-critical)",
  pendente: "var(--surface-2)",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pctTexto(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function corStatus(codigo: string | null): string {
  if (codigo === "6") return "var(--status-good)";
  if (codigo === "5") return "var(--series-5)";
  return "var(--text-muted)";
}

function Barra({ c }: { c: Pick<CargaRota, "notas" | "entregues" | "parciais" | "naoEntregues" | "canceladas" | "pendentes"> }) {
  const partes = [
    { n: c.entregues, cor: COR.entregue, rotulo: "entregues" },
    { n: c.parciais, cor: COR.parcial, rotulo: "parciais" },
    { n: c.naoEntregues + c.canceladas, cor: COR.voltou, rotulo: "voltaram" },
    { n: c.pendentes, cor: COR.pendente, rotulo: "pendentes" },
  ].filter((p) => p.n > 0);
  return (
    <div
      className="flex h-2.5 w-full gap-[2px] rounded-full overflow-hidden"
      style={{ background: "var(--surface-2)" }}
      role="img"
      aria-label={partes.map((p) => `${p.n} ${p.rotulo}`).join(", ")}
    >
      {partes.map((p) => (
        <span key={p.rotulo} style={{ width: `${(p.n / Math.max(1, c.notas)) * 100}%`, background: p.cor }} />
      ))}
    </div>
  );
}

function Contadores({ r }: { r: ResumoRotas }) {
  const itens = [
    { rotulo: "cargas", valor: fmt(r.cargas), extra: r.emRota > 0 ? `${r.emRota} em rota` : null },
    { rotulo: "notas", valor: fmt(r.notas) },
    { rotulo: "entregues", valor: fmt(r.entregues + r.parciais), cor: COR.entregue },
    { rotulo: "voltaram", valor: fmt(r.naoEntregues), cor: r.naoEntregues > 0 ? COR.voltou : undefined },
    { rotulo: "pendentes", valor: fmt(r.pendentes) },
    { rotulo: "andamento", valor: pctTexto(r.andamento) },
  ];
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-baseline gap-1.5">
          {i.cor && <span aria-hidden className="inline-block w-2 h-2 rounded-full self-center" style={{ background: i.cor }} />}
          <dd className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {i.valor}
          </dd>
          <dt className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {i.rotulo}
            {i.extra ? ` · ${i.extra}` : ""}
          </dt>
        </div>
      ))}
    </dl>
  );
}

function CartaoCarga({ c, agora, onAbrir }: { c: CargaRota; agora: string; onAbrir: () => void }) {
  const desde = c.statusCodigo === "5" ? minutosDesde(c.ultimaBaixa, agora) : null;
  const parada = c.statusCodigo === "5" && c.pendentes > 0 && desde !== null && desde > MINUTOS_SEM_BAIXA_ALERTA;
  const regioes = regioesVisiveis(c.regioes);
  const produtos = c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado;
  const comResultado = c.notas - c.pendentes;
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="w-full text-left rounded-lg p-3 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", border: `1px solid ${parada ? "var(--status-warning)" : "var(--border)"}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {c.motorista?.nome ?? "Sem motorista"}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              #{c.carga} · {c.tipoVeiculo === "Carro" ? "Strada" : c.tipoVeiculo === "Caminhão" ? "Caminhão" : "Sem placa"}
              {c.veiculo ? ` ${c.veiculo}` : ""}
              {c.vinculo === "Terceirizado" && c.transportadora ? ` · ${c.transportadora}` : ""}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
            style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${corStatus(c.statusCodigo)} 20%, var(--surface-1))` }}
          >
            <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: corStatus(c.statusCodigo) }} />
            {STATUS_CARGA_ORDEM[c.statusCodigo ?? ""] ?? c.status ?? "—"}
          </span>
        </div>

        <Barra c={c} />

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs tabular-nums">
          <span style={{ color: "var(--text-primary)" }}>
            <b>{comResultado}</b> de {c.notas} notas
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}
              · {c.entregues + c.parciais} entregue{c.entregues + c.parciais === 1 ? "" : "s"}
              {c.naoEntregues + c.canceladas > 0 ? ` · ${c.naoEntregues + c.canceladas} ${c.naoEntregues + c.canceladas === 1 ? "voltou" : "voltaram"}` : ""}
              {c.pendentes > 0 ? ` · ${c.pendentes} pendente${c.pendentes === 1 ? "" : "s"}` : ""}
            </span>
          </span>
          {c.ultimaBaixa && (
            <span style={{ color: parada ? "var(--text-primary)" : "var(--text-muted)", fontWeight: parada ? 600 : undefined }}>
              {parada && <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: "var(--status-warning)" }} />}
              última baixa {c.ultimaBaixa}
              {desde !== null ? ` · há ${desde < 60 ? `${desde} min` : `${Math.floor(desde / 60)}h${String(desde % 60).padStart(2, "0")}`}` : ""}
            </span>
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {fmt(produtos)} produtos (G {fmt(c.volumes.G)} · M {fmt(c.volumes.M)} · P {fmt(c.volumes.P)})
          {regioes.length > 0 ? ` · ${regioes.join(", ")}` : ""}
          {c.primeiraBaixa ? ` · 1ª baixa ${c.primeiraBaixa}` : ""}
        </p>

        {c.insucessos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.insucessos.map((i) => (
              <span
                key={i.codigo}
                className="text-[11px] px-1.5 py-0.5 rounded"
                style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 14%, var(--surface-1))" }}
              >
                {i.n} × {i.descricao ?? i.codigo}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}

function Coluna({ titulo, cargas, agora, onAbrir }: { titulo: string; cargas: CargaRota[]; agora: string; onAbrir: (c: CargaRota) => void }) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-col gap-1.5 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {titulo}
        </h3>
        <Contadores r={resumirRotas(cargas)} />
      </div>
      {cargas.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhuma carga hoje.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cargas.map((c) => (
            <CartaoCarga key={c.carga} c={c} agora={agora} onAbrir={() => onAbrir(c)} />
          ))}
        </ul>
      )}
    </div>
  );
}

const ROTULO_NOTA: Record<string, { rotulo: string; cor: string }> = {
  "1": { rotulo: "Entregue", cor: COR.entregue },
  "2": { rotulo: "Parcial", cor: COR.parcial },
  "3": { rotulo: "Voltou", cor: COR.voltou },
  "4": { rotulo: "Cancelada", cor: COR.voltou },
};

function NotasCarga({ c, onFechar }: { c: CargaRota; onFechar: () => void }) {
  return (
    <ModalLogistica
      titulo={`Carga #${c.carga} · ${c.motorista?.nome ?? "sem motorista"}`}
      subtitulo={`${c.notas} notas · ${c.notas - c.pendentes} com resultado · ${c.pendentes} pendentes. Baixas mais recentes primeiro.`}
      onFechar={onFechar}
    >
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0" style={{ background: "var(--surface-2)" }}>
          <tr>
            {["Situação", "Hora", "Cliente", "Bairro", "NF / pedido", "Ocorrência"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.notasLista.map((n: NotaRota, i) => {
            const s = n.status ? ROTULO_NOTA[n.status] : null;
            return (
              <tr key={`${n.pedido}-${n.notaFiscal}-${i}`} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-1.5 whitespace-nowrap font-semibold" style={{ color: "var(--text-primary)" }}>
                  <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: s?.cor ?? "var(--text-muted)" }} />
                  {s?.rotulo ?? "Pendente"}
                  {n.tentativa && n.tentativa > 1 ? <span className="block font-normal" style={{ color: "var(--text-muted)" }}>{n.tentativa}ª tentativa</span> : null}
                </td>
                <td className="px-2 py-1.5 tabular-nums">{n.hora ?? "—"}</td>
                <td className="px-2 py-1.5 font-semibold min-w-[160px]" style={{ color: "var(--text-primary)" }}>
                  {n.cliente ?? "—"}
                </td>
                <td className="px-2 py-1.5 min-w-[120px]">{n.bairro ?? "—"}</td>
                <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                  {n.notaFiscal ?? "—"}
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {n.pedido ?? ""}
                  </span>
                </td>
                <td className="px-2 py-1.5 min-w-[140px]">{n.ocorrencia ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ModalLogistica>
  );
}

export function RotasDoDia({ rotas, agora, dadosDe }: { rotas: Rotas; agora: string; dadosDe: string | null }) {
  const [aberta, setAberta] = useState<CargaRota | null>(null);
  const porGrupo = (g: string) => rotas.cargas.filter((c) => grupoDaCarga(c) === g);
  const noCd = porGrupo("No CD");
  const dia = new Date(`${rotas.dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const comMotorista = rotas.cargas.filter((c) => grupoDaCarga(c) !== "No CD");

  return (
    <section
      className="rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm"
      style={{ border: "2px solid var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 5%, var(--surface-1))" }}
      aria-label="Rotas de hoje, ao vivo"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span aria-hidden className="luz-ao-vivo inline-block w-3 h-3 rounded-full shrink-0" />
          <h2 className="text-lg font-bold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
            Rotas de hoje
          </h2>
          <span className="text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: "#fff", background: "var(--brand-green)" }}>
            AO VIVO
          </span>
          <span className="text-sm capitalize whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
            {dia}
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {dadosDe ? `Protheus às ${dadosDe}` : "Sem sincronização recente"} · atualiza a cada 10 min
        </span>
      </div>

      {rotas.cargas.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma carga com previsão para hoje.
        </p>
      ) : (
        <>
          <Contadores r={resumirRotas(comMotorista)} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Coluna titulo="Nossos" cargas={porGrupo("Próprio")} agora={agora} onAbrir={setAberta} />
            <Coluna titulo="Terceirizados" cargas={porGrupo("Terceirizado")} agora={agora} onAbrir={setAberta} />
          </div>
          {noCd.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Ainda no CD (sem motorista):
              </span>
              {noCd.map((c) => (
                <button
                  key={c.carga}
                  type="button"
                  onClick={() => setAberta(c)}
                  className="text-xs px-2 py-1 rounded-md tabular-nums"
                  style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
                >
                  #{c.carga} · {STATUS_CARGA_ORDEM[c.statusCodigo ?? ""] ?? c.status} · {c.notas} nota{c.notas === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {aberta && <NotasCarga c={aberta} onFechar={() => setAberta(null)} />}
    </section>
  );
}
