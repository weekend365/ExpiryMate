const toStartOfDay = (value: Date | string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const addDays = (value: Date | string, days: number) => {
  const date = toStartOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const toIsoDate = (value: Date | string) => {
  const date = toStartOfDay(value);
  return date.toISOString();
};

export const formatDateKorean = (value: Date | string) => {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
};

export const formatDateKoreanCompact = (value: Date | string) => {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
};

export const calculateDaysLeftUntilExpiry = (
  expiryDate: Date | string,
  now: Date | string = new Date(),
) => {
  const target = toStartOfDay(expiryDate).getTime();
  const current = toStartOfDay(now).getTime();
  return Math.round((target - current) / (1000 * 60 * 60 * 24));
};
