import {
  getRequestOwner,
  listOwnerJobs,
  withPrivateOwnerResponse,
} from "@/lib/runpod-storage";

export async function GET() {
  const owner = await getRequestOwner();
  if (!owner) {
    return Response.json(
      { error: "Sign in to access your history." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const jobs = await listOwnerJobs(owner.id);
    return withPrivateOwnerResponse(
      Response.json(
        {
          items: jobs.map((job) => ({
            id: job.id,
            type: "voice",
            title: job.title,
            date: job.createdAt,
            voice: job.voice,
            expiresAt: job.expiresAt,
            serverRunpod: true,
          })),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      ),
      owner,
    );
  } catch {
    return withPrivateOwnerResponse(
      Response.json(
        { error: "Could not read Runpod generation history from app storage." },
        { status: 500 },
      ),
      owner,
    );
  }
}
