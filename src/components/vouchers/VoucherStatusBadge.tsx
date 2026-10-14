import { STATUS_VOUCHER_COLORS, STATUS_VOUCHER_LABELS, type StatusVoucher } from "@/lib/vouchersCore";

export function VoucherStatusBadge({ status }: { status: StatusVoucher }) {
  const cor = STATUS_VOUCHER_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${cor} 22%, var(--surface-1))` }}
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      {STATUS_VOUCHER_LABELS[status]}
    </span>
  );
}
