import { ThHint } from "./ThHint";
import { LogisticaTerminal } from "./LogisticaTerminal";
import { IndiceTicker, type TickerItem } from "./IndiceTicker";
import { FiltrosLogistica } from "./FiltrosLogistica";
import { GradeVeiculos } from "./GradeVeiculos";
import { AssistenciasTotal } from "./AssistenciasTotal";
import { RotasDoDia } from "./RotasDoDia";
import { TIPOS_CARGA, TIPOS_VEICULO } from "@/lib/logisticaApi";
import {
  gradeVeiculos,
  produtosPorMotorista,
  resumirLogistica,
  volumesPorDia,
  calcularVariacao,
  VINCULOS,
  type KpisEntregas,
  type LinhaVeiculo,
  type Variacao,
} from "@/lib/kpisLogistica";
import type { RotasDoDia as Rotas } from "@/lib/rotasDoDiaCore";
import { num, pct, dataBr } from "@/lib/logisticaFormat";

// Rodada completa a cada 30 min e a rápida das cargas do dia a cada 10:
// passou de 45 min sem nenhuma das duas, alguma coisa falhou.
function syncAtrasado(ultimoSync: string | null): boolean {
  return !ultimoSync || Date.now() - Date.parse(ultimoSync) > 45 * 60_000;
}

const horaRecife = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" }).format(d);

// Card de seção do painel escuro (17/10/2026): sem borda dura, cantos bem
// arredondados e respiro. Título com ícone "i" (ThHint) em vez de texto
// solto. Mesmo padrão de Secao em LogisticaTerminal.tsx.
function Bloco({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-lg shadow-black/20" style={{ background: "var(--surface-1)" }}>
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
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

type Selecao = { preset: string; de: string; ate: string; tipo?: string; veiculo?: string; vinculo?: string };

// Tela de /kpis/logistica em si (painel escuro, 17/10/2026): recebe tudo já
// buscado pela página (page.tsx), só monta e desenha -- Rotas de hoje no
// topo, filtros e indicadores do período abaixo.
export function PainelLogistica({
  sel,
  presets,
  erro,
  kpis,
  kpisAnteriores,
  rotas,
  ultimoSync,
}: {
  sel: Selecao;
  presets: { valor: string; rotulo: string }[];
  // mensagem quando o período da URL é inválido
  erro: string | null;
  kpis: KpisEntregas | null;
  kpisAnteriores: KpisEntregas | null;
  rotas: Rotas | null;
  ultimoSync: string | null;
}) {
  const dadosAtrasados = syncAtrasado(ultimoSync);
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
          hint: "De cada 100 notas que saíram e voltaram com resultado, quantas voltaram com problema: (insucessos + parciais) ÷ notas. Nota que sai duas vezes conta duas: se voltou e foi entregue depois em outra carga, a visita que falhou continua contando (a lista mostra a situação de hoje). Mede o retrabalho, não a culpa do motorista. Verde até 5%, amarelo até 10%, vermelho acima.",
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
          hint: "Chamados de assistência técnica (troca, peça, recolhimento, envio de produto novo) referentes às notas entregues no período, pela data da entrega e não pelo dia em que o chamado foi aberto. Ligação: carga do chamado, cliente + produto ou, sem o produto, a nota mais recente ao cliente, nos 180 dias antes. Não entram no Índice de Volta. Segue os filtros da tela. Clique no número pra ver cada chamado.",
          label: "Assistências",
          largo: true,
          valor: num(kpis.assistencias.length),
          valorNode: (
            <AssistenciasTotal
              periodo={kpis.periodo}
              itens={kpis.assistencias}
              nomesMotoristas={Object.fromEntries(kpis.motoristas.map((m) => [m.codigo, m.nome ?? m.codigo]))}
            />
          ),
          complemento: `${num(kpis.assistenciasPeriodo.total - kpis.assistenciasPeriodo.vinculadas)} chamados abertos no período sem nota ligada (retirada, sem CPF...)`,
          variacao: variar(kpis.assistencias.length, kpisAnteriores?.assistencias.length ?? null, true),
          formatarDelta: formatarDeltaNum,
        },
      ]
    : [];

  return (
    // Rotas de hoje no topo e os indicadores do período abaixo, com os
    // filtros (17/10/2026). Menu lateral e tema vêm de AppShell (kpis/layout).
    <main className="flex-1 min-w-0 w-full max-w-[1440px] mx-auto px-4 sm:px-8 pt-6 pb-16 flex flex-col gap-8">
      {rotas && <RotasDoDia rotas={rotas} agora={horaRecife(new Date())} dadosDe={ultimoSync ? horaRecife(new Date(ultimoSync)) : null} />}

      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          <ThHint hint="Cargas despachadas pelo CD, notas e produtos por Strada e caminhão, motoristas próprios e terceirizados e o Índice de Volta de cada um (só o que aconteceu com a nota na rua). As assistências técnicas ligadas a cada motorista aparecem à parte, sem entrar no índice. O dia da carga é a previsão definida pelo CD (ZAG_DTPREV). O código 000058 (LOJAS MAIA TREINAMENTO) é o motorista em treinamento e entra nos números como qualquer outro.">
            Indicadores do período
          </ThHint>
        </h1>
        <FiltrosLogistica
          preset={sel.preset}
          de={sel.de}
          ate={sel.ate}
          tipo={sel.tipo}
          veiculo={sel.veiculo}
          vinculo={sel.vinculo}
          presets={presets}
          tipos={TIPOS_CARGA.filter((t) => t !== "Retirada").map((t) => ({ valor: t, rotulo: t }))}
          veiculos={TIPOS_VEICULO.map((v) => ({ valor: v, rotulo: v === "Carro" ? "Carro (Strada)" : v === "Não identificado" ? "Sem placa (não identificado)" : v }))}
          vinculos={VINCULOS.map((v) => ({ valor: v, rotulo: ROTULO_VINCULO[v] }))}
          dadosDe={ultimoSync ? horaRecife(new Date(ultimoSync)) : null}
          dadosAtrasados={dadosAtrasados}
        />
      </div>

      {erro || !kpis || !resumo ? (
        <p className="text-sm rounded-lg px-4 py-3" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
          {erro ?? "Sem dados."}
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
            parciais={kpis.parciais}
            produtosPorte={kpis.produtosPorte}
            regrasPorte={kpis.regrasPorte}
            periodo={kpis.periodo}
          />
        </>
      )}
    </main>
  );
}
