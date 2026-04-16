import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, analyzeMedicineImage } from "./lib/analyze.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const envPath = path.join(__dirname, ".env");

await loadEnvFile();

const port = Number(process.env.PORT || 3000);

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/analyze") {
      await handleAnalyze(req, res);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Metodo nao permitido." });
      return;
    }

    await serveStaticFile(req, res);
  } catch (error) {
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
    const body = await readJsonBody(req);
    const result = await analyzeMedicineImage({
      image: body?.image,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    });

    sendJson(res, 200, result);
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

async function serveStaticFile(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.normalize(path.join(publicDir, urlPath));

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Acesso negado." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(file);
  } catch {
    sendJson(res, 404, { error: "Arquivo nao encontrado." });
  }
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
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
