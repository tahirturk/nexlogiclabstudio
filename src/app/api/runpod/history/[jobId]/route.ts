import {
  getRequestOwner,
  readJob,
  removeJob,
  removeReference,
  validStoredId,
  withPrivateOwnerResponse,
} from "@/lib/runpod-storage";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const owner = await getRequestOwner();
  if (!owner) {
    return Response.json(
      { error: "Sign in to manage your history." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const { jobId } = await context.params;
    if (!validStoredId(jobId)) {
      return withPrivateOwnerResponse(
        Response.json({ error: "Invalid history item ID." }, { status: 400 }),
        owner,
      );
    }

    const job = await readJob(owner.id, jobId);
    if (!job) {
      return withPrivateOwnerResponse(
        Response.json({ error: "History item not found." }, { status: 404 }),
        owner,
      );
    }

    if (
      job.status !== "COMPLETED" &&
      job.status !== "FAILED" &&
      job.status !== "CANCELLED"
    ) {
      return withPrivateOwnerResponse(
        Response.json(
          { error: "Stop the active job before deleting its history entry." },
          { status: 409 },
        ),
        owner,
      );
    }

    await removeJob(owner.id, jobId);
    if (job.referenceId) await removeReference(job.referenceId);
    return withPrivateOwnerResponse(Response.json({ deleted: true }), owner);
  } catch {
    return withPrivateOwnerResponse(
      Response.json(
        { error: "Could not delete the generated file from app storage." },
        { status: 500 },
      ),
      owner,
    );
  }
}
