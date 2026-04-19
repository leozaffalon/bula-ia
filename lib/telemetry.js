const metrics = {
  analyzeRequests: 0,
  analyzeSuccess: 0,
  analyzeErrors: 0,
  cacheHits: 0,
  rateLimited: 0,
  totalDurationMs: 0,
  lastErrorMessage: "",
  lastErrorAt: "",
  startedAt: new Date().toISOString()
};

export function recordAnalyzeStart() {
  metrics.analyzeRequests += 1;
}

export function recordAnalyzeSuccess({ durationMs, cacheHit = false }) {
  metrics.analyzeSuccess += 1;
  metrics.totalDurationMs += durationMs;

  if (cacheHit) {
    metrics.cacheHits += 1;
  }
}

export function recordAnalyzeError(error) {
  metrics.analyzeErrors += 1;
  metrics.lastErrorMessage = error?.message || "Erro desconhecido";
  metrics.lastErrorAt = new Date().toISOString();
}

export function recordRateLimited() {
  metrics.rateLimited += 1;
}

export function getTelemetrySnapshot() {
  const successfulCalls = Math.max(1, metrics.analyzeSuccess);

  return {
    ...metrics,
    averageDurationMs: Math.round(metrics.totalDurationMs / successfulCalls)
  };
}
