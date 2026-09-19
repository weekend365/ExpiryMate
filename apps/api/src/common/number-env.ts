export function getNonNegativeIntegerEnv(name: string, fallback: number) {
  return Math.floor(getNonNegativeNumberEnv(name, fallback));
}

export function getNonNegativeNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}
