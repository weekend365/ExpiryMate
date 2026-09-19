export function decimalToNumber(
  value: { toNumber?: () => number } | number | string | null,
) {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return 0;
}
