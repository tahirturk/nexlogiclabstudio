import { connection } from "next/server";
import { isRunpodConfigured } from "@/lib/runpod";

export async function GET() {
  await connection();

  return Response.json(
    { configured: isRunpodConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
