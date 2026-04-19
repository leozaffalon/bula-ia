const form = document.querySelector("#upload-form");
const fileInput = document.querySelector("#medicine-image");
const previewWrap = document.querySelector("#preview-wrap");
const previewImage = document.querySelector("#preview-image");
const submitButton = document.querySelector("#submit-button");
const statusBox = document.querySelector("#status");
const resultBox = document.querySelector("#result");
const consentCheckbox = document.querySelector("#consent-checkbox");
const brandName = document.querySelector("#brand-name");
const footerBrand = document.querySelector("#footer-brand");
const heroBadge = document.querySelector("#hero-badge");
const healthNote = document.querySelector("#health-note");

const MAX_RAW_FILE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const OUTPUT_IMAGE_QUALITY = 0.82;

let imageDataUrl = "";
let barcodeHints = [];

bootstrapApp();

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    imageDataUrl = "";
    barcodeHints = [];
    previewWrap.classList.add("hidden");
    return;
  }

  try {
    validateSelectedFile(file);
    imageDataUrl = await optimizeImage(file);
    barcodeHints = await detectBarcodeHints(file);
    previewImage.src = imageDataUrl;
    previewWrap.classList.remove("hidden");
    statusBox.textContent =
      "Imagem otimizada com sucesso. Clique em analisar para gerar um resumo da bula.";
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";
  } catch (error) {
    imageDataUrl = "";
    previewWrap.classList.add("hidden");
    statusBox.textContent = error.message;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!imageDataUrl) {
    statusBox.textContent = "Selecione uma imagem antes de analisar.";
    return;
  }

  if (!consentCheckbox.checked) {
    statusBox.textContent =
      "Confirme o envio temporario da imagem para analise por IA antes de continuar.";
    return;
  }

  setLoadingState(true);
  statusBox.textContent =
    "Analisando a imagem e preparando um resumo seguro da bula...";
  resultBox.classList.add("hidden");
  resultBox.innerHTML = "";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: imageDataUrl,
        hints: {
          barcodeValues: barcodeHints
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel analisar a imagem.");
    }

    resultBox.innerHTML = renderAnalysis(data.analysis);
    resultBox.classList.remove("hidden");
    statusBox.textContent =
      "Resumo gerado. Confira com a bula oficial e com um profissional se houver qualquer duvida.";
  } catch (error) {
    statusBox.textContent = error.message;
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Analisando..." : "Analisar remedio";
  form.setAttribute("aria-busy", String(isLoading));
}

function validateSelectedFile(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error("A imagem original e grande demais. Use um arquivo de ate 12 MB.");
  }
}

async function optimizeImage(file) {
  const image = await loadImage(file);
  const { width, height } = getScaledSize(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Nao foi possivel preparar a imagem para analise.");
  }

  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/jpeg", OUTPUT_IMAGE_QUALITY);

  if (blob.size > MAX_OUTPUT_IMAGE_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.68);
  }

  if (blob.size > MAX_OUTPUT_IMAGE_BYTES) {
    throw new Error(
      "A imagem ainda ficou pesada demais apos a otimizacao. Tente cortar melhor a foto."
    );
  }

  return readFileAsDataUrl(blob);
}

async function detectBarcodeHints(file) {
  if (!("BarcodeDetector" in window)) {
    return [];
  }

  let bitmap;

  try {
    const supportedFormats = await window.BarcodeDetector.getSupportedFormats();

    if (!supportedFormats.length) {
      return [];
    }

    const detector = new window.BarcodeDetector({
      formats: supportedFormats
    });
    bitmap = await createImageBitmap(file);
    const detections = await detector.detect(bitmap);

    return Array.from(
      new Set(
        detections
          .map((item) => String(item.rawValue || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 3);
  } catch {
    return [];
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao abrir a imagem selecionada."));
    };

    image.src = objectUrl;
  });
}

function getScaledSize(width, height) {
  const largerSide = Math.max(width, height);

  if (largerSide <= MAX_IMAGE_DIMENSION) {
    return { width, height };
  }

  const scale = MAX_IMAGE_DIMENSION / largerSide;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao converter a imagem para envio."));
          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function renderAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") {
    return "<p>Nao foi possivel montar o resumo estruturado.</p>";
  }

  const medicine = analysis.identifiedMedicine || {};
  const summary = analysis.bulaResumo || {};

  return [
    createSection(
      "Remedio identificado",
      [
        createFact("Nome", medicine.name),
        createFact("Principio ativo", medicine.activeIngredient),
        createFact("Dosagem", medicine.dosage),
        createFact("Forma farmaceutica", medicine.pharmaceuticalForm),
        createConfidencePill(medicine.confidence),
        createParagraph(medicine.confidenceReason)
      ].join("")
    ),
    createSection(
      "Evidencias na imagem",
      createList(
        analysis.evidenceInImage,
        "Nao foi possivel ler evidencias suficientes na embalagem."
      )
    ),
    createSection(
      "Bula resumida",
      [
        createParagraph(summary.confidenceNote),
        createSubsection("Para que costuma ser usado", summary.commonUses),
        createSubsection("Cuidados gerais de uso", summary.generalCare),
        createSubsection("Alertas e contraindicacoes", summary.warnings),
        createSubsection(
          "Possiveis efeitos colaterais comuns",
          summary.commonSideEffects
        ),
        createSubsection(
          "Interacoes e cuidados importantes",
          summary.interactions
        )
      ].join("")
    ),
    createSection(
      "Limites da analise",
      createList(
        analysis.analysisLimits,
        "Nao houve detalhes adicionais sobre os limites da analise."
      )
    ),
    createSection(
      "Quando procurar um profissional",
      createList(
        analysis.seekProfessionalHelp,
        "Procure medico ou farmaceutico em caso de duvida sobre o uso."
      )
    ),
    createSection(
      "Fontes oficiais recomendadas",
      createOfficialSources(
        analysis.officialSources,
        medicine.name || medicine.activeIngredient
      )
    ),
    createSection("Aviso importante", createParagraph(analysis.finalDisclaimer))
  ].join("");
}

function createSection(title, content) {
  return `<h2>${escapeHtml(title)}</h2>${content}`;
}

function createFact(label, value) {
  if (!value) {
    return "";
  }

  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function createParagraph(value) {
  return value ? `<p>${escapeHtml(value)}</p>` : "";
}

function createConfidencePill(value) {
  if (!value) {
    return "";
  }

  return `<p><strong>Confianca:</strong> <span class="confidence-pill confidence-${escapeHtml(value)}">${escapeHtml(value)}</span></p>`;
}

function createSubsection(title, items) {
  return `<p><strong>${escapeHtml(title)}</strong></p>${createList(items, "Nao foi possivel confirmar este ponto com seguranca.")}`;
}

function createList(items, fallback) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p>${escapeHtml(fallback)}</p>`;
  }

  return `<ul>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function createOfficialSources(items, fallbackQuery) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<p>Nao ha links oficiais disponiveis para esta analise.</p>";
  }

  return `<div class="source-grid">${items
    .map((item) => createOfficialSourceCard(item, fallbackQuery))
    .join("")}</div>`;
}

function createOfficialSourceCard(item, fallbackQuery) {
  const label = escapeHtml(item?.label || "Fonte oficial");
  const description = escapeHtml(item?.description || "");
  const url = escapeHtml(item?.url || "#");
  const recommendedSearchTerm = escapeHtml(
    item?.recommendedSearchTerm || fallbackQuery || ""
  );
  const searchCopy = recommendedSearchTerm
    ? `<p><strong>Buscar por:</strong> ${recommendedSearchTerm}</p>`
    : "";

  return `<a class="source-card" href="${url}" target="_blank" rel="noreferrer">
    <strong>${label}</strong>
    <p>${description}</p>
    ${searchCopy}
  </a>`;
}

async function bootstrapApp() {
  await Promise.allSettled([loadRuntimeConfig(), loadHealth()]);
}

async function loadRuntimeConfig() {
  try {
    const response = await fetch("/api/config", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return;
    }

    const config = await response.json();
    const displayName = config?.displayName || "ClaraBula-beta";

    document.title = displayName;

    if (brandName) {
      brandName.textContent = displayName;
    }

    if (footerBrand) {
      footerBrand.textContent = displayName;
    }

    if (heroBadge) {
      heroBadge.textContent =
        config?.stage === "production"
          ? "Uso informativo com apoio de IA"
          : `Uso informativo com apoio de IA • ${config?.stageLabel || "beta"}`;
    }
  } catch {
    // Se a configuracao nao responder, mantemos o branding padrao da pagina.
  }
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const telemetry = payload?.telemetry || {};

    if (healthNote) {
      healthNote.textContent =
        `Ambiente ${escapeInlineText(payload?.stage || "beta")} ativo. ` +
        `${Number(telemetry.analyzeRequests || 0)} analises recebidas nesta instancia.`;
    }
  } catch {
    if (healthNote) {
      healthNote.textContent =
        "Ambiente beta ativo. O monitoramento tecnico pode ficar indisponivel temporariamente.";
    }
  }
}

function escapeInlineText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
