"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import {
  createArsenalFlowNode,
  updateArsenalFlowNode,
  setArsenalFlowNodeActive,
  moveArsenalFlowNode,
  type ArsenalFlowNodeInput,
} from "@/lib/arsenalFlow";
import { isArsenalCategory, isArsenalHighlightType } from "@/lib/arsenalSac";

const ARSENAL_PATH = "/assistencia/sac/arsenal";

type ArsenalFlowNodeFormInput = {
  parentId: string | null;
  label: string;
  question: string;
  body: string;
  highlightType: string;
  listCategory: string;
};

function validate(input: ArsenalFlowNodeFormInput): ArsenalFlowNodeInput {
  if (!input.label.trim()) throw new Error("Informe o rótulo do nó.");
  if (!isArsenalHighlightType(input.highlightType)) throw new Error("Destaque inválido.");
  if (input.listCategory && !isArsenalCategory(input.listCategory)) throw new Error("Categoria de lista inválida.");
  return {
    parentId: input.parentId,
    label: input.label,
    question: input.question.trim() || null,
    body: input.body.trim() || null,
    highlightType: input.highlightType,
    listCategory: input.listCategory && isArsenalCategory(input.listCategory) ? input.listCategory : null,
  };
}

export async function createArsenalFlowNodeAction(input: ArsenalFlowNodeFormInput): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await createArsenalFlowNode(validate(input));
  revalidatePath(ARSENAL_PATH);
}

export async function updateArsenalFlowNodeAction(id: string, input: ArsenalFlowNodeFormInput): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  // parentId nunca muda num update (reorganizar a árvore é um passo de
  // mover, não de editar -- ver moveArsenalFlowNode) -- só passa o resto.
  const { label, question, body, highlightType, listCategory } = validate(input);
  await updateArsenalFlowNode(id, { label, question, body, highlightType, listCategory });
  revalidatePath(ARSENAL_PATH);
}

export async function setArsenalFlowNodeActiveAction(id: string, active: boolean): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setArsenalFlowNodeActive(id, active);
  revalidatePath(ARSENAL_PATH);
}

export async function moveArsenalFlowNodeAction(id: string, direction: "up" | "down"): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await moveArsenalFlowNode(id, direction);
  revalidatePath(ARSENAL_PATH);
}
