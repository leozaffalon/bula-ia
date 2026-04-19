import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./lib/analyze.js";
import { performAnalysisRequest, getHealthPayload } from "./lib/analysis-service.js";
import { getRuntimeConfig } from "./lib/runtime-config.js";
import { getClientId } from "./lib/request-guard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const envPath = path.join(__dirname, ".env");
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;

await loadEnvFile();

const port = Number(process.env.PORT || 3000);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (req.method === "POST" && pathname === "/api/analyze") {
      await handleAnalyze(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/config") {
      sendJson(res, 200, getRuntimeConfig(), { "Cache-Control": "no-store" });
      return;
    }

    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, getHealthPayload(), { "Cache-Control": "no-store" });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Metodo nao permitido." });
      return;
    }

    await serveStaticFile(req, res, pathname, req.method === "HEAD");
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }

    console.error(error);
    sendJson(res, 500, {
      error: "Ocorreu um erro interno ao processar a solicitacao."
    });
  }
});

server.listen(port, () => {
  console.log(`Servidor em http://localhost:${port}`);
});

async function handleAnalyze(req, res) {
  try {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("application/json")) {
      throw new ApiError(415, "Envie a requisicao em JSON.");
    }

    const body = await readJsonBody(req, MAX_REQUEST_BYTES);
    const result = await performAnalysisRequest({
      image: body?.image,
      hints: body?.hints,
      clientId: getClientId(req.headers),
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    });

    sendJson(res, 200, result, { "Cache-Control": "no-store" });
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }

    console.error(error);
    sendJson(res, 500, {
      error: "Ocorreu um erro interno ao processar a solicitacao."
    });
  }
}

async function serveStaticFile(req, res, pathname, headOnly = false) {
  const urlPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, urlPath));

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Acesso negado." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(headOnly ? undefined : file);
  } catch {
    sendJson(res, 404, { error: "Arquivo nao encontrado." });
  }
}

async function readJsonBody(req, maxBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;

    if (totalBytes > maxBytes) {
      throw new ApiError(
        413,
        "A imagem enviada e grande demais. Tente uma foto menor."
      );
    }

    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiError(400, "JSON invalido na requisicao.");
  }
}

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

async function loadEnvFile() {
  try {
    const raw = await fs.readFile(envPath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Arquivo .env e opcional.
  }
}
