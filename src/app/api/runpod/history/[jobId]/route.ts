import {
  getRequestOwner,
  readJob,
  removeJob,
  removeReference,
  validStoredId,
  withOwnerCookie,
} from "@/lib/runpod-storage";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const owner = getRequestOwner(request);
  try {
    const { jobId } = await context.params;
    if (!validStoredId(jobId)) {
      return withOwnerCookie(
        Response.json({ error: "Invalid history item ID." }, { status: 400 }),
        owner,
      );
    }

    const job = await readJob(owner.id, jobId);
    if (!job) {
      return withOwnerCookie(
        Response.json({ error: "History item not found." }, { status: 404 }),
        owner,
      );
    }

    if (
      job.status !== "COMPLETED" &&
      job.status !== "FAILED" &&
      job.status !== "CANCELLED"
    ) {
      return withOwnerCookie(
        Response.json(
          { error: "Stop the active job before deleting its history entry." },
          { status: 409 },
        ),
        owner,
      );
    }

    await removeJob(owner.id, jobId);
    if (job.referenceId) await removeReference(job.referenceId);
    return withOwnerCookie(Response.json({ deleted: true }), owner);
  } catch {
    return withOwnerCookie(
      Response.json(
        { error: "Could not delete the generated file from app storage." },
        { status: 500 },
      ),
      owner,
    );
  }
}
