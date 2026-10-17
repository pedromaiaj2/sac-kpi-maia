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
  type GrupoRota,
  type NotaRota,
  type RotasDoDia as Rotas,
} from "@/lib/rotasDoDiaCore";

// Mural "Rotas de hoje" -- pedido do Victor 17/10/2026: as rotas do dia no
// topo da logística, antes dos KPIs, com a luz verde de "ao vivo", mais
// detalhe que o Monitor de Cargas e separado em nossos e terceirizados. Os
// dados vêm da rodada rápida do sync (a cada 10 min) e a página recarrega
// sozinha (FiltrosLogistica). Visual do painel escuro (mesmo dia): números
// grandes, barras finas estilo player, cartões arredondados sem borda.

// Em rota sem nenhuma baixa nova há mais que isso: destaca em âmbar.
const MINUTOS_SEM_BAIXA_ALERTA = 90;

const COR = {
  entregue: "var(--status-good)",
  parcial: "var(--status-warning)",
  voltou: "var(--status-critical)",
  pendente: "var(--surface-2)",
};

const COR_GRUPO: Record<GrupoRota, string> = {
  "Próprio": "var(--brand-green)",
  Terceirizado: "var(--series-5)",
  "No CD": "var(--text-muted)",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pctTexto(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function tempo(min: number) {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function iniciais(nome: string | null | undefined) {
  const p = (nome ?? "?").replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : "")).toUpperCase();
}

function parada(c: CargaRota, agora: string) {
  const desde = c.statusCodigo === "5" ? minutosDesde(c.ultimaBaixa, agora) : null;
  return { desde, parada: c.statusCodigo === "5" && c.pendentes > 0 && desde !== null && desde > MINUTOS_SEM_BAIXA_ALERTA };
}

// Barra fina segmentada (estilo player): 2px de respiro entre os trechos.
function BarraFina({ partes, total, alta = "h-1.5" }: { partes: { n: number; cor: string; rotulo: string }[]; total: number; alta?: string }) {
  const visiveis = partes.filter((p) => p.n > 0);
  return (
    <div
      className={`flex ${alta} w-full gap-[2px] rounded-full overflow-hidden`}
      style={{ background: "var(--surface-2)" }}
      role="img"
      aria-label={visiveis.map((p) => `${p.n} ${p.rotulo}`).join(", ") || "sem dados"}
    >
      {visiveis.map((p) => (
        <span key={p.rotulo} className="h-full" style={{ width: `${(p.n / Math.max(1, total)) * 100}%`, background: p.cor }} />
      ))}
    </div>
  );
}

function Legenda({ itens }: { itens: { cor: string; texto: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
      {itens.map((i) => (
        <li key={i.texto} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: i.cor }} />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}

function Destaque({ rotulo, valor, children }: { rotulo: string; valor: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 min-w-0 shadow-lg shadow-black/20" style={{ background: "var(--surface-1)" }}>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {rotulo}
      </p>
      <p className="text-4xl font-bold tracking-tight tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
        {valor}
      </p>
      {children}
    </div>
  );
}

function CartaoCarga({ c, grupo, agora, onAbrir }: { c: CargaRota; grupo: GrupoRota; agora: string; onAbrir: () => void }) {
  const { desde, parada: estaParada } = parada(c, agora);
  const regioes = regioesVisiveis(c.regioes);
  const produtos = c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado;
  const comResultado = c.notas - c.pendentes;
  const conclusao = c.notas > 0 ? comResultado / c.notas : null;
  const voltaram = c.naoEntregues + c.canceladas;
  const corGrupo = COR_GRUPO[grupo];
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="w-full text-left rounded-2xl p-5 flex flex-col gap-4 transition-colors hover:bg-[var(--surface-2)] shadow-lg shadow-black/20"
        style={{ background: "var(--surface-1)", outline: estaParada ? "1px solid var(--status-warning)" : undefined }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `color-mix(in srgb, ${corGrupo} 18%, transparent)`, color: corGrupo }}
          >
            {iniciais(c.motorista?.nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {c.motorista?.nome ?? "Sem motorista"}
            </p>
            <p className="text-xs truncate opacity-80" style={{ color: "var(--text-secondary)" }}>
              {c.tipoVeiculo === "Carro" ? "Strada" : c.tipoVeiculo === "Caminhão" ? "Caminhão" : "Sem placa"}
              {c.veiculo ? ` ${c.veiculo}` : ""} · #{c.carga}
              {c.vinculo === "Terceirizado" && c.transportadora ? ` · ${c.transportadora}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
              {pctTexto(conclusao)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              concluído
            </p>
          </div>
        </div>

        <BarraFina
          total={c.notas}
          partes={[
            { n: c.entregues, cor: COR.entregue, rotulo: "entregues" },
            { n: c.parciais, cor: COR.parcial, rotulo: "parciais" },
            { n: voltaram, cor: COR.voltou, rotulo: "voltaram" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
              {STATUS_CARGA_ORDEM[c.statusCodigo ?? ""] ?? c.status ?? "—"}
            </span>
            <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
              <b style={{ color: "var(--text-primary)" }}>{comResultado}</b>/{c.notas} notas
              {voltaram > 0 ? ` · ${voltaram} ${voltaram === 1 ? "voltou" : "voltaram"}` : ""}
            </span>
          </span>
          {c.ultimaBaixa && (
            <span className="inline-flex items-center gap-1.5 tabular-nums" style={{ color: estaParada ? "var(--status-warning)" : "var(--text-muted)" }}>
              {estaParada && <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />}
              última baixa {c.ultimaBaixa}
              {desde !== null ? ` · há ${tempo(desde)}` : ""}
            </span>
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {fmt(produtos)} produtos · G {fmt(c.volumes.G)} · M {fmt(c.volumes.M)} · P {fmt(c.volumes.P)}
          {regioes.length > 0 ? ` · ${regioes.join(", ")}` : ""}
        </p>

        {c.insucessos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.insucessos.map((i) => (
              <span
                key={i.codigo}
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 18%, transparent)" }}
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

function Grupo({ grupo, titulo, cargas, agora, onAbrir }: { grupo: GrupoRota; titulo: string; cargas: CargaRota[]; agora: string; onAbrir: (c: CargaRota) => void }) {
  const r = resumirRotas(cargas);
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="inline-flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COR_GRUPO[grupo] }} />
          {titulo}
        </h3>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {r.cargas} carga{r.cargas === 1 ? "" : "s"} · {fmt(r.notas)} notas · {pctTexto(r.andamento)} concluído
        </span>
      </div>
      {cargas.length === 0 ? (
        <p className="text-sm rounded-2xl p-5" style={{ color: "var(--text-muted)", background: "var(--surface-1)" }}>
          Nenhuma carga hoje.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cargas.map((c) => (
            <CartaoCarga key={c.carga} c={c} grupo={grupo} agora={agora} onAbrir={() => onAbrir(c)} />
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
      <table className="w-full text-xs">
        <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
          <tr>
            {["Situação", "Hora", "Cliente", "Bairro", "NF / pedido", "Ocorrência"].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
          {c.notasLista.map((n: NotaRota, i) => {
            const s = n.status ? ROTULO_NOTA[n.status] : null;
            return (
              <tr key={`${n.pedido}-${n.notaFiscal}-${i}`} className="align-top" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: "var(--text-primary)" }}>
                  <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: s?.cor ?? "var(--text-muted)" }} />
                  {s?.rotulo ?? "Pendente"}
                  {n.tentativa && n.tentativa > 1 ? (
                    <span className="block font-normal" style={{ color: "var(--text-muted)" }}>
                      {n.tentativa}ª tentativa
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{n.hora ?? "—"}</td>
                <td className="px-3 py-2.5 font-medium min-w-[160px]" style={{ color: "var(--text-primary)" }}>
                  {n.cliente ?? "—"}
                </td>
                <td className="px-3 py-2.5 min-w-[120px]" style={{ color: "var(--text-secondary)" }}>
                  {n.bairro ?? "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                  {n.notaFiscal ?? "—"}
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {n.pedido ?? ""}
                  </span>
                </td>
                <td className="px-3 py-2.5 min-w-[140px]" style={{ color: "var(--text-secondary)" }}>
                  {n.ocorrencia ?? ""}
                </td>
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
  const porGrupo = (g: GrupoRota) => rotas.cargas.filter((c) => grupoDaCarga(c) === g);
  const proprias = porGrupo("Próprio");
  const terceiras = porGrupo("Terceirizado");
  const noCd = porGrupo("No CD");
  const naRua = [...proprias, ...terceiras];
  const r = resumirRotas(naRua);
  const notasCd = noCd.reduce((t, c) => t + c.notas, 0);
  const totalNotas = r.notas + notasCd;
  const volumes = rotas.cargas.reduce(
    (t, c) => ({ P: t.P + c.volumes.P, M: t.M + c.volumes.M, G: t.G + c.volumes.G, N: t.N + c.volumes.naoClassificado }),
    { P: 0, M: 0, G: 0, N: 0 },
  );
  const paradas = naRua.filter((c) => parada(c, agora).parada).length;
  const dia = new Date(`${rotas.dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

  return (
    <section className="flex flex-col gap-6" aria-label="Rotas de hoje, ao vivo">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest" style={{ color: "var(--brand-green)" }}>
            <span aria-hidden className="luz-ao-vivo inline-block w-2.5 h-2.5 rounded-full shrink-0" />
            AO VIVO
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Rotas de hoje
          </h1>
          <p className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>
            {dia}
          </p>
        </div>
        <span className="text-xs rounded-full px-3.5 py-2" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
          {dadosDe ? `Protheus às ${dadosDe}` : "Sem sincronização recente"} · atualiza a cada 10 min
        </span>
      </header>

      {rotas.cargas.length === 0 ? (
        <p className="text-sm rounded-2xl p-6" style={{ color: "var(--text-muted)", background: "var(--surface-1)" }}>
          Nenhuma carga com previsão para hoje.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Destaque rotulo="Notas hoje" valor={fmt(totalNotas)}>
              <BarraFina
                total={totalNotas}
                partes={[
                  { n: proprias.reduce((t, c) => t + c.notas, 0), cor: COR_GRUPO["Próprio"], rotulo: "nossas" },
                  { n: terceiras.reduce((t, c) => t + c.notas, 0), cor: COR_GRUPO.Terceirizado, rotulo: "terceirizadas" },
                  { n: notasCd, cor: COR_GRUPO["No CD"], rotulo: "no CD" },
                ]}
              />
              <Legenda
                itens={[
                  { cor: COR_GRUPO["Próprio"], texto: `${fmt(proprias.reduce((t, c) => t + c.notas, 0))} nossas` },
                  { cor: COR_GRUPO.Terceirizado, texto: `${fmt(terceiras.reduce((t, c) => t + c.notas, 0))} terceirizadas` },
                  ...(notasCd > 0 ? [{ cor: COR_GRUPO["No CD"], texto: `${fmt(notasCd)} no CD` }] : []),
                ]}
              />
            </Destaque>
            <Destaque rotulo="Andamento das rotas" valor={pctTexto(r.andamento)}>
              <BarraFina
                total={r.notas}
                partes={[
                  { n: r.entregues + r.parciais, cor: COR.entregue, rotulo: "entregues" },
                  { n: r.naoEntregues, cor: COR.voltou, rotulo: "voltaram" },
                ]}
              />
              <Legenda
                itens={[
                  { cor: COR.entregue, texto: `${fmt(r.entregues + r.parciais)} entregues` },
                  { cor: COR.voltou, texto: `${fmt(r.naoEntregues)} ${r.naoEntregues === 1 ? "voltou" : "voltaram"}` },
                  { cor: "var(--surface-2)", texto: `${fmt(r.pendentes)} pendentes` },
                ]}
              />
            </Destaque>
            <Destaque rotulo="Produtos" valor={fmt(volumes.P + volumes.M + volumes.G + volumes.N)}>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                G {fmt(volumes.G)} · M {fmt(volumes.M)} · P {fmt(volumes.P)}
                {volumes.N > 0 ? ` · ${fmt(volumes.N)} sem porte` : ""}
              </p>
            </Destaque>
            <Destaque rotulo="Cargas" valor={fmt(rotas.cargas.length)}>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {r.emRota} em rota · {noCd.length} no CD
              </p>
              {paradas > 0 && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                  <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />
                  {paradas} sem baixa há mais de {tempo(MINUTOS_SEM_BAIXA_ALERTA)}
                </p>
              )}
            </Destaque>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Grupo grupo="Próprio" titulo="Nossos" cargas={proprias} agora={agora} onAbrir={setAberta} />
            <Grupo grupo="Terceirizado" titulo="Terceirizados" cargas={terceiras} agora={agora} onAbrir={setAberta} />
          </div>

          {noCd.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Ainda no CD, sem motorista:
              </span>
              {noCd.map((c) => (
                <button
                  key={c.carga}
                  type="button"
                  onClick={() => setAberta(c)}
                  className="text-xs px-3 py-1.5 rounded-full tabular-nums transition-colors hover:bg-[var(--surface-2)]"
                  style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}
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
