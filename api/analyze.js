import { ApiError } from "../lib/analyze.js";
import { performAnalysisRequest } from "../lib/analysis-service.js";
import { getClientId } from "../lib/request-guard.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await performAnalysisRequest({
      image: body?.image,
      hints: body?.hints,
      clientId: getClientId(request.headers),
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    });

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error(error);

    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json(
      {
        error: "Ocorreu um erro interno ao processar a solicitacao."
      },
      { status: 500 }
    );
  }
}
