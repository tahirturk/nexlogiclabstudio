import { cleanupRunpodStorage } from "@/lib/runpod-storage";

export async function GET(request: Request) {
  const expected = process.env.RUNPOD_CLEANUP_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided || provided !== expected) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const removed = await cleanupRunpodStorage();
    return Response.json(
      { removed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Could not clean expired Runpod files." },
      { status: 500 },
    );
  }
}
