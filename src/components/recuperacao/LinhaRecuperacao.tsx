"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageCircle, ClipboardCopy, Check } from "lucide-react";
import { salvarRecuperacaoAction, historicoRecuperacaoAction, type SalvarRecuperacaoState } from "@/app/assistencia/recuperacao-actions";
import {
  STATUS_RECUPERACAO,
  STATUS_RECUPERACAO_LABELS,
  STATUS_RECUPERACAO_COLORS,
  CAUSAS_RECUPERACAO,
  CAUSA_RECUPERACAO_LABELS,
} from "@/lib/recuperacaoCore";
import { STATUS_VOUCHER_LABELS, STATUS_VOUCHER_COLORS, primeiroNome, formatarCpf } from "@/lib/vouchersCore";
import type { ClienteRecuperacao } from "@/lib/recuperacao";

const dataBr = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
const campo = "text-sm rounded border px-2.5 py-1.5 w-full";
const campoStyle = { borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" };

const CAMPO_LABELS: Record<string, string> = { status: "Status", causa: "Causa", anotacao: "Anotação", proximo_contato: "Próximo contato" };

function Selo({ cor, children, title }: { cor: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${cor} 20%, var(--surface-1))` }}
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {children}
    </span>
  );
}

function whatsapp(tel: string, nome: string) {
  const d = tel.replace(/\D/g, "");
  const numero = d.length <= 11 ? `55${d.replace(/^0+/, "")}` : d;
  const msg = `Olá, ${primeiroNome(nome)}! Aqui é o Victor, da Lojas Maia. Vi que a sua experiência com a gente não foi como deveria e queria entender melhor e resolver. Podemos conversar?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

// Botão "Copiar roteiro" -- pedido do Victor 16/10/2026. `roteiro` já vem
// pronto do servidor (gerarRoteiro em recuperacao.ts, função pura montada
// com os dados do cliente) -- esse componente só cuida do clique/feedback,
// não gera texto nenhum (mesmo motivo de `niveis` vir por prop: lib do
// servidor não pode entrar no bundle do cliente).
function CopiarRoteiroButton({ roteiro }: { roteiro: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(roteiro);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Clipboard API pode falhar (navegador antigo, iframe sem permissão) --
      // sem fallback de seleção de texto aqui porque não tem um <textarea>
      // visível pra selecionar; só silencia, o botão continua clicável.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title="Copiar roteiro de ligação pra esse cliente"
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
      style={{
        border: `1px solid ${copiado ? "var(--status-good)" : "var(--border)"}`,
        color: copiado ? "var(--status-good)" : "var(--text-primary)",
      }}
    >
      {copiado ? <Check size={14} aria-hidden /> : <ClipboardCopy size={14} aria-hidden />}
      {copiado ? "Copiado!" : "Roteiro"}
    </button>
  );
}

// Rótulos/cores de nível vêm da página: clientes.ts puxa o cliente do banco
// (servidor) e não pode entrar no bundle do navegador.
export function LinhaRecuperacao({
  c,
  posicao,
  hoje,
  niveis,
  roteiro,
}: {
  c: ClienteRecuperacao;
  posicao: number;
  hoje: string;
  niveis: Record<string, { label: string; cor: string }>;
  roteiro: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<SalvarRecuperacaoState, FormData>(salvarRecuperacaoAction, undefined);
  const [historico, setHistorico] = useState<Awaited<ReturnType<typeof historicoRecuperacaoAction>> | null>(null);
  const [carregando, startHistorico] = useTransition();

  const atrasado = !!c.proximoContato && c.proximoContato < hoje;
  const ultimoEstorno = c.casos.find((x) => x.tipo === "estorno");
  const ultimoDetrator = c.casos.find((x) => x.tipo === "detrator");
  const linkVoucher = ultimoEstorno
    ? `/assistencia/vouchers/novo?estorno=${encodeURIComponent(ultimoEstorno.id)}`
    : ultimoDetrator
      ? `/assistencia/vouchers/novo?nps=${encodeURIComponent(ultimoDetrator.id)}`
      : "/assistencia/vouchers/novo";

  function abrir() {
    setAberto((v) => !v);
    if (!historico && !carregando) startHistorico(async () => setHistorico(await historicoRecuperacaoAction(c.chave)));
  }

  return (
    <li className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 py-3">
        <span className="w-7 text-right text-xs font-bold tabular-nums pt-0.5" style={{ color: "var(--text-muted)" }}>
          {posicao}
        </span>
        <div className="flex-1 min-w-[240px] flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {c.nome}
            </span>
            {c.nivel && niveis[c.nivel] ? <Selo cor={niveis[c.nivel].cor}>{niveis[c.nivel].label}</Selo> : null}
            {c.comprouDepois ? (
              <Selo cor="var(--status-good)" title={`Última compra em ${dataBr(c.ultimaCompra ?? "")}`}>
                comprou depois
              </Selo>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.casos.slice(0, 3).map((x) => (
              <span key={x.id} className="text-xs rounded px-1.5 py-0.5" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {dataBr(x.data)} · {x.titulo}
              </span>
            ))}
            {c.casos.length > 3 ? (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                +{c.casos.length - 3}
              </span>
            ) : null}
          </div>
          {c.motivos.length ? (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Prioridade: {c.motivos.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1 sm:min-w-[150px]">
          <Selo cor={STATUS_RECUPERACAO_COLORS[c.status]}>{STATUS_RECUPERACAO_LABELS[c.status]}</Selo>
          {c.causa ? (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {CAUSA_RECUPERACAO_LABELS[c.causa]}
            </span>
          ) : null}
          {c.proximoContato ? (
            <span className="text-xs font-semibold" style={{ color: atrasado ? "var(--status-critical)" : "var(--text-secondary)" }}>
              {atrasado ? "Atrasado: " : "Próximo contato: "}
              {dataBr(c.proximoContato)}
            </span>
          ) : null}
          {c.voucher ? (
            <Link href={`/assistencia/vouchers/${c.voucher.id}`} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
              <Selo cor={STATUS_VOUCHER_COLORS[c.voucher.status]}>voucher {STATUS_VOUCHER_LABELS[c.voucher.status].toLowerCase()}</Selo>
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {c.telefone ? (
            <a
              href={whatsapp(c.telefone, c.nome)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir conversa no WhatsApp"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "var(--text-primary)" }}
            >
              <MessageCircle size={14} aria-hidden />
              WhatsApp
            </a>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              sem telefone
            </span>
          )}
          {c.voucher?.status !== "ativo" ? (
            <Link href={linkVoucher} prefetch={false} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ border: "1px solid var(--brand-orange)", color: "var(--text-primary)" }}>
              🎟 Voucher
            </Link>
          ) : null}
          <CopiarRoteiroButton roteiro={roteiro} />
          <button
            type="button"
            onClick={abrir}
            aria-expanded={aberto}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Classificar
            {aberto ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </button>
        </div>
      </div>

      {aberto ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-3 pb-4 pl-14">
          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="chave" value={c.chave} />
            {c.detratores.map((d) => (
              <input key={`${d.origem}:${d.origemId}`} type="hidden" name="detrator" value={`${d.origem}:${d.origemId}|${d.motivo ?? ""}`} />
            ))}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Status
                <select name="status" defaultValue={c.status} className={campo} style={campoStyle}>
                  {STATUS_RECUPERACAO.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_RECUPERACAO_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Causa
                <select name="causa" defaultValue={c.causa ?? ""} className={campo} style={campoStyle}>
                  <option value="">—</option>
                  {CAUSAS_RECUPERACAO.map((s) => (
                    <option key={s} value={s}>
                      {CAUSA_RECUPERACAO_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Próximo contato
                <input type="date" name="proximo_contato" defaultValue={c.proximoContato ?? ""} className={campo} style={campoStyle} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Anotação
              <textarea name="anotacao" defaultValue={c.anotacao ?? ""} rows={3} className={campo} style={campoStyle} />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
              {state?.ok ? (
                <span className="text-xs" style={{ color: "var(--status-good)" }}>
                  Salvo.
                </span>
              ) : null}
              {state?.error ? (
                <span className="text-xs" style={{ color: "var(--status-critical)" }}>
                  {state.error}
                </span>
              ) : null}
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {c.cpf ? `CPF ${formatarCpf(c.cpf)}` : "Sem CPF"}
              {c.telefone ? ` · ${c.telefone}` : ""}
              {c.ultimaCompra ? ` · última compra ${dataBr(c.ultimaCompra)}` : ""}
              {c.detratores.length ? " · o status também vai para os detratores em Avaliações" : ""}
            </p>
          </form>

          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-col gap-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Casos
              </h4>
              {c.casos.map((x) => (
                <div key={x.id} className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>
                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {dataBr(x.data)} · {x.titulo}
                    {x.tipo === "estorno" ? <span style={{ color: x.pendente ? "var(--status-critical)" : "var(--text-muted)" }}> · {x.situacao}</span> : null}
                  </p>
                  {x.detalhe ? <p style={{ color: "var(--text-secondary)" }}>{x.detalhe}</p> : null}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Histórico
              </h4>
              {carregando ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Carregando…
                </p>
              ) : historico && historico.length ? (
                historico.map((h, i) => (
                  <p key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {new Date(h.em).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" })} · {CAMPO_LABELS[h.campo] ?? h.campo}:{" "}
                    {h.campo === "status" && h.para ? STATUS_RECUPERACAO_LABELS[h.para as keyof typeof STATUS_RECUPERACAO_LABELS] ?? h.para : h.campo === "causa" && h.para ? CAUSA_RECUPERACAO_LABELS[h.para as keyof typeof CAUSA_RECUPERACAO_LABELS] ?? h.para : (h.para ?? "—")}
                  </p>
                ))
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Nada registrado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
