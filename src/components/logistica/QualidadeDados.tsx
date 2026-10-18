import type { QualidadeDadosLogistica } from "@/lib/kpisLogistica";

// Bloco "Qualidade dos dados" (revisão 18/10/2026): lançamentos do Protheus
// que distorcem a tela, pra corrigir na origem. Fechado por padrão.
function dataBr(iso: string | null) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function Lista({ titulo, explicacao, linhas }: { titulo: string; explicacao: string; linhas: { chave: string; carga: string; texto: string }[] }) {
  return (
    <details className="group rounded-xl" style={{ background: "var(--surface-2)" }}>
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {titulo}
        </span>
        <span
          className="text-xs font-bold tabular-nums rounded-full px-2.5 py-0.5"
          style={{
            background: linhas.length > 0 ? "color-mix(in srgb, var(--status-warning) 22%, transparent)" : "var(--surface-1)",
            color: "var(--text-primary)",
          }}
        >
          {linhas.length}
        </span>
      </summary>
      <div className="px-4 pb-4 flex flex-col gap-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {explicacao}
        </p>
        {linhas.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Nada no período.
          </p>
        ) : (
          <ul className="divide-y text-xs" style={{ borderColor: "var(--border)" }}>
            {linhas.map((l) => (
              <li key={l.chave} className="flex gap-3 py-2" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>
                  #{l.carga}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{l.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function QualidadeDados({ dados }: { dados: QualidadeDadosLogistica }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
      <Lista
        titulo="Previsão incoerente"
        explicacao="Baixa mais de 3 dias antes da previsão (ZAG_DTPREV) ou mais de 7 dias depois. A carga entra no dia da previsão, então some do período certo."
        linhas={dados.previsaoIncoerente.map((c) => ({
          chave: c.carga,
          carga: c.carga,
          texto: `previsão ${dataBr(c.previsao)}, baixas ${dataBr(c.primeiraBaixa)}${c.ultimaBaixa !== c.primeiraBaixa ? ` a ${dataBr(c.ultimaBaixa)}` : ""}${c.motorista ? ` · ${c.motorista}` : ""}`,
        }))}
      />
      <Lista
        titulo="Transportadora diferente da do motorista"
        explicacao="A carga foi lançada com uma transportadora de vínculo diferente do motorista. A tela segue o motorista; vale corrigir o lançamento."
        linhas={dados.transportadoraDivergente.map((c) => ({
          chave: c.carga,
          carga: c.carga,
          texto: `${dataBr(c.previsao)} · ${c.motorista ?? "—"} (${c.vinculoMotorista.toLowerCase()}${c.transportadoraMotorista ? `, ${c.transportadoraMotorista}` : ""}) com transportadora ${c.transportadora} (${c.vinculoTransportadora.toLowerCase()})`,
        }))}
      />
      <Lista
        titulo="Carga própria sem placa"
        explicacao="Veículo lançado sem placa (AIAM, FRETIST...) e motorista sem veículo cadastrado: a carga fica em Não identificado na grade. Lançar a placa ou cadastrar o motorista."
        linhas={dados.semPlaca.map((c) => ({
          chave: c.carga,
          carga: c.carga,
          texto: `${dataBr(c.previsao)} · ${c.motorista ?? "sem motorista"} · veículo ${c.veiculo ?? "em branco"}`,
        }))}
      />
    </div>
  );
}
