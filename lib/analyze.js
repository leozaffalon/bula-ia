export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const systemPrompt = `
Voce e um assistente que resume bulas de remedios em portugues do Brasil.
Analise a imagem enviada pelo usuario e identifique, se possivel, o nome do remedio, principio ativo, concentracao e forma farmaceutica.

Regras obrigatorias:
- Responda apenas em portugues do Brasil.
- Nao invente informacoes que nao estejam claras na embalagem ou que nao possam ser inferidas com seguranca.
- Se a imagem estiver ruim, diga claramente que nao foi possivel identificar o remedio com confianca.
- Nao forneca diagnostico.
- Nao substitua orientacao medica.
- Oriente o usuario a consultar medico ou farmaceutico em caso de duvida, alergia, gravidez, amamentacao, uso infantil, efeitos adversos ou interacoes.
- Se houver baixa confianca, destaque isso.

Monte a resposta em Markdown com estes titulos:
## Remedio identificado
## Para que costuma ser usado
## Como a bula costuma orientar o uso
## Alertas importantes
## Quando procurar um profissional

No fim, inclua exatamente esta frase:
Este resumo e informativo e nao substitui consulta com medico ou outro profissional de saude.
`.trim();

export async function analyzeMedicineImage({
  image,
  apiKey,
  fetchImpl = fetch
}) {
  if (!apiKey) {
    throw new ApiError(500, "Defina OPENAI_API_KEY para ativar a analise por IA.");
  }

  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new ApiError(400, "Envie uma imagem valida em base64.");
  }

  const payload = {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Leia a embalagem do remedio na imagem e gere um resumo objetivo da bula com foco em orientacao geral e seguranca."
          },
          {
            type: "input_image",
            image_url: image
          }
        ]
      }
    ]
  };

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Erro OpenAI:", data);
    throw new ApiError(
      response.status,
      data?.error?.message || "Falha ao consultar a OpenAI."
    );
  }

  return {
    summary: data?.output_text?.trim() || "Nao foi possivel gerar o resumo."
  };
}
