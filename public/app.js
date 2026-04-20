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
const qualityNote = document.querySelector("#quality-note");
const medicineNameHint = document.querySelector("#medicine-name-hint");
const activeIngredientHint = document.querySelector("#active-ingredient-hint");
const manufacturerHint = document.querySelector("#manufacturer-hint");
const notesHint = document.querySelector("#notes-hint");
const resultActions = document.querySelector("#result-actions");
const copyResultButton = document.querySelector("#copy-result-button");
const shareResultButton = document.querySelector("#share-result-button");
const clearResultButton = document.querySelector("#clear-result-button");
const historyList = document.querySelector("#history-list");
const clearHistoryButton = document.querySelector("#clear-history-button");

const MAX_RAW_FILE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const OUTPUT_IMAGE_QUALITY = 0.82;
const MIN_RECOMMENDED_DIMENSION = 900;
const LOW_DIMENSION_THRESHOLD = 700;
const HISTORY_STORAGE_KEY = "clarabula-analysis-history";
const MAX_HISTORY_ITEMS = 8;

let imageDataUrl = "";
let barcodeHints = [];
let imageQualityReport = null;
let currentAnalysis = null;
let currentAnalysisText = "";

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
    const preparedImage = await optimizeImage(file);
    imageDataUrl = preparedImage.dataUrl;
    imageQualityReport = preparedImage.imageQuality;
    barcodeHints = await detectBarcodeHints(file);
    previewImage.src = imageDataUrl;
    previewWrap.classList.remove("hidden");
    renderQualityNote(imageQualityReport);
    statusBox.textContent =
      "Imagem otimizada com sucesso. Clique em analisar para gerar um resumo da bula.";
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";
    resultActions.classList.add("hidden");
  } catch (error) {
    imageDataUrl = "";
    previewWrap.classList.add("hidden");
    imageQualityReport = null;
    renderQualityNote(null);
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
      "Confirme o envio temporário da imagem para análise por IA antes de continuar.";
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
          barcodeValues: barcodeHints,
          medicineName: medicineNameHint.value.trim(),
          activeIngredient: activeIngredientHint.value.trim(),
          manufacturer: manufacturerHint.value.trim(),
          notes: notesHint.value.trim(),
          imageQuality: imageQualityReport
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível analisar a imagem.");
    }

    currentAnalysis = data.analysis;
    currentAnalysisText = analysisToPlainText(data.analysis);
    resultBox.innerHTML = renderAnalysis(data.analysis);
    resultBox.classList.remove("hidden");
    resultActions.classList.remove("hidden");
    saveAnalysisToHistory(data.analysis);
    statusBox.textContent =
      "Resumo gerado. Confira a bula oficial e procure um profissional se houver qualquer dúvida.";
  } catch (error) {
    statusBox.textContent = error.message;
  } finally {
    setLoadingState(false);
  }
});

copyResultButton.addEventListener("click", async () => {
  if (!currentAnalysisText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentAnalysisText);
    statusBox.textContent = "Resumo copiado para a área de transferência.";
  } catch {
    statusBox.textContent = "Não foi possível copiar agora. Tente novamente.";
  }
});

shareResultButton.addEventListener("click", async () => {
  if (!currentAnalysisText) {
    return;
  }

  if (!navigator.share) {
    statusBox.textContent =
      "O compartilhamento direto não está disponível neste navegador. Use o botão de copiar.";
    return;
  }

  try {
    await navigator.share({
      title: document.title,
      text: currentAnalysisText
    });
  } catch {
    // Cancelamento de compartilhamento nao precisa virar erro visivel.
  }
});

clearResultButton.addEventListener("click", () => {
  clearCurrentResult();
  statusBox.textContent = "Resultado limpo. Você pode analisar outra imagem.";
});

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory([]);
  statusBox.textContent = "Histórico local removido deste dispositivo.";
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-id]");

  if (!button) {
    return;
  }

  const historyItems = loadHistory();
  const selected = historyItems.find((item) => item.id === button.dataset.historyId);

  if (!selected) {
    return;
  }

  currentAnalysis = selected.analysis;
  currentAnalysisText = analysisToPlainText(selected.analysis);
  resultBox.innerHTML = renderAnalysis(selected.analysis);
  resultBox.classList.remove("hidden");
  resultActions.classList.remove("hidden");
  statusBox.textContent =
    "Análise recuperada do histórico local deste dispositivo.";
  window.scrollTo({
    top: resultBox.getBoundingClientRect().top + window.scrollY - 100,
    behavior: "smooth"
  });
});

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Analisando..." : "Analisar remédio";
  form.setAttribute("aria-busy", String(isLoading));
}

function validateSelectedFile(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error("A imagem original é grande demais. Use um arquivo de até 12 MB.");
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
    throw new Error("Não foi possível preparar a imagem para análise.");
  }

  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/jpeg", OUTPUT_IMAGE_QUALITY);

  if (blob.size > MAX_OUTPUT_IMAGE_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.68);
  }

  if (blob.size > MAX_OUTPUT_IMAGE_BYTES) {
    throw new Error(
      "A imagem ainda ficou pesada demais após a otimização. Tente cortar melhor a foto."
    );
  }

  return {
    dataUrl: await readFileAsDataUrl(blob),
    imageQuality: assessImageQuality(file, image)
  };
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
    return "<p>Não foi possível montar o resumo estruturado.</p>";
  }

  const medicine = analysis.identifiedMedicine || {};
  const summary = analysis.bulaResumo || {};

  return [
    createSection(
      "Remédio identificado",
      [
        createFact("Nome", medicine.name),
        createFact("Princípio ativo", medicine.activeIngredient),
        createFact("Dosagem", medicine.dosage),
        createFact("Forma farmacêutica", medicine.pharmaceuticalForm),
        createConfidencePill(medicine.confidence),
        createParagraph(medicine.confidenceReason)
      ].join("")
    ),
    createSection(
      "Evidências na imagem",
      createList(
        analysis.evidenceInImage,
        "Não foi possível ler evidências suficientes na embalagem."
      )
    ),
    createSection(
      "Bula resumida",
      [
        createParagraph(summary.confidenceNote),
        createSubsection("Para que costuma ser usado", summary.commonUses),
        createSubsection("Cuidados gerais de uso", summary.generalCare),
        createSubsection("Alertas e contraindicações", summary.warnings),
        createSubsection(
          "Possíveis efeitos colaterais comuns",
          summary.commonSideEffects
        ),
        createSubsection(
          "Interações e cuidados importantes",
          summary.interactions
        )
      ].join("")
    ),
    createSection(
      "Limites da análise",
      createList(
        analysis.analysisLimits,
        "Não houve detalhes adicionais sobre os limites da análise."
      )
    ),
    createSection(
      "Qualidade da imagem",
      createImageQualitySection(analysis.imageQuality)
    ),
    createSection(
      "Quando procurar um profissional",
      createList(
        analysis.seekProfessionalHelp,
        "Procure um médico ou farmacêutico em caso de dúvida sobre o uso."
      )
    ),
    createSection(
      "Próximos passos sugeridos",
      createList(
        analysis.suggestedNextSteps,
        "Confira a bula oficial antes de tomar qualquer decisão sobre o medicamento."
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

  return `<p><strong>Confiança:</strong> <span class="confidence-pill confidence-${escapeHtml(value)}">${escapeHtml(value)}</span></p>`;
}

function createImageQualitySection(imageQuality) {
  if (!imageQuality || typeof imageQuality !== "object") {
    return "<p>Não houve avaliação estruturada da qualidade da imagem.</p>";
  }

  return [
    `<p><strong>Legibilidade:</strong> <span class="confidence-pill confidence-${escapeHtml(
      imageQuality.legibility === "boa"
        ? "alta"
        : imageQuality.legibility === "regular"
          ? "media"
          : "baixa"
    )}">${escapeHtml(imageQuality.legibility || "baixa")}</span></p>`,
    createList(
      imageQuality.issues,
      "A IA não apontou problemas relevantes de leitura na imagem."
    )
  ].join("");
}

function createSubsection(title, items) {
  return `<p><strong>${escapeHtml(title)}</strong></p>${createList(items, "Não foi possível confirmar este ponto com segurança.")}`;
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
    return "<p>Não há links oficiais disponíveis para esta análise.</p>";
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
  renderHistory(loadHistory());
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
    const displayName = config?.displayName || "ClaraBula beta";

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
        `${Number(telemetry.analyzeRequests || 0)} análises recebidas nesta instância.`;
    }
  } catch {
    if (healthNote) {
      healthNote.textContent =
        "Ambiente beta ativo. O monitoramento técnico pode ficar indisponível temporariamente.";
    }
  }
}

function escapeInlineText(value) {
  return String(value || "").trim();
}

function assessImageQuality(file, image) {
  const issues = [];
  const smallestSide = Math.min(image.width, image.height);
  let legibility = "boa";

  if (smallestSide < LOW_DIMENSION_THRESHOLD) {
    legibility = "baixa";
    issues.push("Resolução baixa para leitura segura da embalagem.");
  } else if (smallestSide < MIN_RECOMMENDED_DIMENSION) {
    legibility = "regular";
    issues.push("A imagem pode ficar com texto pequeno para leitura da dosagem.");
  }

  if (file.size > 7 * 1024 * 1024) {
    issues.push("Arquivo original pesado, o que pode indicar uma foto pouco otimizada.");
  }

  if (image.width / image.height > 2 || image.height / image.width > 2) {
    issues.push("Enquadramento muito alongado, com chance de cortar informações relevantes.");
    legibility = legibility === "boa" ? "regular" : legibility;
  }

  return {
    legibility,
    issues,
    originalWidth: image.width,
    originalHeight: image.height
  };
}

function renderQualityNote(report) {
  if (!report) {
    qualityNote.classList.add("hidden");
    qualityNote.innerHTML = "";
    return;
  }

  const label =
    report.legibility === "boa"
      ? "boa"
      : report.legibility === "regular"
        ? "regular"
        : "baixa";
  const issues = report.issues.length
    ? `<ul>${report.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>A qualidade inicial parece adequada para a análise.</p>";

  qualityNote.innerHTML = `
    <strong>Qualidade estimada da foto: ${escapeHtml(label)}</strong>
    <p>${escapeHtml(`${report.originalWidth} x ${report.originalHeight} px`)}</p>
    ${issues}
  `;
  qualityNote.classList.remove("hidden");
}

function saveAnalysisToHistory(analysis) {
  const history = loadHistory();
  const medicine = analysis?.identifiedMedicine || {};
  const nextHistory = [
    {
      id: createClientId(),
      createdAt: new Date().toISOString(),
      medicineName: medicine.name || "Medicamento não identificado",
      confidence: medicine.confidence || "baixa",
      activeIngredient: medicine.activeIngredient || "",
      analysis
    },
    ...history
  ].slice(0, MAX_HISTORY_ITEMS);

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  renderHistory(nextHistory);
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderHistory(items) {
  if (!Array.isArray(items) || items.length === 0) {
    historyList.innerHTML =
      '<p class="history-empty">Nenhuma análise salva ainda.</p>';
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const dateLabel = new Date(item.createdAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      });

      return `
        <button class="history-item" type="button" data-history-id="${escapeHtml(item.id)}">
          <span class="history-item-top">
            <strong>${escapeHtml(item.medicineName || "Análise salva")}</strong>
            <span class="confidence-pill confidence-${escapeHtml(
              item.confidence || "baixa"
            )}">${escapeHtml(item.confidence || "baixa")}</span>
          </span>
          <span class="history-item-meta">${escapeHtml(item.activeIngredient || "Sem princípio ativo confirmado")}</span>
          <span class="history-item-meta">${escapeHtml(dateLabel)}</span>
        </button>
      `;
    })
    .join("");
}

function analysisToPlainText(analysis) {
  const sections = [];
  const medicine = analysis?.identifiedMedicine || {};
  const summary = analysis?.bulaResumo || {};

  sections.push("Remédio identificado");
  sections.push(`Nome: ${medicine.name || "Não identificado"}`);
  sections.push(`Princípio ativo: ${medicine.activeIngredient || "Não confirmado"}`);
  sections.push(`Dosagem: ${medicine.dosage || "Não confirmada"}`);
  sections.push(`Forma farmacêutica: ${medicine.pharmaceuticalForm || "Não confirmada"}`);
  sections.push(`Confiança: ${medicine.confidence || "baixa"}`);

  appendArraySection(sections, "Evidências na imagem", analysis?.evidenceInImage);
  appendArraySection(sections, "Para que costuma ser usado", summary.commonUses);
  appendArraySection(sections, "Cuidados gerais", summary.generalCare);
  appendArraySection(sections, "Alertas", summary.warnings);
  appendArraySection(sections, "Efeitos colaterais comuns", summary.commonSideEffects);
  appendArraySection(sections, "Interações", summary.interactions);
  appendArraySection(sections, "Limites da análise", analysis?.analysisLimits);
  appendArraySection(sections, "Qualidade da imagem", analysis?.imageQuality?.issues);
  appendArraySection(sections, "Quando procurar um profissional", analysis?.seekProfessionalHelp);
  appendArraySection(sections, "Próximos passos sugeridos", analysis?.suggestedNextSteps);
  appendArraySection(
    sections,
    "Fontes oficiais recomendadas",
    (analysis?.officialSources || []).map((item) =>
      `${item.label}: ${item.url}${item.recommendedSearchTerm ? ` | buscar por ${item.recommendedSearchTerm}` : ""}`
    )
  );

  if (analysis?.finalDisclaimer) {
    sections.push("Aviso importante");
    sections.push(analysis.finalDisclaimer);
  }

  return sections.join("\n");
}

function appendArraySection(target, title, values) {
  target.push(title);

  if (!Array.isArray(values) || values.length === 0) {
    target.push("- Não informado");
    return;
  }

  for (const value of values) {
    target.push(`- ${value}`);
  }
}

function clearCurrentResult() {
  currentAnalysis = null;
  currentAnalysisText = "";
  resultBox.classList.add("hidden");
  resultBox.innerHTML = "";
  resultActions.classList.add("hidden");
}

function createClientId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
