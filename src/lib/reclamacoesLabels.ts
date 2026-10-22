// Reclamações (Procon/Reclame Aqui/Judicial) -- ver reclamacoes.ts/migration
// 0140. Listas de referência pro formulário (datalist, mesmo padrão de
// sugestão-com-texto-livre já usado em EditRequestForm.tsx/
// NovaEntregaAssistenciaForm.tsx) -- órgão e status não são enum fechado no
// banco (ver comentário na migration), essas listas são só sugestão pra
// digitar mais rápido e manter a grafia consistente com o histórico
// importado da planilha original.

export const ORGAO_OPTIONS = [
  "Procon Municipal de João Pessoa",
  "Procon Municipal de Campina Grande",
  "Procon Municipal de Bayeux",
  "Procon Estadual da Paraíba",
  "Reclame Aqui",
  "Judicial",
] as const;

// Ordem pensada como um fluxo -- ainda sem resposta -> aguardando alguém
// (nosso lado ou do cliente) -> sem contato -> resolvido por último, é o
// estado final que a maioria dos casos busca. "Sem informação/Sem resolução"
// (pedido do Victor 22/10/2026) é outro estado FINAL -- o caso foi encerrado
// sem conseguir resolver (diferente de "Resolvido", sucesso) -- por isso
// entra depois dele, não junto dos "aguardando"/"sem retorno" do meio do
// fluxo, que ainda estão em andamento.
export const STATUS_INTERNO_OPTIONS = [
  "Falta responder",
  "Aguardando retorno do gerente",
  "Aguardando retorno do fabricante",
  "Aguardando cliente ir à loja escolher novo produto",
  "Sem retorno do cliente",
  "Não conseguimos contato com o cliente",
  "Resolvido",
  "Sem informação/Sem resolução",
] as const;

// Cor de badge por status -- mesmo espírito de STATUS_ENCOMENDA_COLORS
// (assistenciaLabels.ts): "Resolvido" em verde, "Sem informação/Sem
// resolução" em vermelho (pedido do Victor 22/10/2026, pra destacar visualmente
// os casos encerrados sem solução), o resto (ainda em aberto, em algum grau)
// numa cor neutra/de atenção. Sem granularidade fina além disso (não é um
// workflow com etapas fixas tipo encomenda).
export function isStatusInternoResolvido(status: string): boolean {
  return status.trim().toLowerCase() === "resolvido";
}

export function isStatusInternoSemResolucao(status: string): boolean {
  return status.trim().toLowerCase() === "sem informação/sem resolução";
}

export function statusInternoColor(status: string): string {
  if (isStatusInternoResolvido(status)) return "var(--status-good)";
  if (isStatusInternoSemResolucao(status)) return "var(--status-critical)";
  return "var(--brand-orange)";
}

// Agrupamento por órgão pras abas da tela (pedido do Victor 29/09/2026) --
// os 4 Procons (municipais + estadual) viram uma aba só ("Procon"), já que
// separar cidade por cidade numa aba pra cada uma criaria mais abas do que
// casos por aba na maioria dos meses. Judicial/Reclame Aqui já são um
// órgão só cada, ficam com aba própria.
export type OrgaoGrupo = "procon" | "judicial" | "reclame_aqui";

export const ORGAO_GRUPO_LABELS: Record<OrgaoGrupo, string> = {
  procon: "Procon (todos)",
  judicial: "Judicial",
  reclame_aqui: "Reclame Aqui",
};

export function orgaoGrupo(orgao: string): OrgaoGrupo {
  const normalized = orgao.trim().toLowerCase();
  if (normalized === "judicial") return "judicial";
  if (normalized === "reclame aqui") return "reclame_aqui";
  return "procon";
}
