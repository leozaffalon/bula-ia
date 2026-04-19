import { ApiError } from "./analyze.js";
import { recordRateLimited } from "./telemetry.js";

const ipBuckets = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 12;

export function getClientId(headersLike) {
  const forwardedFor = getHeaderValue(headersLike, "x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    getHeaderValue(headersLike, "x-real-ip") ||
    getHeaderValue(headersLike, "cf-connecting-ip") ||
    "unknown"
  );
}

export function enforceRateLimit(clientId) {
  const now = Date.now();
  const bucket = ipBuckets.get(clientId) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    recordRateLimited();
    throw new ApiError(
      429,
      "Muitas analises em pouco tempo. Aguarde um pouco antes de tentar novamente."
    );
  }

  recent.push(now);
  ipBuckets.set(clientId, recent);
}

function getHeaderValue(headersLike, name) {
  if (!headersLike) {
    return "";
  }

  if (typeof headersLike.get === "function") {
    return headersLike.get(name) || "";
  }

  return headersLike[name] || headersLike[name.toLowerCase()] || "";
}
