import crypto from "crypto";

export function bitgetSign(params: {
  timestamp: string;
  method: string;
  requestPath: string; // e.g. /api/v2/mix/order/fill-history
  queryString?: string; // e.g. productType=usdt-futures
  body?: string; // for POST
  secret: string;
}) {
  const method = params.method.toUpperCase();
  const qs = params.queryString ? `?${params.queryString}` : "";
  const body = params.body || "";
  const prehash = `${params.timestamp}${method}${params.requestPath}${qs}${body}`;
  return crypto.createHmac("sha256", params.secret).update(prehash).digest("base64");
}
