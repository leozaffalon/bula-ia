export function getRuntimeConfig(env = process.env) {
  const stage = normalizeStage(
    env.APP_STAGE || env.VERCEL_ENV || env.NODE_ENV || "beta"
  );
  const baseName = (env.APP_NAME || "ClaraBula").trim();

  return {
    baseName,
    stage,
    displayName: stage === "production" ? baseName : `${baseName}-${stage}`,
    stageLabel: stage === "production" ? "Ambiente de producao" : `Ambiente ${stage}`
  };
}

function normalizeStage(value) {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === "production" || normalized === "prod") {
    return "production";
  }

  if (normalized === "preview") {
    return "preview";
  }

  if (normalized === "development" || normalized === "dev") {
    return "development";
  }

  return "beta";
}
