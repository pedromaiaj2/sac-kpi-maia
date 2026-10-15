import { requireDashboardAuth } from "@/lib/dashboardSession";
import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { ThHint } from "@/components/logistica/ThHint";
import { LogisticaTerminal } from "@/components/logistica/LogisticaTerminal";
import { IndiceTicker, type TickerItem } from "@/components/logistica/IndiceTicker";
import { FiltrosLogistica } from "@/components/logistica/FiltrosLogistica";
import { GradeVeiculos } from "@/components/logistica/GradeVeiculos";
import { AssistenciasTotal } from "@/components/logistica/AssistenciasTotal";
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

const ROTULO_VINCULO: Record<string, string> = { "Próprio": "Próprios", Terceirizado: "Terceirizados" };

function formatarDeltaPct(d: number): string {
  return `${d >= 0 ? "+" : ""}${(d * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;
}

function formatarDeltaNum(d: number): string {
  return `${d >= 0 ? "+" : ""}${num(d)}`;
}

// `atual` pode ser null (sem nota no período) -- calcularVariacao
// exige número, então aqui vira "sem variação" direto, sem forçar 0 (0
// seria uma mentira: não significa "zero", significa "não dá pra medir").
function variar(atual: number | null, anterior: number | null, menorEhMelhor?: boolean): Variacao {
  if (atual === null) return { atual: 0, anterior, delta: null, melhorou: null };
  return calcularVariacao(atual, anterior, menorEhMelhor);
}

// Sub-aba "Logística" de KPIs (08/10/2026, redesenhada 09/10/2026 em 2
// rodadas -- ver PR #584 e o "terminal" em LogisticaTerminal.tsx). Lê a RPC
// kpis_entregas (migração 0169), NÃO a mesma RPC do GET
// /api/logistica/v1/kpis/logistica (kpis_logistica) -- são duas funções
// diferentes desde que a tela ficou restrita a só entregas (13/10/2026, ver
// comentário abaixo). indiceVolta/indiceVoltaLogistica foram realinhados
// entre as duas na revisão de 15/10/2026 (migração 0172), mas o resto do
// formato (posVenda/pecas agregado aqui vs. motivosInsucesso/produtosPorte
// só na API) continua diferente -- definições em lojas-maia-integracao/apis/
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
  const gradeAnterior = kpisAnteriores ? gradeVeiculos(kpisAnteriores) : [];
  const totalVeiculos = grade.at(-1);
  const totalVeiculosAnterior = gradeAnterior.at(-1);
  const notasPorCaminhao = (l: LinhaVeiculo | undefined) => (l && l["Caminhão"].cargas > 0 ? l["Caminhão"].pedidos / l["Caminhão"].cargas : null);

  // Média por dia de operação (dias com carga no período) -- pedido do
  // Victor 13/10/2026: o 1º card de KPIs mostra notas e produtos por dia.
  const porDiaDe = (n: number, dias: number) => (dias > 0 ? n / dias : null);
  const notasDia = resumo ? porDiaDe(resumo.pedidos, resumo.dias) : null;
  const notasDiaAnterior = resumoAnterior ? porDiaDe(resumoAnterior.pedidos, resumoAnterior.dias) : null;
  const decimal = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  const tickerItems: TickerItem[] = resumo && kpis
    ? [
        {
          key: "media-dia",
          hint: "Média por dia de operação (dias com carga no período; domingo sem carga não conta). Notas = notas que saíram nas cargas do CD (nota que volta e sai de novo conta de novo). Também: produtos (unidades) nas cargas e veículos na rua. Veículo = placa distinta nas cargas do dia; carga sem placa lançada usa a placa do motorista no dia ou conta pelo motorista (estimativa). A variação é das notas por dia.",
          label: "Média por dia",
          destaque: true,
          valor: `${decimal(notasDia)} notas`,
          complemento: `${decimal(resumo ? porDiaDe(resumo.volumes.total, resumo.dias) : null)} produtos · ${decimal(resumo?.caminhoesDia ?? null)} caminhões · ${decimal(resumo?.stradasDia ?? null)} Stradas · ${decimal(resumo?.naoIdentificadosDia ?? null)} sem placa`,
          variacao: variar(notasDia, notasDiaAnterior),
          formatarDelta: (d: number) => `${d >= 0 ? "+" : ""}${decimal(d)}`,
        },
        {
          key: "volta",
          hint: "De cada 100 notas que saíram e voltaram com resultado, quantas voltaram com problema: (insucessos + parciais) ÷ notas. Nota que sai duas vezes conta duas. Mede o retrabalho, não a culpa do motorista. Verde até 5%, amarelo até 10%, vermelho acima.",
          label: "Índice de Volta",
          valor: pct(resumo.indiceVolta),
          variacao: variar(resumo.indiceVolta, resumoAnterior?.indiceVolta ?? null, true),
          formatarDelta: formatarDeltaPct,
        },
        {
          key: "volta-logistica",
          hint: "Só a parte da volta que é falha do transporte: insucessos com motivo de logística (L01 rota estourada, L02 veículo quebrado...) ÷ notas. L06 (pedido não carregado) é do CD e fica fora.",
          label: "Volta Logística",
          valor: pct(resumo.indiceVoltaLogistica),
          variacao: variar(resumo.indiceVoltaLogistica, resumoAnterior?.indiceVoltaLogistica ?? null, true),
          formatarDelta: formatarDeltaPct,
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
          key: "notas",
          hint: "Notas dentro das cargas do período.",
          label: "Notas",
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
        {
          key: "notas-strada",
          hint: "Notas nas cargas das Fiat Strada.",
          label: "Notas Strada",
          valor: num(totalVeiculos?.Carro.pedidos ?? 0),
          variacao: variar(totalVeiculos?.Carro.pedidos ?? null, totalVeiculosAnterior?.Carro.pedidos ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "notas-caminhao",
          hint: "Notas nas cargas de caminhão. Cargas próprias sem placa ficam fora (Não identificado, na grade de veículos), então Strada + Caminhão pode não somar o total.",
          label: "Notas caminhão",
          valor: num(totalVeiculos?.["Caminhão"].pedidos ?? 0),
          variacao: variar(totalVeiculos?.["Caminhão"].pedidos ?? null, totalVeiculosAnterior?.["Caminhão"].pedidos ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "notas-por-caminhao",
          hint: "Média de notas por carga de caminhão (próprios e terceirizados). A logística considera normal de 16 a 20.",
          label: "Notas por caminhão",
          valor: decimal(notasPorCaminhao(totalVeiculos)),
          variacao: variar(notasPorCaminhao(totalVeiculos), notasPorCaminhao(totalVeiculosAnterior)),
          formatarDelta: (d: number) => `${d >= 0 ? "+" : ""}${decimal(d)}`,
        },
        {
          key: "assistencias",
          hint: "Chamados de assistência técnica abertos no período (troca, peça, recolhimento, envio de produto novo) ligados a uma nota que saiu numa carga (carga do chamado, cliente + produto ou, sem o produto, a nota mais recente ao cliente, nos 180 dias antes). Não entram no Índice de Volta. Segue os filtros da tela. Clique no número pra ver cada chamado.",
          label: "Assistências",
          largo: true,
          valor: num(kpis.assistencias.length),
          valorNode: (
            <AssistenciasTotal
              itens={kpis.assistencias}
              nomesMotoristas={Object.fromEntries(kpis.motoristas.map((m) => [m.codigo, m.nome ?? m.codigo]))}
            />
          ),
          complemento: `${num(kpis.assistenciasPeriodo.total - kpis.assistenciasPeriodo.vinculadas)} sem nota ligada (retirada, sem CPF...)`,
          variacao: variar(kpis.assistencias.length, kpisAnteriores?.assistencias.length ?? null, true),
          formatarDelta: formatarDeltaNum,
        },
      ]
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-12 flex flex-col gap-7">
      <AppHeader />
      <KpisSectionTabs active="logistica" />

      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        <ThHint hint="Cargas despachadas pelo CD, notas e produtos por Strada e caminhão, motoristas próprios e terceirizados e o Índice de Volta de cada um (só o que aconteceu com a nota na rua). As assistências técnicas ligadas a cada motorista aparecem à parte, sem entrar no índice. O dia da carga é a previsão definida pelo CD (ZAG_DTPREV). O código 000058 (LOJAS MAIA TREINAMENTO) é o motorista em treinamento e entra nos números como qualquer outro.">
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
        veiculos={TIPOS_VEICULO.map((v) => ({ valor: v, rotulo: v === "Carro" ? "Carro (Strada)" : v === "Não identificado" ? "Sem placa (não identificado)" : v }))}
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
            titulo="Notas e produtos por veículo"
            hint="Cargas, notas e produtos pela data da carga (ZAG_DTPREV). Por dia: média de veículos na rua nos dias com carga (placa distinta; sem placa, pelo motorista -- estimativa). Próprio ou terceirizado pela transportadora de cada carga no Protheus (TRANSP. LOJAS MAIA e EXPRESSA são nossas; Ronaldo Transportes, THZ, D&A, Alenilson, Santos e outras são terceirizadas) -- terceirizado dirigindo caminhão nosso conta nos próprios. % = fatia das notas do período."
          >
            <GradeVeiculos linhas={grade} dias={resumo.dias} />
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
            produtosPorte={kpis.produtosPorte}
            regrasPorte={kpis.regrasPorte}
          />
        </>
      )}
    </div>
  );
}
