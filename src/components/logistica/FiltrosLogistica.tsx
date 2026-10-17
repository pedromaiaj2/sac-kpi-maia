"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Barra de filtros da aba Logística -- pedido do Victor 13/10/2026 ("mova
// todos os filtros para uma barra de ferramentas dedicada, alinhada
// horizontalmente no topo"). Painel escuro 17/10/2026: período em pílulas
// (estilo seletor de player) e os demais filtros como pílulas com o rótulo
// dentro. Cada troca navega pra mesma página com o parâmetro novo (a página
// é Server Component e lê tudo da URL).
type Opcao = { valor: string; rotulo: string };

const pilula = "rounded-full text-sm px-3.5 py-1.5";
const pilulaStyle = { background: "var(--surface-1)", color: "var(--text-primary)" };

function SelectPilula({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: string;
  opcoes: Opcao[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className={`${pilula} inline-flex items-center gap-2`} style={pilulaStyle}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {rotulo}
      </span>
      <select className="bg-transparent font-medium outline-none cursor-pointer" value={valor} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FiltrosLogistica({
  preset,
  de,
  ate,
  tipo,
  veiculo,
  vinculo,
  presets,
  tipos,
  veiculos,
  vinculos,
  dadosDe,
  dadosAtrasados,
}: {
  preset: string;
  de: string;
  ate: string;
  tipo?: string;
  veiculo?: string;
  vinculo?: string;
  presets: Opcao[];
  tipos: Opcao[];
  veiculos: Opcao[];
  vinculos: Opcao[];
  // Hora (Recife) da última sincronização com o Protheus que deu certo --
  // é a idade dos dados, não a hora em que a página abriu.
  dadosDe: string | null;
  dadosAtrasados: boolean;
}) {
  const router = useRouter();
  // Tela de acompanhamento ao vivo (pedido do Victor 17/10/2026): recarrega
  // sozinha a cada 2 min enquanto está visível -- as cargas do dia chegam do
  // Protheus a cada 10 min (rodada rápida do sync).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 2 * 60_000);
    return () => clearInterval(id);
  }, [router]);
  const [datas, setDatas] = useState({ de, ate });
  const custom = preset === "custom";

  function ir(mudanca: Record<string, string | undefined>) {
    const atual: Record<string, string | undefined> = {
      ...(custom ? { de, ate } : { periodo: preset }),
      tipo,
      veiculo,
      vinculo,
      ...mudanca,
    };
    const q = new URLSearchParams(Object.entries(atual).filter((e): e is [string, string] => !!e[1]));
    const s = q.toString();
    router.push(s ? `/kpis/logistica?${s}` : "/kpis/logistica");
  }

  function trocarPeriodo(valor: string) {
    if (valor === "custom") {
      ir({ periodo: undefined, de: datas.de, ate: datas.ate });
    } else {
      ir({ periodo: valor, de: undefined, ate: undefined });
    }
  }

  const datasMudaram = datas.de !== de || datas.ate !== ate;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-full p-1 gap-0.5" role="group" aria-label="Período" style={{ background: "var(--surface-1)" }}>
          {[...presets, { valor: "custom", rotulo: "Datas livres" }].map((p) => {
            const ativo = preset === p.valor;
            return (
              <button
                key={p.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => trocarPeriodo(p.valor)}
                className="rounded-full text-sm px-3.5 py-1.5 font-medium transition-colors"
                style={{ background: ativo ? "var(--text-primary)" : "transparent", color: ativo ? "var(--canvas)" : "var(--text-secondary)" }}
              >
                {p.rotulo}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ml-auto inline-flex items-center gap-1.5 text-xs rounded-full px-3.5 py-2"
          style={{
            color: dadosAtrasados ? "var(--text-primary)" : "var(--text-secondary)",
            background: dadosAtrasados ? "color-mix(in srgb, var(--status-warning) 22%, var(--surface-1))" : "var(--surface-1)",
          }}
          title="As cargas do dia vêm do Protheus a cada 10 min e o resto a cada 30. A tela recarrega sozinha a cada 2 min; clique pra recarregar agora."
        >
          <RefreshCw aria-hidden size={13} />
          {dadosDe ? `Dados do Protheus das ${dadosDe}${dadosAtrasados ? " (atrasado)" : ""}` : "Sem sincronização recente"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {custom && (
          <span className={`${pilula} inline-flex items-center gap-2`} style={pilulaStyle}>
            <input
              type="date"
              aria-label="De"
              className="bg-transparent outline-none"
              value={datas.de}
              max={datas.ate}
              onChange={(e) => setDatas((d) => ({ ...d, de: e.target.value }))}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              até
            </span>
            <input
              type="date"
              aria-label="Até"
              className="bg-transparent outline-none"
              value={datas.ate}
              min={datas.de}
              onChange={(e) => setDatas((d) => ({ ...d, ate: e.target.value }))}
            />
            {datasMudaram && datas.de && datas.ate && (
              <button
                type="button"
                onClick={() => ir({ periodo: undefined, de: datas.de, ate: datas.ate })}
                className="text-xs font-semibold rounded-full px-3 py-1"
                style={{ background: "var(--brand-green)", color: "#fff" }}
              >
                Aplicar
              </button>
            )}
          </span>
        )}
        <SelectPilula rotulo="Tipo de carga" valor={tipo ?? ""} opcoes={tipos} onChange={(v) => ir({ tipo: v })} />
        <SelectPilula rotulo="Veículo" valor={veiculo ?? ""} opcoes={veiculos} onChange={(v) => ir({ veiculo: v })} />
        <SelectPilula rotulo="Motoristas" valor={vinculo ?? ""} opcoes={vinculos} onChange={(v) => ir({ vinculo: v })} />
      </div>
    </div>
  );
}
