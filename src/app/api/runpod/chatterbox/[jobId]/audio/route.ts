import {
  getRequestOwner,
  readJob,
  readJobAudio,
  withOwnerCookie,
} from "@/lib/runpod-storage";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const owner = getRequestOwner(request);
  const { jobId } = await context.params;
  const job = await readJob(owner.id, jobId);
  if (!job) {
    return withOwnerCookie(
      Response.json({ error: "Generated file not found." }, { status: 404 }),
      owner,
    );
  }
  if (job.expiresAt <= Date.now()) {
    return withOwnerCookie(
      Response.json({ error: "This generated file has expired." }, { status: 410 }),
      owner,
    );
  }

  const bytes = await readJobAudio(owner.id, jobId);
  if (!bytes) {
    return withOwnerCookie(
      Response.json(
        { error: "Generated audio is not ready yet." },
        { status: 409 },
      ),
      owner,
    );
  }

  return withOwnerCookie(
    new Response(bytes, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${job.id}.wav"`,
      },
    }),
    owner,
  );
}
