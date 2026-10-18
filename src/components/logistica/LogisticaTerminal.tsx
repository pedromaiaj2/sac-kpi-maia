"use client";

import { useState } from "react";
import { CargasMonitor } from "./CargasMonitor";
import { VolumePorteChart } from "./VolumePorteChart";
import { CausasVoltaChart } from "./CausasVoltaChart";
import { TabelaMotoristasOrdenavel, type TipoDetalheMotorista } from "./TabelaMotoristasOrdenavel";
import { Recolhivel } from "./Recolhivel";
import { MotivosInsucesso } from "./MotivosInsucesso";
import { AssistenciasMotorista } from "./AssistenciasMotorista";
import { InsucessosMotivo } from "./InsucessosMotivo";
import { CargasMotorista } from "./CargasMotorista";
import { VISITAS_MINIMAS, isMotivoLogistica } from "@/lib/logisticaFormat";
import type {
  AssistenciaEntrega,
  CargaEntregas,
  MotoristaEntregas,
  CausasVolta,
  InsucessoDetalhe,
  KpisEntregas,
  MotivoInsucesso,
  ProdutoPorte,
  VolumeDia,
} from "@/lib/kpisLogistica";

// Densidade alta (pedido do Victor 09/10/2026, 2ª rodada de refino:
// "p-1.5, space-y-1, text-xs... remova todo texto cinza explicativo
// renderizado direto na tela"): título com ícone "?" (ThHint) quando tem
// explicação -- nunca mais um parágrafo de texto solto ocupando espaço
// vertical. O texto completo continua acessível (tooltip nativo), só não
// fica mais sempre visível.
// Recolhe e expande (pedido do Victor 18/10/2026, ver Recolhivel.tsx).
function Secao({
  id,
  titulo,
  hint,
  className = "",
  children,
}: {
  id: string;
  titulo: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Recolhivel id={id} titulo={titulo} hint={hint} className={className}>
      {children}
    </Recolhivel>
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
  ocorrencias,
  insucessos,
  parciais,
  produtosPorte,
  regrasPorte,
  periodo,
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
  ocorrencias: KpisEntregas["ocorrencias"];
  insucessos: InsucessoDetalhe[];
  parciais: InsucessoDetalhe[];
  produtosPorte: ProdutoPorte[];
  regrasPorte: KpisEntregas["regrasPorte"];
  // período da tela (lista de assistências: entregas desse período)
  periodo: { de: string; ate: string };
}) {
  const nomes = Object.fromEntries(motoristas.map((m) => [m.codigo, m.nome ?? m.codigo]));
  // Um estado só pra todo detalhe por motorista na tabela de Índice de
  // Volta (pedido do Victor 16/10/2026: "todos os números fiquem
  // clicáveis") -- qual modal renderizar depende do tipo (ver
  // TabelaMotoristasOrdenavel.tsx, dono dos cliques).
  const [detalheAberto, setDetalheAberto] = useState<{ motorista: MotoristaEntregas; tipo: TipoDetalheMotorista } | null>(null);
  const [selecionado, setSelecionado] = useState<{ codigo: string; nome: string | null } | null>(null);

  function handleSelect(c: CargaEntregas) {
    if (!c.motorista) return;
    const codigo = c.motorista.codigo;
    const nome = c.motorista.nome;
    setSelecionado((prev) => (prev?.codigo === codigo ? null : { codigo, nome }));
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <Secao
          id="monitor-cargas"
          titulo="Monitor de Cargas"
          hint="Cargas do período, da mais recente. Falha logística (vermelho) = alguma nota voltou por falha do transporte (L01 rota estourada, L02 veículo quebrado...). Voltou (amarelo) = nota que voltou por cliente, CD (L06) ou outro motivo, ou cancelada. Concluída = todas as notas com o cliente. Em rota = ainda sem resultado de todas. Passe o mouse na carga pra ver os motivos; clique pra filtrar a tabela de motoristas pelo motorista dela."
        >
          <CargasMonitor cargas={cargas} ocorrencias={ocorrencias} selecionada={selecionado?.codigo ?? null} onSelect={handleSelect} />
        </Secao>
        <Secao
          id="produtos-porte"
          titulo={`Produtos por porte (P/M/G) · ${porDia.reduce((t, d) => t + d.P + d.M + d.G + d.naoClassificado, 0).toLocaleString("pt-BR")} produtos no total`}
          hint="Produtos (unidades) despachados por dia, pelo porte do produto: P pequeno, M médio, G grande. Passe o mouse numa barra pra ver os números do dia e quantos caminhões e Stradas estavam na rua. Na legenda, o total de produtos (unidades) de cada classe no período; embaixo do gráfico, cada classe dividida por grupo de produto (colchão, guarda-roupa, cadeira...). Clique numa classe pra ver quais produtos são dela e as regras que a definem."
          className="lg:col-span-2"
        >
          <VolumePorteChart data={porDia} produtos={produtosPorte} regras={regrasPorte} />
        </Secao>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <Secao
          id="causas-volta"
          titulo="Causas da Volta"
          hint="Tudo o que entra no Índice de Volta, por tipo: insucessos (pela categoria do motivo) e notas parciais. A soma das barras é o total de voltas do período."
        >
          <CausasVoltaChart causas={causasVolta} />
        </Secao>
        <Secao
          id="motivos-insucessos"
          titulo="Motivos dos insucessos"
          hint="Cada nota que voltou, pelo código de ocorrência lançado no Protheus. Nas barras: vermelho = logística (conta na Volta Logística); azul = L06, pedido não carregado (falha do CD); o resto é do cliente ou outros. Troque para Rosca pra ver a fatia de cada motivo. Clique num motivo pra ver as notas com cliente, CPF e produto."
          className="lg:col-span-2"
        >
          <MotivosInsucesso motivos={motivos} insucessos={insucessos} nomes={nomes} />
        </Secao>
      </div>

      <Secao
        id="indice-volta-motorista"
        titulo="Índice de Volta por motorista"
        hint={`Um motorista por linha. Passe o mouse no "i" de cada coluna pra ver o que ela significa. Motoristas com menos de ${VISITAS_MINIMAS} notas aparecem apagados (índice instável). Clique num cabeçalho pra ordenar.`}
      >
        <TabelaMotoristasOrdenavel
          motoristas={motoristas}
          produtos={produtos}
          filtroCodigo={selecionado?.codigo ?? null}
          onLimparFiltro={() => setSelecionado(null)}
          onAbrirDetalhe={(motorista, tipo) => setDetalheAberto({ motorista, tipo })}
        />
        {detalheAberto && (() => {
          const { motorista, tipo } = detalheAberto;
          const nome = motorista.nome ?? motorista.codigo;
          const fechar = () => setDetalheAberto(null);
          switch (tipo) {
            case "cargas":
              return <CargasMotorista nome={nome} itens={cargas.filter((c) => c.motorista?.codigo === motorista.codigo)} onFechar={fechar} />;
            case "insucessos":
              return (
                <InsucessosMotivo
                  titulo={`Insucessos · ${nome}`}
                  itens={insucessos.filter((i) => i.motoristaCodigo === motorista.codigo)}
                  nomes={nomes}
                  onFechar={fechar}
                />
              );
            case "parciais":
              return (
                <InsucessosMotivo
                  titulo={`Parciais · ${nome}`}
                  itens={parciais.filter((i) => i.motoristaCodigo === motorista.codigo)}
                  nomes={nomes}
                  onFechar={fechar}
                />
              );
            case "voltaTotal":
              return (
                <InsucessosMotivo
                  titulo={`Volta total · ${nome}`}
                  itens={[...insucessos, ...parciais].filter((i) => i.motoristaCodigo === motorista.codigo)}
                  nomes={nomes}
                  onFechar={fechar}
                />
              );
            case "voltaLogistica":
              return (
                <InsucessosMotivo
                  titulo={`Volta logística · ${nome}`}
                  itens={insucessos.filter((i) => i.motoristaCodigo === motorista.codigo && isMotivoLogistica(i.codigo))}
                  nomes={nomes}
                  onFechar={fechar}
                />
              );
            case "assistencias":
              return <AssistenciasMotorista nome={nome} itens={assistencias.filter((a) => a.motoristaCodigo === motorista.codigo)} periodo={periodo} onFechar={fechar} />;
            case "assistenciasErroMotorista":
              return (
                <AssistenciasMotorista
                  nome={`${nome} · erro do motorista`}
                  itens={assistencias.filter((a) => a.motoristaCodigo === motorista.codigo && a.causaRaiz === "erro_motorista")}
                  periodo={periodo}
                  onFechar={fechar}
                />
              );
            case "assistenciasAvariaTransporte":
              return (
                <AssistenciasMotorista
                  nome={`${nome} · avaria no transporte`}
                  itens={assistencias.filter((a) => a.motoristaCodigo === motorista.codigo && a.causaRaiz === "avaria_transporte")}
                  periodo={periodo}
                  onFechar={fechar}
                />
              );
          }
        })()}
      </Secao>
    </div>
  );
}
