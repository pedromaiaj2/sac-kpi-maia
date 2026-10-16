// Popula a árvore de decisão do Arsenal do SAC (schema: 0174_arsenal_flow.sql)
// -- rodar manualmente uma vez, e de novo sempre que o conteúdo da árvore for
// revisado. Migrations não carregam dado de negócio, só schema -- mesmo
// padrão de scripts/seed-arsenal.ts.
//
// Uso: node --env-file=.env.local scripts/seed-arsenal-flow.ts
//
// Idempotente: upsert por slug (buildArsenalFlowSlug = caminho do pai +
// label normalizado). Nós são inseridos nível por nível (pai antes do
// filho) porque o slug do filho depende do slug do pai e o parent_id é o
// id de verdade gerado no banco.
//
// `active` é deliberadamente omitido do payload (mesmo motivo de
// seed-arsenal.ts): reimportar não deve reativar um nó que foi desativado
// manualmente pela tela de admin.

import { getSupabaseAdmin } from "../src/lib/supabaseAdmin.ts";
import { buildArsenalFlowSlug } from "../src/lib/arsenalFlow.ts";
import type { ArsenalCategory, ArsenalHighlightType } from "../src/lib/arsenalSac.ts";

type SeedNode = {
  label: string;
  question?: string;
  body?: string;
  highlightType?: ArsenalHighlightType;
  listCategory?: ArsenalCategory;
  children?: SeedNode[];
};

// Conteúdo aprovado pelo Victor (rascunho em artifact, 16/10/2026) -- texto
// reaproveitado ao máximo de scripts/seed-arsenal.ts (categoria processos/
// garantias/cdc), os 2 ramos novos (Produto errado, Atraso) marcados como
// tal nos comentários.
const TREE: SeedNode[] = [
  {
    label: "Produto chegou avariado/sujo",
    question: "O produto tem montagem?",
    children: [
      {
        label: "Sim, tem montagem",
        body: "Problema de peça avariada vai para a assistência técnica trocar só a peça.",
      },
      {
        label: "Não tem montagem",
        body:
          "O SAC troca o produto completo direto, conforme disponibilidade do produto e rota de entrega.\n" +
          "Abra a notificação de troca no Sistema Integrado (nome, endereço, bairro, telefone, código do cliente, CPF, loja, motivo, produto, código do produto, NF completa, observações).\n" +
          "Nunca deixe o produto avariado na casa do cliente -- recolha antes ou junto da entrega do novo; nunca os dois produtos na casa ao mesmo tempo.",
        highlightType: "atencao",
      },
    ],
  },
  // NOVO (16/10/2026) -- mesma lógica física do ramo acima, mas é erro de
  // separação/expedição, não defeito de fabricação.
  {
    label: "Produto errado veio na entrega",
    question: "O erro foi na separação/expedição, ou foi lançado errado no pedido desde a venda?",
    children: [
      {
        label: "Erro físico (cor, modelo ou peça errada)",
        question: "Tem montagem?",
        children: [
          {
            label: "Sim, tem montagem",
            body:
              "Confirme o erro comparando com a NF/pedido no Protheus antes de prosseguir.\n" +
              "Não é defeito de fabricação -- não entra na lógica de garantia (Art. 18), é troca direta por erro da operação.\n" +
              "Aciona a assistência técnica pra avaliar se ajusta só a peça errada ou se precisa do produto completo.",
          },
          {
            label: "Não tem montagem",
            body:
              "Confirme o erro comparando com a NF/pedido no Protheus antes de prosseguir.\n" +
              "SAC troca direto, conforme disponibilidade e rota -- mesma regra do produto avariado.\n" +
              "Nunca deixe os dois produtos na casa do cliente -- recolhe o errado antes/junto da entrega do certo.",
          },
        ],
      },
      {
        label: "Erro de lançamento no sistema (pedido errado desde a venda)",
        body: "Isso é erro de faturamento -- encaminhar direto para a loja resolver.",
      },
    ],
  },
  {
    label: "Cliente quer trocar por escolha própria (não é defeito)",
    body:
      "Analisar o caso primeiro -- não é troca automática por vício de fabricação, é pedido do cliente (não gostou, mudou de ideia, comprou errado etc.).\n" +
      "Na maioria dos casos, encaminhar para a loja fazer o pós-venda -- é a loja quem trata negociação de troca por pedido do cliente.",
  },
  // NOVO (16/10/2026) -- baseado no Art. 35 CDC, que já existia só como
  // referência solta, nunca como passo a passo de atendimento.
  {
    label: "Atraso -- não entregou no prazo",
    question: "O prazo já estourou, ou está perto de estourar?",
    children: [
      {
        label: "Perto de estourar (ainda dentro do prazo)",
        body:
          "Avisar o cliente proativamente, antes de ele cobrar -- evita que o caso vire reclamação/escalada.\n" +
          "Se o atraso é porque o produto está em falta/sem previsão, adiante isso também -- não deixe o cliente descobrir sozinho.",
      },
      {
        label: "Já estourou o prazo",
        body:
          "Oferecer proativamente as 3 opções do Art. 35, sem exigir justificativa do cliente: (i) exigir o cumprimento forçado (aguardar); (ii) aceitar um produto equivalente; (iii) cancelar com devolução do valor.\n" +
          "Entrega parcial conta como descumprimento também -- a parte que faltou segue a mesma lógica, não trate como 'quase tudo certo'.",
      },
    ],
  },
  {
    label: "Cliente quer cancelar / receber o dinheiro de volta",
    question: "A compra foi presencial na loja ou à distância (WhatsApp, telefone, site)?",
    children: [
      {
        label: "À distância, até 7 dias corridos do recebimento",
        body:
          "Direito de arrependimento (Art. 49) -- o cliente pode desistir sem precisar justificar.\n" +
          "Quem executa o cancelamento/estorno é sempre a loja -- o SAC aciona o gerente, não executa diretamente.",
        highlightType: "regra_ouro",
      },
      {
        label: "Presencial, ou fora dos 7 dias",
        body:
          "Não é direito de arrependimento automático -- depende do motivo (defeito, ver 'Produto chegou avariado/sujo'; atraso, ver 'Atraso -- não entregou no prazo') ou da política da loja.\n" +
          "Quem executa o cancelamento/estorno é sempre a loja.",
      },
    ],
  },
  {
    label: "Erro de faturamento",
    body: "Encaminhar direto para a loja resolver.",
  },
  {
    label: "Só uma dúvida sobre prazo de garantia",
    question: "Qual produto?",
    children: [
      {
        label: "Colchão",
        body:
          "Tecido -- prazo padrão 90 dias (3 meses): furos, rasgos, tramas soltas de origem, descolamento do pillow top.\n" +
          "Espuma -- prazo padrão 1 ano: deformação permanente (cedeu, geralmente 2 a 3 cm), esfarelamento, perda rápida de resiliência.\n" +
          "Molas/molejo -- prazo padrão 1 a 5 anos, varia por fabricante.\n" +
          "Prazo específico por fabricante: consulte 'Preciso de dados de um fornecedor/fabricante'.",
      },
      {
        label: "Sofá",
        body:
          "Segue o mesmo critério do colchão, por componente: estrutura de madeira (90 dias pra notificar avarias/vícios), espuma do assento (1 ano) e mecanismo retrátil (1 ano).",
      },
      {
        label: "Móvel de madeira ou vidro",
        body:
          "Madeira: 90 dias para notificar avarias ou vícios de fabricação.\n" +
          "Vidro: sem garantia contra avaria -- o dano precisa ser recusado/notificado no ato do recebimento.",
      },
    ],
  },
  {
    label: "Preciso falar com alguém (contato interno)",
    listCategory: "contatos_internos",
  },
  {
    label: "Preciso de dados de um fornecedor/fabricante",
    listCategory: "fornecedores",
  },
];

async function upsertLevel(nodes: SeedNode[], parentId: string | null, parentSlug: string | null) {
  const supabase = getSupabaseAdmin();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const slug = buildArsenalFlowSlug(parentSlug, node.label);
    const { data, error } = await supabase
      .from("arsenal_flow_nodes")
      .upsert(
        {
          parent_id: parentId,
          slug,
          label: node.label,
          question: node.question ?? null,
          body: node.body ?? null,
          highlight_type: node.highlightType ?? "normal",
          list_category: node.listCategory ?? null,
          order_index: i,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`${slug}: ${error.message}`);
    if (node.children?.length) {
      await upsertLevel(node.children, data!.id as string, slug);
    }
  }
}

async function main() {
  await upsertLevel(TREE, null, null);
  console.log("OK -- árvore do Arsenal SAC upsertada.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
