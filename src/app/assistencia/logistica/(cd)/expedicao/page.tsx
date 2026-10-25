import { lerCatalogos, lerExpedicao, listarEmpresas, mensagemDeErro } from "@/lib/odoo/logistica";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { ExpedicaoBoard } from "@/components/logisticaOdoo/ExpedicaoBoard";
import { EmpresaSelect } from "@/components/logisticaOdoo/EmpresaSelect";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Fila de expedição = tela "Entregas e Retiradas" do Roteirizador do
// Protheus: saídas sem carga, filtros (região, modo/ABA, pendência,
// retorno), volumes por categoria, seleção → montar carga, e os verbos por
// entrega (pendência, fila, filial, data, anotação, histórico).
export const dynamic = "force-dynamic";

export default async function ExpedicaoPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const empresa = empresaDaUrl((await searchParams).empresa);
  const [exp, cat, emps] = await Promise.allSettled([lerExpedicao(empresa), lerCatalogos(empresa), listarEmpresas()]);
  const empresas = emps.status === "fulfilled" ? emps.value : [];
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Fila de expedição · saídas sem carga
        </h2>
        <EmpresaSelect empresas={empresas} atual={empresa} />
      </div>
      {exp.status === "rejected" ? (
        <ErroOdoo titulo="Não consegui ler a fila do Odoo" mensagem={mensagemDeErro(exp.reason)} />
      ) : cat.status === "rejected" ? (
        <ErroOdoo titulo="Não consegui ler os cadastros (regiões, motoristas, veículos)" mensagem={mensagemDeErro(cat.reason)} />
      ) : (
        <ExpedicaoBoard companyId={empresa} expedicao={exp.value} catalogos={cat.value} empresas={empresas} />
      )}
    </div>
  );
}
