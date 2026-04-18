import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMedicineImage, ApiError } from "./analyze.js";

test("retorna analise estruturada quando a IA responde JSON valido", async () => {
  const fakePayload = {
    identifiedMedicine: {
      name: "Dipirona",
      activeIngredient: "dipirona monoidratada",
      dosage: "500 mg",
      pharmaceuticalForm: "comprimido",
      confidence: "alta",
      confidenceReason: "Nome e dosagem estavam legiveis."
    },
    evidenceInImage: ["Nome Dipirona", "500 mg", "Comprimidos"],
    bulaResumo: {
      confidenceNote: "Resumo gerado com base em identificacao alta.",
      commonUses: ["Dor e febre"],
      generalCare: ["Usar conforme orientacao profissional."],
      warnings: ["Evitar em caso de alergia conhecida."],
      commonSideEffects: ["Pode causar enjoo em algumas pessoas."],
      interactions: ["Informar uso de outros remedios ao medico."]
    },
    analysisLimits: ["Nao foi possivel confirmar o fabricante."],
    seekProfessionalHelp: ["Procure atendimento em caso de reacao alergica."],
    finalDisclaimer:
      "Este resumo e informativo e nao substitui consulta com medico ou outro profissional de saude."
  };

  const result = await analyzeMedicineImage({
    image: "data:image/jpeg;base64,AAAA",
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(fakePayload)
                }
              ]
            }
          }
        ]
      })
    })
  });

  assert.equal(result.analysis.identifiedMedicine.name, "Dipirona");
  assert.equal(result.analysis.identifiedMedicine.confidence, "alta");
  assert.deepEqual(result.analysis.bulaResumo.commonUses, ["Dor e febre"]);
});

test("falha sem chave de API", async () => {
  await assert.rejects(
    analyzeMedicineImage({
      image: "data:image/jpeg;base64,AAAA",
      apiKey: ""
    }),
    (error) => error instanceof ApiError && error.status === 500
  );
});

test("falha com mime type nao suportado", async () => {
  await assert.rejects(
    analyzeMedicineImage({
      image: "data:image/gif;base64,AAAA",
      apiKey: "test-key",
      fetchImpl: async () => {
        throw new Error("nao deveria chamar a IA");
      }
    }),
    (error) => error instanceof ApiError && error.status === 400
  );
});
