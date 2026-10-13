"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Barra de filtros da aba Logística -- pedido do Victor 13/10/2026 ("mova
// todos os filtros para uma barra de ferramentas dedicada, alinhada
// horizontalmente no topo"). Selects compactos em vez das fileiras de
// pílulas: cabe numa linha só no desktop e quebra em blocos no celular.
// Cada troca navega pra mesma página com o parâmetro novo (a página é
// Server Component e lê tudo da URL).
type Opcao = { valor: string; rotulo: string };

const campo = "rounded-lg px-2.5 py-1.5 text-sm";
const campoStyle = { border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" };

function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {rotulo}
      </span>
      {children}
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
  atualizadoEm,
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
  atualizadoEm: string;
}) {
  const router = useRouter();
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
    <div
      className="rounded-xl p-4 flex flex-wrap items-end gap-x-5 gap-y-3 shadow-sm"
      style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}
    >
      <Grupo rotulo="Período">
        <select className={campo} style={campoStyle} value={preset} onChange={(e) => trocarPeriodo(e.target.value)}>
          {presets.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
          <option value="custom">Datas livres</option>
        </select>
      </Grupo>
      <Grupo rotulo="De / até">
        <span className="flex items-center gap-1.5">
          <input
            type="date"
            className={campo}
            style={campoStyle}
            value={datas.de}
            max={datas.ate}
            onChange={(e) => setDatas((d) => ({ ...d, de: e.target.value }))}
          />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            até
          </span>
          <input
            type="date"
            className={campo}
            style={campoStyle}
            value={datas.ate}
            min={datas.de}
            onChange={(e) => setDatas((d) => ({ ...d, ate: e.target.value }))}
          />
          {datasMudaram && datas.de && datas.ate && (
            <button
              type="button"
              onClick={() => ir({ periodo: undefined, de: datas.de, ate: datas.ate })}
              className="text-sm font-semibold rounded-lg px-3 py-1.5"
              style={{ background: "var(--brand-green)", color: "#fff" }}
            >
              Aplicar
            </button>
          )}
        </span>
      </Grupo>
      <span aria-hidden className="hidden lg:block self-stretch w-px" style={{ background: "var(--border)" }} />
      <Grupo rotulo="Tipo de carga">
        <select className={campo} style={campoStyle} value={tipo ?? ""} onChange={(e) => ir({ tipo: e.target.value || undefined })}>
          <option value="">Todos</option>
          {tipos.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </Grupo>
      <Grupo rotulo="Veículo">
        <select className={campo} style={campoStyle} value={veiculo ?? ""} onChange={(e) => ir({ veiculo: e.target.value || undefined })}>
          <option value="">Todos</option>
          {veiculos.map((v) => (
            <option key={v.valor} value={v.valor}>
              {v.rotulo}
            </option>
          ))}
        </select>
      </Grupo>
      <Grupo rotulo="Motoristas">
        <select className={campo} style={campoStyle} value={vinculo ?? ""} onChange={(e) => ir({ vinculo: e.target.value || undefined })}>
          <option value="">Todos</option>
          {vinculos.map((v) => (
            <option key={v.valor} value={v.valor}>
              {v.rotulo}
            </option>
          ))}
        </select>
      </Grupo>
      {/* Página é force-dynamic: o horário é o do render de verdade.
          "Atualizar" recarrega a mesma URL (dados ao vivo em TV/reunião). */}
      <button
        type="button"
        onClick={() => router.refresh()}
        className="ml-auto flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5"
        style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        <RefreshCw aria-hidden size={13} />
        Atualizado às {atualizadoEm}
      </button>
    </div>
  );
}
