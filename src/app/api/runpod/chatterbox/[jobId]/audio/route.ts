import {
  getRequestOwner,
  readJob,
  readJobAudio,
  withPrivateOwnerResponse,
} from "@/lib/runpod-storage";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const owner = await getRequestOwner();
  if (!owner) {
    return Response.json(
      { error: "Sign in to access this audio file." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const { jobId } = await context.params;
  const job = await readJob(owner.id, jobId);
  if (!job) {
    return withPrivateOwnerResponse(
      Response.json({ error: "Generated file not found." }, { status: 404 }),
      owner,
    );
  }
  if (job.expiresAt <= Date.now()) {
    return withPrivateOwnerResponse(
      Response.json({ error: "This generated file has expired." }, { status: 410 }),
      owner,
    );
  }

  const bytes = await readJobAudio(owner.id, jobId);
  if (!bytes) {
    return withPrivateOwnerResponse(
      Response.json(
        { error: "Generated audio is not ready yet." },
        { status: 409 },
      ),
      owner,
    );
  }

  return withPrivateOwnerResponse(
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
