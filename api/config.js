import { getRuntimeConfig } from "../lib/runtime-config.js";

export async function GET() {
  return Response.json(getRuntimeConfig());
}
