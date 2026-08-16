import { createHmac } from "node:crypto";

export function formatCoupangSignedDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(2);
  return `${year}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function createCoupangAuthorization(input: {
  method: string;
  pathWithQuery: string;
  accessKey: string;
  secretKey: string;
  signedAt?: Date;
}) {
  const signedDate = formatCoupangSignedDate(input.signedAt ?? new Date());
  const [path, query = ""] = input.pathWithQuery.split("?");
  const message = `${signedDate}${input.method.toUpperCase()}${path}${query}`;
  const signature = createHmac("sha256", input.secretKey)
    .update(message)
    .digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${input.accessKey}, signed-date=${signedDate}, signature=${signature}`;
}
