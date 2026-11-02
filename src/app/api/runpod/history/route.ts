import {
  getRequestOwner,
  listOwnerJobs,
  withOwnerCookie,
} from "@/lib/runpod-storage";

export async function GET(request: Request) {
  const owner = getRequestOwner(request);
  try {
    const jobs = await listOwnerJobs(owner.id);
    return withOwnerCookie(
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
    return withOwnerCookie(
      Response.json(
        { error: "Could not read Runpod generation history from app storage." },
        { status: 500 },
      ),
      owner,
    );
  }
}
