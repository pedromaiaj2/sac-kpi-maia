import { requireDashboardAuth } from "@/lib/dashboardSession";
import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { ThHint } from "@/components/logistica/ThHint";
import { LogisticaTerminal } from "@/components/logistica/LogisticaTerminal";
import { IndiceTicker, type TickerItem } from "@/components/logistica/IndiceTicker";
import { FiltrosLogistica } from "@/components/logistica/FiltrosLogistica";
import { parsePeriodoKpis, TIPOS_CARGA, TIPOS_VEICULO } from "@/lib/logisticaApi";
import {
  getKpisEntregas,
  gradeVeiculos,
  produtosPorMotorista,
  resumirLogistica,
  volumesPorDia,
  periodoAnterior,
  calcularVariacao,
  VINCULOS,
  type CelulaVeiculo,
  type LinhaVeiculo,
  type Variacao,
} from "@/lib/kpisLogistica";
import { num, pct, dataBr } from "@/lib/logisticaFormat";

export const dynamic = "force-dynamic";

// "Hoje"/"Ontem" -- pedido do Victor 09/10/2026 ("dinamismo de consulta
// retroativa... Hoje, Ontem"): janela de 1 dia só, achado pelo mesmo
// mecanismo de menosDias abaixo (n=0 pra hoje, aplicado nos dois limites
// pra virar 1 dia só em vez de intervalo).
const PRESETS = [
  { key: "hoje", label: "Hoje", dias: 1 },
  { key: "ontem", label: "Ontem", dias: 1, offsetDias: 1 },
  { key: "7", label: "7 dias", dias: 7 },
  { key: "30", label: "30 dias", dias: 30 },
  { key: "mes", label: "Este mês", dias: null },
  { key: "90", label: "90 dias", dias: 90 },
] as const;

function hojeRecife(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());
}

function menosDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type Params = { periodo?: string; de?: string; ate?: string; tipo?: string; veiculo?: string; vinculo?: string };

function resolverPeriodo(params: Params) {
  const hoje = hojeRecife();
  const tipo = params.tipo && (TIPOS_CARGA as readonly string[]).includes(params.tipo) ? params.tipo : undefined;
  const veiculo = params.veiculo && (TIPOS_VEICULO as readonly string[]).includes(params.veiculo) ? params.veiculo : undefined;
  const vinculo = params.vinculo && (VINCULOS as readonly string[]).includes(params.vinculo) ? params.vinculo : undefined;
  if (params.de || params.ate) {
    return { preset: "custom", de: params.de ?? "", ate: params.ate ?? hoje, tipo, veiculo, vinculo };
  }
  const preset = PRESETS.find((p) => p.key === params.periodo) ?? PRESETS.find((p) => p.key === "30")!;
  const offsetDias = "offsetDias" in preset ? preset.offsetDias : 0;
  const ate = offsetDias > 0 ? menosDias(hoje, offsetDias) : hoje;
  const de = preset.dias === null ? `${hoje.slice(0, 8)}01` : menosDias(ate, preset.dias - 1);
  return { preset: preset.key, de, ate, tipo, veiculo, vinculo };
}

// Card de seção: borda verde 2px (padrão do painel) + sombra leve e mais
// respiro (pedido do Victor 13/10/2026). Título com ícone "i" (ThHint) em
// vez de texto explicativo solto. Mesmo padrão de Secao em LogisticaTerminal.tsx.
function Bloco({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-sm" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
      <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        {hint ? <ThHint hint={hint}>{titulo}</ThHint> : titulo}
      </h2>
      {children}
    </section>
  );
}

const th = "px-2 py-1.5 font-semibold whitespace-nowrap";
const thStyle = { color: "var(--text-secondary)" };

const ROTULO_VINCULO: Record<string, string> = { "Próprio": "Próprios", Terceirizado: "Terceirizados" };
const COR_VINCULO: Record<string, string> = { "Próprio": "var(--brand-green)", Terceirizado: "var(--series-5)" };

const porCarga = (n: number, cargas: number) =>
  cargas > 0 ? (n / cargas).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—";

function Celula({ c, total, destaque }: { c: CelulaVeiculo; total: number; destaque?: boolean }) {
  return (
    <td className="px-3 py-2 text-right align-top">
      <span className={`block tabular-nums ${destaque ? "text-lg font-bold" : "text-base font-semibold"}`} style={{ color: "var(--text-primary)" }}>
        {num(c.entregas)}
        {total > 0 && (
          <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
            {pct(c.entregas / total)}
          </span>
        )}
      </span>
      <span className="block text-[11px] tabular-nums whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
        {num(c.cargas)} cargas · {num(c.pedidos)} pedidos · {num(c.produtos)} produtos
      </span>
      <span className="block text-[11px] tabular-nums whitespace-nowrap font-semibold" style={{ color: "var(--text-secondary)" }}>
        por carga: {porCarga(c.produtos, c.cargas)} produtos · {porCarga(c.pedidos, c.cargas)} pedidos
      </span>
    </td>
  );
}

// Grade vínculo x veículo -- pedido do Victor 13/10/2026: separar os
// motoristas nossos dos terceirizados e mostrar quantas entregas são
// feitas pelas Stradas e pelos caminhões. % = fatia das entregas do período.
function GradeVeiculos({ linhas }: { linhas: LinhaVeiculo[] }) {
  const total = linhas[linhas.length - 1].total.entregas;
  return (
    <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <th className={`${th} text-left`} style={thStyle}>
              <ThHint hint="Próprios = cargas da nossa frota (TRANSP. LOJAS MAIA, EXPRESSA). Terceirizados = cargas de transportadora de fora (Ronaldo, THZ, D&A, Alenilson, Santos...). Vale a transportadora de cada carga.">
                Motoristas
              </ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Fiat Strada: as placas fixas do Eduardo, Joalison e Joanderson (e a TPA9E78, compartilhada).">Strada (carro)</ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Todo veículo que não é Strada." lado="direita">
                Caminhão
              </ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Número grande = entregas (completas ou parciais) e a fatia do total. Abaixo: cargas, pedidos e produtos (unidades) nas cargas do período, e a média por carga." lado="direita">
                Total
              </ThHint>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const ehTotal = l.vinculo === "Total";
            const cor = COR_VINCULO[l.vinculo] ?? "var(--text-muted)";
            return (
              <tr
                key={l.vinculo}
                className="border-b"
                style={{ borderColor: "var(--border)", background: ehTotal ? "var(--surface-2)" : undefined }}
              >
                <td className="px-3 py-2 align-top">
                  <span className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                    {!ehTotal && <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cor }} />}
                    {ROTULO_VINCULO[l.vinculo] ?? l.vinculo}
                  </span>
                </td>
                <Celula c={l.Carro} total={total} />
                <Celula c={l["Caminhão"]} total={total} />
                <Celula c={l.total} total={total} destaque />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatarDeltaPct(d: number): string {
  return `${d >= 0 ? "+" : ""}${(d * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;
}

function formatarDeltaNum(d: number): string {
  return `${d >= 0 ? "+" : ""}${num(d)}`;
}

// `atual` pode ser null (sem visita/entrega no período) -- calcularVariacao
// exige número, então aqui vira "sem variação" direto, sem forçar 0 (0
// seria uma mentira: não significa "zero", significa "não dá pra medir").
function variar(atual: number | null, anterior: number | null, menorEhMelhor?: boolean): Variacao {
  if (atual === null) return { atual: 0, anterior, delta: null, melhorou: null };
  return calcularVariacao(atual, anterior, menorEhMelhor);
}

// Sub-aba "Logística" de KPIs (08/10/2026, redesenhada 09/10/2026 em 2
// rodadas -- ver PR #584 e o "terminal" em LogisticaTerminal.tsx). Mesmos
// dados do GET /api/logistica/v1/kpis/logistica, lidos direto no servidor
// (RPC kpis_logistica) -- definições em lojas-maia-integracao/apis/
// logistica-v1/kpis-logistica.md.
export default async function KpisLogisticaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireDashboardAuth();
  const params = await searchParams;
  const sel = resolverPeriodo(params);
  const vinculo = sel.vinculo ?? null;
  const parsed = parsePeriodoKpis(
    new URLSearchParams({
      de: sel.de,
      ate: sel.ate,
      ...(sel.tipo ? { tipo: sel.tipo } : {}),
      ...(sel.veiculo ? { tipoVeiculo: sel.veiculo } : {}),
    }),
  );

  // Tela só de entregas (RPC kpis_entregas, migração 0162) -- pedido do
  // Victor 13/10/2026: Índice de Volta só com a entrega; as assistências
  // vêm à parte por motorista (migração 0163).
  // Período anterior (mesma duração, ver periodoAnterior) buscado em
  // paralelo, só pra alimentar o ticker de variação -- pedido do Victor
  // 09/10/2026 ("estilo home broker", comparação com período anterior).
  // Falha nessa busca extra não derruba a página (.catch(() => null)):
  // sem período anterior, o ticker mostra "sem período anterior" em vez
  // de erro.
  const [kpis, kpisAnteriores] = parsed.ok
    ? await Promise.all([
        getKpisEntregas({ ...parsed.periodo, vinculo }),
        getKpisEntregas({ ...periodoAnterior(sel.de, sel.ate), tipo: parsed.periodo.tipo, tipoVeiculo: parsed.periodo.tipoVeiculo, vinculo }).catch(
          () => null,
        ),
      ])
    : [null, null];
  const resumo = kpis ? resumirLogistica(kpis) : null;
  const resumoAnterior = kpisAnteriores ? resumirLogistica(kpisAnteriores) : null;
  const porDia = kpis ? volumesPorDia(kpis) : [];
  const grade = kpis ? gradeVeiculos(kpis) : [];

  const tickerItems: TickerItem[] = resumo
    ? [
        {
          key: "volta",
          hint: "De cada 100 visitas, quantas voltaram com problema: (insucessos + entregas parciais) ÷ visitas. Visita = cada vez que um pedido saiu numa carga e voltou com resultado. Mede o retrabalho, não a culpa do motorista. Verde até 5%, amarelo até 10%, vermelho acima.",
          label: "Índice de Volta",
          valor: pct(resumo.indiceVolta),
          variacao: variar(resumo.indiceVolta, resumoAnterior?.indiceVolta ?? null, true),
          formatarDelta: formatarDeltaPct,
        },
        {
          key: "volta-logistica",
          hint: "Só a parte da volta que é falha do transporte: insucessos com motivo de logística (L01 rota estourada, L02 veículo quebrado...) ÷ visitas. L06 (pedido não carregado) é do CD e fica fora.",
          label: "Volta Logística",
          valor: pct(resumo.indiceVoltaLogistica),
          variacao: variar(resumo.indiceVoltaLogistica, resumoAnterior?.indiceVoltaLogistica ?? null, true),
          formatarDelta: formatarDeltaPct,
        },
        {
          key: "entregas",
          hint: "Visitas com o produto entregue (completa ou parcial), pela data da visita.",
          label: "Entregas",
          valor: num(resumo.entregasRealizadas),
          variacao: variar(resumo.entregasRealizadas, resumoAnterior?.entregasRealizadas ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "entregas-strada",
          hint: "Entregas (completas ou parciais) feitas nas Fiat Strada.",
          label: "Strada",
          valor: num(resumo.entregasCarro),
          variacao: variar(resumo.entregasCarro, resumoAnterior?.entregasCarro ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "entregas-caminhao",
          hint: "Entregas (completas ou parciais) feitas em caminhão (todo veículo que não é Strada).",
          label: "Caminhão",
          valor: num(resumo.entregasCaminhao),
          variacao: variar(resumo.entregasCaminhao, resumoAnterior?.entregasCaminhao ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "cargas",
          hint: "Cargas despachadas pelo CD com previsão (ZAG_DTPREV) no período.",
          label: "Cargas",
          valor: num(resumo.cargas),
          variacao: variar(resumo.cargas, resumoAnterior?.cargas ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "pedidos",
          hint: "Pedidos dentro das cargas do período.",
          label: "Pedidos",
          valor: num(resumo.pedidos),
          variacao: variar(resumo.pedidos, resumoAnterior?.pedidos ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "volume",
          hint: "Produtos (unidades) dentro das cargas do período: soma das quantidades dos itens.",
          label: "Produtos",
          valor: num(resumo.volumes.total),
          variacao: variar(resumo.volumes.total, resumoAnterior?.volumes.total ?? null),
          formatarDelta: formatarDeltaNum,
        },
      ]
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-12 flex flex-col gap-7">
      <AppHeader />
      <KpisSectionTabs active="logistica" />

      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        <ThHint hint="Cargas despachadas pelo CD, entregas por Strada e caminhão, motoristas próprios e terceirizados e o Índice de Volta de cada um (só o que aconteceu na entrega). As assistências técnicas ligadas a cada motorista aparecem à parte, sem entrar no índice. O dia da carga é a previsão definida pelo CD (ZAG_DTPREV). A conta de treinamento (000058) fica fora.">
          Logística
        </ThHint>
      </h1>

      <FiltrosLogistica
        preset={sel.preset}
        de={sel.de}
        ate={sel.ate}
        tipo={sel.tipo}
        veiculo={sel.veiculo}
        vinculo={sel.vinculo}
        presets={PRESETS.map((p) => ({ valor: p.key, rotulo: p.label }))}
        tipos={TIPOS_CARGA.filter((t) => t !== "Retirada").map((t) => ({ valor: t, rotulo: t }))}
        veiculos={TIPOS_VEICULO.map((v) => ({ valor: v, rotulo: v === "Carro" ? "Carro (Strada)" : v }))}
        vinculos={VINCULOS.map((v) => ({ valor: v, rotulo: ROTULO_VINCULO[v] }))}
        atualizadoEm={new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" }).format(new Date())}
      />

      {!parsed.ok || !kpis || !resumo ? (
        <p className="text-sm rounded-lg px-4 py-3" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
          {parsed.ok ? "Sem dados." : parsed.erro.mensagem}
        </p>
      ) : (
        <>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {dataBr(kpis.periodo.de)} a {dataBr(kpis.periodo.ate)}
            {kpis.periodo.tipo ? ` · ${kpis.periodo.tipo}` : ""}
            {kpis.periodo.tipoVeiculo ? ` · ${kpis.periodo.tipoVeiculo}` : ""}
            {kpis.periodo.vinculo ? ` · motoristas ${ROTULO_VINCULO[kpis.periodo.vinculo]?.toLowerCase() ?? kpis.periodo.vinculo}` : ""}
          </p>

          <IndiceTicker items={tickerItems} labelComparacao="período anterior" />

          <Bloco
            titulo="Entregas e produtos por veículo"
            hint="Entregas = visitas com o produto entregue (completa ou parcial), pela data da visita. Cargas, pedidos e produtos pela data da carga (ZAG_DTPREV). Próprio ou terceirizado pela transportadora de cada carga no Protheus (TRANSP. LOJAS MAIA e EXPRESSA são nossas; Ronaldo Transportes, THZ, D&A, Alenilson, Santos e outras são terceirizadas) -- terceirizado dirigindo caminhão nosso conta nos próprios. % = fatia das entregas do período."
          >
            <GradeVeiculos linhas={grade} />
          </Bloco>

          <LogisticaTerminal
            cargas={kpis.cargas}
            motoristas={kpis.motoristas}
            porDia={porDia}
            causasVolta={resumo.causasVolta}
            motivos={kpis.motivosInsucesso}
            produtos={produtosPorMotorista(kpis.cargas)}
            assistencias={kpis.assistencias}
            ocorrencias={kpis.ocorrencias}
            insucessos={kpis.insucessos}
          />
        </>
      )}
    </div>
  );
}
