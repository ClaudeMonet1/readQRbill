export type AmountResult = { ok: true; value: number | null } | { ok: false };

const MAX = 999_999_999.99;

export function parseAmount(s: string): AmountResult {
  const trimmed = s.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(trimmed)) return { ok: false };
  const v = Number(trimmed);
  if (!Number.isFinite(v) || v < 0 || v > MAX) return { ok: false };
  return { ok: true, value: v };
}
