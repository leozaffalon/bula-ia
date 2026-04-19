import { getHealthPayload } from "../lib/analysis-service.js";

export async function GET() {
  return Response.json(getHealthPayload());
}
