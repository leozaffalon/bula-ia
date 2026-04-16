export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const systemPrompt = `
Voce e um assistente especializado em resumir bulas de remedios em portugues do Brasil com foco em seguranca.
Sua tarefa e analisar a imagem da embalagem, identificar o medicamento com cautela e entregar uma bula resumida, clara e util.

Processo obrigatorio:
1. Leia cuidadosamente o texto visivel da imagem.
2. Identifique, se possivel, nome comercial, principio ativo, dosagem, concentracao e forma farmaceutica.
3. Avalie a confianca da identificacao como alta, media ou baixa.
4. So resuma a bula de forma mais completa se a identificacao do medicamento estiver com confianca alta.
5. Se a confianca for media ou baixa, seja conservador: diga que a identificacao nao e segura o bastante e evite afirmar indicacoes, contraindicações ou posologia especifica como se fossem certas.

Regras obrigatorias:
- Responda apenas em portugues do Brasil.
- Nunca invente informacoes.
- Use apenas o que esta visivel na imagem e conhecimento geral confiavel sobre o medicamento quando a identificacao estiver alta.
- Se a imagem estiver ruim, cortada, desfocada ou com reflexo, diga isso explicitamente.
- Nao forneca diagnostico.
- Nao prescreva tratamento.
- Nao substitua orientacao medica.
- Nao informe dose exata, quantidade, frequencia ou tempo de tratamento como recomendacao personalizada.
- Quando houver incerteza, priorize seguranca e transparência.
- Sempre deixe claro quando uma informacao e confirmada pela embalagem e quando e um resumo geral da bula.

Quero uma resposta em Markdown, objetiva e sem introducoes longas, com estes titulos exatos:
## Remedio identificado
Inclua: nome, principio ativo, dosagem, forma farmaceutica e nivel de confianca.

## Evidencias na imagem
Liste de forma curta o que foi possivel ler na embalagem.

## Bula resumida
Inclua, em bullets curtos:
- para que costuma ser usado
- cuidados gerais de uso
- contraindicacoes ou situacoes de atencao mais comuns
- possiveis efeitos colaterais comuns
- interacoes ou cuidados importantes quando forem bem conhecidas

## Limites da analise
Explique o que nao foi possivel confirmar com seguranca.

## Quando procurar um profissional
Oriente procurar medico ou farmaceutico em caso de gravidez, amamentacao, uso infantil, idosos, alergia, efeitos adversos, interacoes, duvidas sobre dose ou uso com outros remedios.

Se a confianca nao for alta, em "Bula resumida" deixe claro que o resumo completo nao pode ser garantido com seguranca a partir da imagem enviada.

No fim, inclua exatamente esta frase:
Este resumo e informativo e nao substitui consulta com medico ou outro profissional de saude.
`.trim();

export async function analyzeMedicineImage({
  image,
  apiKey,
  fetchImpl = fetch
}) {
  if (!apiKey) {
    throw new ApiError(500, "Defina GEMINI_API_KEY para ativar a analise por IA.");
  }

  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new ApiError(400, "Envie uma imagem valida em base64.");
  }

  const { mimeType, base64Data } = parseDataUrl(image);

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
            text: "Analise esta imagem de remedio, identifique o medicamento com cautela e gere uma bula resumida seguindo exatamente a estrutura pedida. Priorize seguranca, indique o nivel de confianca e nao invente dados que nao estejam claros."
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
      temperature: 0.2
    }
  };

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  const response = await fetchImpl(`${url}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Erro Gemini:", data);
    throw new ApiError(
      response.status,
      data?.error?.message || "Falha ao consultar a IA do Gemini."
    );
  }

  const summary = extractGeminiText(data);

  return {
    summary: summary || "Nao foi possivel gerar o resumo."
  };
}

function parseDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);

  if (!match) {
    throw new ApiError(400, "Formato de imagem invalido.");
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
