"use client";

import { useState } from "react";
import { CargasMonitor } from "./CargasMonitor";
import { VolumePorteChart } from "./VolumePorteChart";
import { CausasVoltaChart } from "./CausasVoltaChart";
import { TabelaMotoristasOrdenavel } from "./TabelaMotoristasOrdenavel";
import { ThHint } from "./ThHint";
import { MotivosInsucesso } from "./MotivosInsucesso";
import { AssistenciasMotorista } from "./AssistenciasMotorista";
import { VISITAS_MINIMAS } from "@/lib/logisticaFormat";
import type { AssistenciaEntrega, CargaEntregas, MotoristaEntregas, CausasVolta, MotivoInsucesso, VolumeDia } from "@/lib/kpisLogistica";

// Densidade alta (pedido do Victor 09/10/2026, 2ª rodada de refino:
// "p-1.5, space-y-1, text-xs... remova todo texto cinza explicativo
// renderizado direto na tela"): título com ícone "?" (ThHint) quando tem
// explicação -- nunca mais um parágrafo de texto solto ocupando espaço
// vertical. O texto completo continua acessível (tooltip nativo), só não
// fica mais sempre visível.
function Secao({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-2.5 flex flex-col gap-2 min-w-0" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
      <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
        {hint ? <ThHint hint={hint}>{titulo}</ThHint> : titulo}
      </h2>
      {children}
    </section>
  );
}

// "Terminal" de logística -- evolução (pedido do Victor 09/10/2026) do
// redesenho anterior (PR #584), estilo home broker: grid de 3 colunas
// (Monitor de Cargas / Volume por Dia / Causas da Volta) + tabela de
// motoristas ordenável e filtrável clicando numa carga. Client Component
// só por causa do estado de seleção compartilhado entre o Monitor
// (coluna 1) e a tabela (abaixo) -- o resto (cálculo, regra de negócio)
// é idêntico ao que já existia, só reorganizado.
//
// Substitui, nessa página: os 2 Blocos "Causas da Volta"/"Volume por
// porte" de antes + a tabela `<details>` "Ver as N cargas" (o Monitor de
// Cargas cobre o mesmo propósito de navegar pelas cargas, com o adicional
// de filtrar a tabela ao clicar) + o Bloco "Índice de Volta por
// motorista" + o aviso de atribuição estimada (AvisoAtribuicao.tsx,
// removido 09/10/2026 -- texto virou o hint do título dessa seção).
export function LogisticaTerminal({
  cargas,
  motoristas,
  porDia,
  causasVolta,
  motivos,
  produtos,
  assistencias,
}: {
  cargas: CargaEntregas[];
  motoristas: MotoristaEntregas[];
  porDia: VolumeDia[];
  causasVolta: CausasVolta;
  motivos: MotivoInsucesso[];
  // Produtos (unidades) por código de motorista, calculado no servidor
  // (produtosPorMotorista) -- kpisLogistica.ts carrega o cliente do
  // Supabase e não pode entrar no bundle do navegador.
  produtos: Record<string, number>;
  assistencias: AssistenciaEntrega[];
}) {
  const [assistAberto, setAssistAberto] = useState<MotoristaEntregas | null>(null);
  const [selecionado, setSelecionado] = useState<{ codigo: string; nome: string | null } | null>(null);

  function handleSelect(c: CargaEntregas) {
    if (!c.motorista) return;
    const codigo = c.motorista.codigo;
    const nome = c.motorista.nome;
    setSelecionado((prev) => (prev?.codigo === codigo ? null : { codigo, nome }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <Secao
          titulo="Monitor de Cargas"
          hint="Cargas do período, da mais recente. Alerta = tem pedido não entregue ou cancelado; Concluída = tudo entregue; Em rota = ainda sem resultado de todos. Clique numa carga pra filtrar a tabela de motoristas pelo motorista dela; clique de novo pra limpar."
        >
          <CargasMonitor cargas={cargas} selecionada={selecionado?.codigo ?? null} onSelect={handleSelect} />
        </Secao>
        <Secao titulo="Produtos por porte (P/M/G)" hint="Produtos (unidades) despachados por dia, pelo porte do produto: P pequeno, M médio, G grande.">
          <VolumePorteChart data={porDia} />
        </Secao>
        <Secao
          titulo="Causas da Volta"
          hint="Tudo o que entra no Índice de Volta, por tipo: insucessos (pela categoria do motivo) e entregas parciais. A soma das barras é o total de voltas do período."
        >
          <CausasVoltaChart causas={causasVolta} />
        </Secao>
      </div>

      <Secao
        titulo="Motivos dos insucessos"
        hint="Cada pedido que voltou sem entregar, pelo código de ocorrência lançado no Protheus. Vermelho = logística (conta na Volta Logística); L06 = pedido não carregado (falha do CD); o resto é do cliente ou outros."
      >
        <MotivosInsucesso motivos={motivos} />
      </Secao>

      <Secao
        titulo="Índice de Volta por motorista"
        hint={`Um motorista por linha. Passe o mouse no "i" de cada coluna pra ver o que ela significa. Motoristas com menos de ${VISITAS_MINIMAS} visitas aparecem apagados (índice instável). Clique num cabeçalho pra ordenar.`}
      >
        <TabelaMotoristasOrdenavel
          motoristas={motoristas}
          produtos={produtos}
          filtroCodigo={selecionado?.codigo ?? null}
          onLimparFiltro={() => setSelecionado(null)}
          onAbrirAssistencias={setAssistAberto}
        />
        {assistAberto && (
          <AssistenciasMotorista
            nome={assistAberto.nome ?? assistAberto.codigo}
            itens={assistencias.filter((a) => a.motoristaCodigo === assistAberto.codigo)}
            onFechar={() => setAssistAberto(null)}
          />
        )}
      </Secao>
    </div>
  );
}
