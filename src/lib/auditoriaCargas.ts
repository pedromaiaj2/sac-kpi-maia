// Conferência noturna com o Protheus (pedido do Victor 18/10/2026: "todos os
// números fidedignos" -- auditoria rodando sozinha toda madrugada). Compara,
// carga a carga, o load=<carga> com o nosso banco: quem está na carga, a
// situação, previsão, data/hora da baixa, motorista, veículo, nota fiscal e
// os itens. Só a comparação, sem banco nem rede (testável).

export type ApiItem = { item?: string; produto?: string; quantidade?: number; statusCodigo?: string };
export type ApiCarga = {
  carga: string;
  dtPrevisao?: string;
  statusEntregaCodigo?: string;
  motorista?: { codigo?: string };
  veiculo?: string;
  invoice?: string;
  dtRetorno?: string;
  hrRetorno?: string;
  itens?: ApiItem[];
};
export type ApiPedido = { order: string; branch: string; cliente?: { documento?: string }; cargas?: ApiCarga[] };

export type LinhaAuditoria = {
  id: string;
  carga: string;
  status_entrega_codigo: string | null;
  dt_previsao: string | null;
  dt_retorno: string | null;
  hr_retorno: string | null;
  motorista_codigo: string | null;
  veiculo: string | null;
  nota_fiscal: string | null;
  totvs_deliveries: { pedido: string; filial_venda: string; client_cpf_cnpj: string | null } | null;
  totvs_delivery_carga_itens: { item: string; produto: string; quantidade: number; status_codigo: string | null }[];
};

export type TipoDivergencia =
  | "pedido faltando"
  | "pedido sobrando"
  | "situação"
  | "previsão"
  | "data da baixa"
  | "hora da baixa"
  | "motorista"
  | "veículo"
  | "nota fiscal"
  | "item faltando"
  | "item sobrando"
  | "item diferente";

export type Divergencia = {
  tipo: TipoDivergencia;
  carga: string;
  pedido: string; // "pedido/filial"
  detalhe: string;
  documento: string | null;
  // linha do banco (pedido sobrando): pra tirar se o Protheus confirmar
  linhaId?: string;
};

const txt = (v: unknown) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const dia = (v: unknown) => {
  const s = txt(v);
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : s.slice(0, 10);
};

export function compararCarga(carga: string, api: ApiPedido[], banco: LinhaAuditoria[]): Divergencia[] {
  const out: Divergencia[] = [];
  const porPedido = new Map(
    banco.filter((l) => l.totvs_deliveries).map((l) => [`${l.totvs_deliveries!.pedido}/${l.totvs_deliveries!.filial_venda}`, l])
  );
  const vistos = new Set<string>();

  for (const p of api) {
    const pedido = `${p.order}/${p.branch}`;
    vistos.add(pedido);
    const documento = txt(p.cliente?.documento);
    const b = porPedido.get(pedido);
    const add = (tipo: TipoDivergencia, detalhe: string) => out.push({ tipo, carga, pedido, detalhe, documento });
    if (!b) {
      add("pedido faltando", "no Protheus, não no painel");
      continue;
    }
    const c = (p.cargas ?? []).find((x) => x.carga === carga);
    if (!c) continue;
    const campos: [TipoDivergencia, string | null, string | null][] = [
      ["situação", txt(c.statusEntregaCodigo), txt(b.status_entrega_codigo)],
      ["previsão", dia(c.dtPrevisao), dia(b.dt_previsao)],
      ["data da baixa", dia(c.dtRetorno), dia(b.dt_retorno)],
      ["hora da baixa", txt(c.hrRetorno), txt(b.hr_retorno)],
      ["motorista", txt(c.motorista?.codigo), txt(b.motorista_codigo)],
      ["veículo", txt(c.veiculo), txt(b.veiculo)],
      ["nota fiscal", txt(c.invoice), txt(b.nota_fiscal)],
    ];
    for (const [tipo, protheus, painel] of campos) {
      if (protheus !== painel) add(tipo, `painel ${painel ?? "—"} · Protheus ${protheus ?? "—"}`);
    }

    // Sem o campo itens no payload, o sync não mexe nos itens -- nada a comparar.
    if (c.itens === undefined) continue;
    const apiItens = new Map<string, { produto: string; quantidade: number; status: string | null }>();
    for (const i of c.itens) {
      const item = txt(i.item);
      const produto = txt(i.produto);
      if (item && produto) apiItens.set(item, { produto, quantidade: Number(i.quantidade) || 0, status: txt(i.statusCodigo) });
    }
    const dbItens = new Map(b.totvs_delivery_carga_itens.map((i) => [i.item, i]));
    for (const [item, a] of apiItens) {
      const d = dbItens.get(item);
      if (!d) add("item faltando", `item ${item} (${a.produto})`);
      else if (d.produto !== a.produto || Number(d.quantidade) !== a.quantidade || txt(d.status_codigo) !== a.status) {
        add("item diferente", `item ${item}: painel ${d.produto} × ${d.quantidade} · Protheus ${a.produto} × ${a.quantidade}`);
      }
    }
    for (const item of dbItens.keys()) if (!apiItens.has(item)) add("item sobrando", `item ${item}`);
  }

  for (const [pedido, l] of porPedido) {
    if (vistos.has(pedido)) continue;
    out.push({
      tipo: "pedido sobrando",
      carga,
      pedido,
      detalhe: "no painel, não no Protheus",
      documento: l.totvs_deliveries?.client_cpf_cnpj ?? null,
      linhaId: l.id,
    });
  }
  return out;
}
