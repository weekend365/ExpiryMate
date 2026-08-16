export function normalizeBarcode(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  if (digits.length === 12) return digits.padStart(13, "0");
  if (digits.length === 8 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return null;
}

export function isValidGtin(value: string) {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) {
    return false;
  }
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;
  const sum = digits
    .reverse()
    .reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
      0,
    );
  return (10 - (sum % 10)) % 10 === checkDigit;
}
