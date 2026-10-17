"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayCount } from "@/lib/kpi";

function formatDate(date: unknown) {
  if (typeof date !== "string") return "";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function VolumeChart({ data, title = "Volume de chamados por dia" }: { data: DayCount[]; title?: string }) {
  return (
    <div
      className="cartao p-5"
    >
      <h3 className="text-base font-semibold tracking-wide mb-4" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Design system 17/10/2026: só a grade horizontal, tracejada e
                clara, sem as linhas dos eixos. */}
            <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="3 6" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={36} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip
              labelFormatter={formatDate}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--series-1)"
              strokeWidth={1.75}
              fill="url(#volumeFill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
