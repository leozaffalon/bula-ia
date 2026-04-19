import { createHash } from "node:crypto";

const CACHE_TTL_MS = 60 * 60 * 1000;
const analysisCache = new Map();

export function getCachedAnalysis(image) {
  const key = createCacheKey(image);
  const entry = analysisCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    analysisCache.delete(key);
    return null;
  }

  return entry.value;
}

export function setCachedAnalysis(image, value) {
  analysisCache.set(createCacheKey(image), {
    value,
    createdAt: Date.now()
  });
}

function createCacheKey(image) {
  return createHash("sha256").update(image).digest("hex");
}
