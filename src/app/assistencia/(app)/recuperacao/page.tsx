import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { montarFila, type ClienteRecuperacao } from "@/lib/recuperacao";
import {
  RECUPERACAO_DONO_ID,
  STATUS_ENCERRADOS,
  STATUS_RECUPERACAO,
  STATUS_RECUPERACAO_LABELS,
  CAUSAS_RECUPERACAO,
  CAUSA_RECUPERACAO_LABELS,
  type StatusRecuperacao,
} from "@/lib/recuperacaoCore";
import { hojeRecife } from "@/lib/vouchersCore";
import { CLIENTE_NIVEIS, CLIENTE_NIVEL_LABELS, CLIENTE_NIVEL_COLORS } from "@/lib/clientes";
import { StatTile } from "@/components/StatTile";
import { LinhaRecuperacao } from "@/components/recuperacao/LinhaRecuperacao";

export const dynamic = "force-dynamic";

const ABAS = [
  { key: "tratar", label: "A tratar" },
  { key: "atrasados", label: "Contato atrasado" },
  { key: "encerrados", label: "Encerrados" },
  { key: "todos", label: "Todos" },
] as const;
type Aba = (typeof ABAS)[number]["key"];

const POR_PAGINA = 100;

type Params = { aba?: string; origem?: string; status?: string; causa?: string; q?: string; mais?: string };

const campo = "text-sm rounded border px-2.5 py-1.5";
const campoStyle = { borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" };

function filtrar(fila: ClienteRecuperacao[], aba: Aba, p: Params, hoje: string) {
  const encerrado = (c: ClienteRecuperacao) => STATUS_ENCERRADOS.includes(c.status);
  let r = fila;
  if (aba === "tratar") r = r.filter((c) => !encerrado(c));
  if (aba === "atrasados") r = r.filter((c) => !encerrado(c) && !!c.proximoContato && c.proximoContato <= hoje);
  if (aba === "encerrados") r = r.filter(encerrado);
  if (p.origem === "detrator") r = r.filter((c) => c.casos.some((x) => x.tipo === "detrator"));
  if (p.origem === "estorno") r = r.filter((c) => c.casos.some((x) => x.tipo === "estorno"));
  if (p.origem === "ambos") r = r.filter((c) => c.casos.some((x) => x.tipo === "detrator") && c.casos.some((x) => x.tipo === "estorno"));
  if (p.status && (STATUS_RECUPERACAO as readonly string[]).includes(p.status)) r = r.filter((c) => c.status === p.status);
  if (p.causa === "sem") r = r.filter((c) => !c.causa);
  else if (p.causa) r = r.filter((c) => c.causa === p.causa);
  const q = p.q?.trim().toLowerCase();
  if (q) {
    const d = q.replace(/\D/g, "");
    r = r.filter((c) => c.nome.toLowerCase().includes(q) || (d.length >= 3 && ((c.cpf ?? "").includes(d) || (c.telefone ?? "").includes(d))));
  }
  return r;
}

// Central de Recuperação -- pedido do Victor 14/10/2026: uma tela só dele
// com os clientes a recontatar (detratores + estornos, todo o histórico),
// juntos por cliente e ordenados por prioridade.
export default async function RecuperacaoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const profile = await getProfile();
  if (profile.id !== RECUPERACAO_DONO_ID) redirect("/assistencia");
  const p = await searchParams;
  const aba: Aba = ABAS.some((a) => a.key === p.aba) ? (p.aba as Aba) : "tratar";
  const hoje = hojeRecife();
  const fila = await montarFila();
  const lista = filtrar(fila, aba, p, hoje);
  const limite = POR_PAGINA * Math.max(1, Math.min(50, Number(p.mais) || 1));

  const conta = (s: StatusRecuperacao) => fila.filter((c) => c.status === s).length;
  const abertos = fila.filter((c) => !STATUS_ENCERRADOS.includes(c.status));
  const atrasados = abertos.filter((c) => c.proximoContato && c.proximoContato <= hoje).length;
  const recuperados = conta("recuperado");
  const perdidos = conta("perdido");
  const taxa = recuperados + perdidos > 0 ? recuperados / (recuperados + perdidos) : null;
  const comprouDepois = fila.filter((c) => c.comprouDepois).length;
  const vouchersUsados = fila.filter((c) => c.voucher?.status === "usado").length;
  const niveis = Object.fromEntries(CLIENTE_NIVEIS.map((n) => [n, { label: CLIENTE_NIVEL_LABELS[n], cor: CLIENTE_NIVEL_COLORS[n] }]));

  const href = (extra: Partial<Params>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...p, ...extra })) if (v) q.set(k, String(v));
    const s = q.toString();
    return `/assistencia/recuperacao${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Central de Recuperação
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Detratores de todas as pesquisas e clientes que pediram estorno, juntos por cliente e em ordem de prioridade. Só você vê esta tela.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatTile label="A tratar" value={abertos.length} accent="var(--brand-orange)" note={`${conta("novo")} ainda sem contato`} />
        <StatTile label="Contato atrasado" value={atrasados} accent="var(--status-critical)" />
        <StatTile label="Recuperados" value={recuperados} accent="var(--status-good)" />
        <StatTile label="Perdidos" value={perdidos} accent="var(--text-muted)" />
        <StatTile
          label="Taxa de recuperação"
          value={taxa === null ? "—" : `${(taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
          note="recuperados ÷ (recuperados + perdidos)"
        />
        <StatTile label="Compraram depois" value={comprouDepois} accent="var(--series-5)" note={`${vouchersUsados} usaram voucher`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {ABAS.map((a) => (
          <Link
            key={a.key}
            href={href({ aba: a.key, mais: undefined })}
            className="text-sm px-3 py-2 -mb-px font-semibold"
            style={{
              color: aba === a.key ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: aba === a.key ? "2px solid var(--brand-orange)" : "2px solid transparent",
            }}
          >
            {a.label}
          </Link>
        ))}
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="aba" value={aba} />
        <input name="q" defaultValue={p.q ?? ""} placeholder="Nome, CPF ou telefone" className={`${campo} flex-1 min-w-[200px]`} style={campoStyle} />
        <select name="origem" defaultValue={p.origem ?? ""} className={campo} style={campoStyle}>
          <option value="">Detratores e estornos</option>
          <option value="detrator">Só detratores</option>
          <option value="estorno">Só estornos</option>
          <option value="ambos">Detrator e estorno</option>
        </select>
        <select name="status" defaultValue={p.status ?? ""} className={campo} style={campoStyle}>
          <option value="">Todos os status</option>
          {STATUS_RECUPERACAO.map((s) => (
            <option key={s} value={s}>
              {STATUS_RECUPERACAO_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="causa" defaultValue={p.causa ?? ""} className={campo} style={campoStyle}>
          <option value="">Todas as causas</option>
          <option value="sem">Sem causa</option>
          {CAUSAS_RECUPERACAO.map((s) => (
            <option key={s} value={s}>
              {CAUSA_RECUPERACAO_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="text-sm font-semibold px-4 py-1.5 rounded" style={{ background: "var(--brand-orange)", color: "#fff" }}>
          Filtrar
        </button>
        <Link href={`/assistencia/recuperacao?aba=${aba}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Limpar
        </Link>
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {lista.length} cliente{lista.length === 1 ? "" : "s"}
        {lista.length > limite ? ` · mostrando os ${limite} primeiros` : ""}
      </p>

      {lista.length === 0 ? (
        <p className="text-sm rounded-lg p-6 text-center" style={{ background: "var(--surface-1)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          Nenhum cliente aqui.
        </p>
      ) : (
        <ul className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
          {lista.slice(0, limite).map((c, i) => (
            <LinhaRecuperacao key={c.chave} c={c} posicao={i + 1} hoje={hoje} niveis={niveis} />
          ))}
        </ul>
      )}
      {lista.length > limite ? (
        <Link href={href({ mais: String(limite / POR_PAGINA + 1) })} className="self-center text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Mostrar mais {Math.min(POR_PAGINA, lista.length - limite)}
        </Link>
      ) : null}
    </div>
  );
}
