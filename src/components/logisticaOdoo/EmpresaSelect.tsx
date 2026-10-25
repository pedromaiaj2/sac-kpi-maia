"use client";

import { usePathname, useRouter } from "next/navigation";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";

export function EmpresaSelect({ empresas, atual }: { empresas: EmpresaOdoo[]; atual: number }) {
  const router = useRouter();
  const pathname = usePathname();
  if (!empresas.length) return null;
  return (
    <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
      Empresa
      <select
        value={atual}
        onChange={(e) => router.push(`${pathname}?empresa=${e.target.value}`)}
        className="rounded-lg border px-2 py-1.5 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
      >
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );
}
