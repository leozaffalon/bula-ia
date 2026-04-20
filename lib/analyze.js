export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 20000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const DEFAULT_DISCLAIMER =
  "Este resumo e informativo e nao substitui consulta com medico ou outro profissional de saude.";

export const systemPrompt = `
Voce e um assistente especializado em resumir bulas de remedios em portugues do Brasil com foco em seguranca.
Sua tarefa e analisar a imagem da embalagem, identificar o medicamento com cautela e entregar uma bula resumida, clara e util.

Processo obrigatorio:
1. Leia cuidadosamente o texto visivel da imagem.
2. Identifique, se possivel, nome comercial, principio ativo, dosagem, concentracao e forma farmaceutica.
3. Avalie a confianca da identificacao como alta, media ou baixa.
4. So resuma a bula de forma mais completa se a identificacao do medicamento estiver com confianca alta.
5. Se a confianca for media ou baixa, seja conservador: diga que a identificacao nao e segura o bastante e evite afirmar indicacoes, contraindicacoes ou posologia especifica como se fossem certas.

Regras obrigatorias:
- Responda apenas em portugues do Brasil.
- Nunca invente informacoes.
- Use apenas o que esta visivel na imagem e conhecimento geral confiavel sobre o medicamento quando a identificacao estiver alta.
- Se a imagem estiver ruim, cortada, desfocada ou com reflexo, diga isso explicitamente.
- Nao forneca diagnostico.
- Nao prescreva tratamento.
- Nao substitua orientacao medica.
- Nao informe dose exata, quantidade, frequencia ou tempo de tratamento como recomendacao personalizada.
- Quando houver incerteza, priorize seguranca e transparencia.
- Sempre deixe claro quando uma informacao e confirmada pela embalagem e quando e um resumo geral da bula.

Responda somente em JSON valido seguindo exatamente o schema fornecido.
Preencha arrays com itens curtos e objetivos.
Se um dado nao puder ser confirmado, use string vazia ou lista vazia, sem inventar.
Use "alta" apenas quando a identificacao estiver muito clara na embalagem.
O campo finalDisclaimer deve conter exatamente esta frase:
${DEFAULT_DISCLAIMER}
`.trim();

const ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    identifiedMedicine: {
      type: "object",
      properties: {
        name: { type: "string" },
        activeIngredient: { type: "string" },
        dosage: { type: "string" },
        pharmaceuticalForm: { type: "string" },
        confidence: {
          type: "string",
          enum: ["alta", "media", "baixa"]
        },
        confidenceReason: { type: "string" }
      },
      required: [
        "name",
        "activeIngredient",
        "dosage",
        "pharmaceuticalForm",
        "confidence",
        "confidenceReason"
      ]
    },
    evidenceInImage: {
      type: "array",
      items: { type: "string" }
    },
    bulaResumo: {
      type: "object",
      properties: {
        confidenceNote: { type: "string" },
        commonUses: {
          type: "array",
          items: { type: "string" }
        },
        generalCare: {
          type: "array",
          items: { type: "string" }
        },
        warnings: {
          type: "array",
          items: { type: "string" }
        },
        commonSideEffects: {
          type: "array",
          items: { type: "string" }
        },
        interactions: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: [
        "confidenceNote",
        "commonUses",
        "generalCare",
        "warnings",
        "commonSideEffects",
        "interactions"
      ]
    },
    analysisLimits: {
      type: "array",
      items: { type: "string" }
    },
    imageQuality: {
      type: "object",
      properties: {
        legibility: {
          type: "string",
          enum: ["boa", "regular", "baixa"]
        },
        issues: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["legibility", "issues"]
    },
    seekProfessionalHelp: {
      type: "array",
      items: { type: "string" }
    },
    suggestedNextSteps: {
      type: "array",
      items: { type: "string" }
    },
    finalDisclaimer: { type: "string" }
  },
  required: [
    "identifiedMedicine",
    "evidenceInImage",
    "bulaResumo",
    "analysisLimits",
    "imageQuality",
    "seekProfessionalHelp",
    "suggestedNextSteps",
    "finalDisclaimer"
  ]
};

export async function analyzeMedicineImage({
  image,
  apiKey,
  hints,
  fetchImpl = fetch
}) {
  if (!apiKey) {
    throw new ApiError(500, "Defina GEMINI_API_KEY para ativar a analise por IA.");
  }

  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new ApiError(400, "Envie uma imagem valida em base64.");
  }

  const { mimeType, base64Data } = parseDataUrl(image);
  const byteSize = estimateBase64Bytes(base64Data);

  if (byteSize > MAX_IMAGE_BYTES) {
    throw new ApiError(
      413,
      "A imagem processada ficou grande demais. Tente uma foto mais leve ou com menor resolucao."
    );
  }

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: systemPrompt
        }
      ]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildUserPrompt(hints)
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: ANALYSIS_RESPONSE_SCHEMA
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Erro Gemini:", data);
      throw new ApiError(
        response.status,
        data?.error?.message || "Falha ao consultar a IA do Gemini."
      );
    }

    return {
      analysis: parseStructuredAnalysis(data)
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(
        504,
        "A analise demorou demais para responder. Tente novamente com uma imagem menor."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUserPrompt(hints) {
  const promptLines = [
    "Analise esta imagem de remedio, identifique o medicamento com cautela e responda apenas com JSON estruturado conforme o schema.",
    "Priorize seguranca, indique o nivel de confianca e nao invente dados.",
    "Se a imagem nao permitir confirmacao segura, diga isso explicitamente e mantenha o resumo conservador.",
    "Avalie tambem a qualidade da imagem com legibilidade boa, regular ou baixa e liste problemas visuais relevantes.",
    "No campo suggestedNextSteps, indique proximos passos praticos e curtos, como conferir a bula oficial, refazer a foto ou consultar um profissional."
  ];

  const barcodeValues = getTextArray(hints?.barcodeValues);
  const typedHints = [
    ["nome informado pelo usuario", getText(hints?.medicineName)],
    ["principio ativo informado pelo usuario", getText(hints?.activeIngredient)],
    ["empresa ou laboratorio informado pelo usuario", getText(hints?.manufacturer)],
    ["observacao adicional do usuario", getText(hints?.notes)]
  ].filter(([, value]) => value);

  if (typedHints.length > 0) {
    promptLines.push(
      `Pistas opcionais fornecidas pelo usuario: ${typedHints
        .map(([label, value]) => `${label}: ${value}`)
        .join("; ")}. Use essas pistas apenas como apoio, nunca como prova definitiva se a embalagem nao confirmar.`
    );
  }

  if (barcodeValues.length > 0) {
    promptLines.push(
      `Dica adicional extraida no dispositivo: possiveis codigos de barras lidos = ${barcodeValues.join(", ")}. Use isso apenas como pista secundaria, nunca como prova isolada.`
    );
  }

  const imageQuality = hints?.imageQuality;

  if (imageQuality && typeof imageQuality === "object") {
    const legibility = getText(imageQuality.legibility);
    const issues = getTextArray(imageQuality.issues);

    if (legibility || issues.length > 0) {
      promptLines.push(
        `Estimativa local da qualidade da foto: legibilidade ${legibility || "nao informada"}; possiveis problemas = ${issues.join(", ") || "nenhum problema relevante detectado"}.`
      );
    }
  }

  return promptLines.join(" ");
}

function parseDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);

  if (!match) {
    throw new ApiError(400, "Formato de imagem invalido.");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(match[1])) {
    throw new ApiError(
      400,
      "Formato de imagem nao suportado. Use JPG, PNG ou WEBP."
    );
  }

  return {
    mimeType: match[1],
    base64Data: match[2]
  };
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
}

function parseStructuredAnalysis(payload) {
  const rawText = extractGeminiText(payload);

  if (!rawText) {
    throw new ApiError(
      502,
      "A IA nao retornou um resumo estruturado. Tente novamente."
    );
  }

  try {
    return normalizeAnalysis(JSON.parse(rawText));
  } catch (error) {
    console.error("Falha ao interpretar JSON do Gemini:", rawText, error);
    throw new ApiError(
      502,
      "A resposta da IA veio em formato inesperado. Tente novamente."
    );
  }
}

function normalizeAnalysis(payload) {
  const identifiedMedicine = payload?.identifiedMedicine || {};
  const bulaResumo = payload?.bulaResumo || {};

  return {
    identifiedMedicine: {
      name:
        getText(identifiedMedicine.name) ||
        "Nao foi possivel identificar com seguranca.",
      activeIngredient: getText(identifiedMedicine.activeIngredient),
      dosage: getText(identifiedMedicine.dosage),
      pharmaceuticalForm: getText(identifiedMedicine.pharmaceuticalForm),
      confidence: getConfidence(identifiedMedicine.confidence),
      confidenceReason: getText(identifiedMedicine.confidenceReason)
    },
    evidenceInImage: getTextArray(payload?.evidenceInImage),
    bulaResumo: {
      confidenceNote: getText(bulaResumo.confidenceNote),
      commonUses: getTextArray(bulaResumo.commonUses),
      generalCare: getTextArray(bulaResumo.generalCare),
      warnings: getTextArray(bulaResumo.warnings),
      commonSideEffects: getTextArray(bulaResumo.commonSideEffects),
      interactions: getTextArray(bulaResumo.interactions)
    },
    analysisLimits: getTextArray(payload?.analysisLimits),
    imageQuality: {
      legibility: getLegibility(payload?.imageQuality?.legibility),
      issues: getTextArray(payload?.imageQuality?.issues)
    },
    seekProfessionalHelp: getTextArray(payload?.seekProfessionalHelp),
    suggestedNextSteps: getTextArray(payload?.suggestedNextSteps),
    finalDisclaimer: DEFAULT_DISCLAIMER
  };
}

function getText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getTextArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getText(item))
    .filter(Boolean);
}

function getConfidence(value) {
  return value === "alta" || value === "media" || value === "baixa"
    ? value
    : "baixa";
}

function getLegibility(value) {
  return value === "boa" || value === "regular" || value === "baixa"
    ? value
    : "baixa";
}

function estimateBase64Bytes(base64Value) {
  const padding = base64Value.endsWith("==")
    ? 2
    : base64Value.endsWith("=")
      ? 1
      : 0;

  return Math.floor((base64Value.length * 3) / 4) - padding;
}
