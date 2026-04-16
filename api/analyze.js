import { ApiError, analyzeMedicineImage } from "../lib/analyze.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await analyzeMedicineImage({
      image: body?.image,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    });

    return Response.json(result);
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
