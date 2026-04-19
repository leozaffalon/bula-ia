import { analyzeMedicineImage, ApiError } from "./analyze.js";
import { getCachedAnalysis, setCachedAnalysis } from "./analysis-cache.js";
import { buildOfficialSources } from "./official-sources.js";
import { enforceRateLimit } from "./request-guard.js";
import {
  getTelemetrySnapshot,
  recordAnalyzeError,
  recordAnalyzeStart,
  recordAnalyzeSuccess
} from "./telemetry.js";
import { getRuntimeConfig } from "./runtime-config.js";

export async function performAnalysisRequest({
  image,
  hints,
  apiKey,
  clientId,
  fetchImpl
}) {
  enforceRateLimit(clientId);
  recordAnalyzeStart();

  const cached = getCachedAnalysis(image);

  if (cached) {
    recordAnalyzeSuccess({ durationMs: 0, cacheHit: true });
    return cached;
  }

  const startedAt = Date.now();

  try {
    const result = await analyzeMedicineImage({
      image,
      hints,
      apiKey,
      fetchImpl
    });

    const finalResult = {
      ...result,
      analysis: {
        ...result.analysis,
        officialSources: buildOfficialSources(result.analysis)
      }
    };

    setCachedAnalysis(image, finalResult);
    recordAnalyzeSuccess({
      durationMs: Date.now() - startedAt,
      cacheHit: false
    });

    return finalResult;
  } catch (error) {
    recordAnalyzeError(error);
    throw error instanceof ApiError
      ? error
      : new ApiError(500, "Falha ao processar a analise.");
  }
}

export function getHealthPayload() {
  const config = getRuntimeConfig();

  return {
    ok: true,
    app: config.displayName,
    stage: config.stage,
    now: new Date().toISOString(),
    telemetry: getTelemetrySnapshot()
  };
}
