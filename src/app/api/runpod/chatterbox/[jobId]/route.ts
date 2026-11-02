import {
  getRequestOwner,
  outputExpiry,
  readJob,
  removeJob,
  removeReference,
  saveJob,
  validStoredId,
  withPrivateOwnerResponse,
  writeJobAudio,
  readLimitedBody,
} from "@/lib/runpod-storage";
import {
  readRunpodResponse,
  runpodRateLimitResponse,
  runpodEndpointUrl,
  runpodErrorResponse,
} from "@/lib/runpod";
import { settleTtsQuota } from "@/lib/tts-quota";

type RouteContext = { params: Promise<{ jobId: string }> };
const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;

function isAudioUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "audio.runpod.ai";
  } catch {
    return false;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const owner = await getRequestOwner();
  if (!owner) {
    return Response.json(
      { error: "Sign in to access this voiceover." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const { jobId } = await context.params;
    if (!validStoredId(jobId)) {
      return withPrivateOwnerResponse(
        Response.json({ error: "Invalid job ID." }, { status: 400 }),
        owner,
      );
    }

    const job = await readJob(owner.id, jobId);
    if (!job) {
      return withPrivateOwnerResponse(
        Response.json({ error: "Job not found." }, { status: 404 }),
        owner,
      );
    }
    if (job.expiresAt <= Date.now()) {
      await settleTtsQuota(job.id, job.status === "COMPLETED");
      await removeJob(owner.id, job.id);
      if (job.referenceId) await removeReference(job.referenceId);
      return withPrivateOwnerResponse(
        Response.json({ error: "This result has expired." }, { status: 410 }),
        owner,
      );
    }

    if (job.status !== "COMPLETED" && job.status !== "FAILED" && job.status !== "CANCELLED") {
      const { url, headers } = runpodEndpointUrl(
        `/status/${encodeURIComponent(job.runpodJobId)}`,
      );
      const response = await fetch(url, { headers, cache: "no-store" });
      const data = await readRunpodResponse(response);
      if (!response.ok) {
        if (response.status === 429) {
          return withPrivateOwnerResponse(runpodRateLimitResponse(response), owner);
        }
        return withPrivateOwnerResponse(
          Response.json(
            { error: `Could not check the Runpod job (HTTP ${response.status}).` },
            { status: 502 },
          ),
          owner,
        );
      }
      if (typeof data?.status !== "string") {
        return withPrivateOwnerResponse(
          Response.json(
            { error: "Runpod returned an invalid job status." },
            { status: 502 },
          ),
          owner,
        );
      }

      const status = data.status.toUpperCase();
      if (status === "COMPLETED") {
        const output =
          data.output && typeof data.output === "object"
            ? (data.output as Record<string, unknown>)
            : null;
        if (!isAudioUrl(output?.audio_url)) {
          throw new Error("Runpod returned an invalid audio download URL.");
        }
        const audioResponse = await fetch(output.audio_url, {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(60_000),
        });
        if (!audioResponse.ok) {
          throw new Error(
            `Could not download generated audio (HTTP ${audioResponse.status}).`,
          );
        }
        const bytes = await readLimitedBody(audioResponse, MAX_OUTPUT_BYTES);
        await writeJobAudio(owner.id, job.id, bytes);
        const completedAt = Date.now();
        job.status = "COMPLETED";
        job.completedAt = completedAt;
        job.expiresAt = outputExpiry(completedAt);
        await saveJob(job);
        if (job.referenceId) {
          await removeReference(job.referenceId);
          delete job.referenceId;
          await saveJob(job);
        }
      } else if (status === "FAILED" || status === "CANCELLED") {
        job.status = status;
        job.error =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : "Runpod could not complete this job.";
        job.expiresAt = outputExpiry(Date.now());
        await saveJob(job);
        if (job.referenceId) await removeReference(job.referenceId);
      } else {
        job.status = status;
        await saveJob(job);
      }
    }

    if (job.status === "COMPLETED") await settleTtsQuota(job.id, true);
    else if (job.status === "FAILED" || job.status === "CANCELLED") {
      await settleTtsQuota(job.id, false);
    }

    return withPrivateOwnerResponse(
      Response.json(
        { status: job.status, error: job.error },
        { headers: { "Cache-Control": "no-store" } },
      ),
      owner,
    );
  } catch (error) {
    return withPrivateOwnerResponse(runpodErrorResponse(error), owner);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const owner = await getRequestOwner();
  if (!owner) {
    return Response.json(
      { error: "Sign in to manage this voiceover." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const { jobId } = await context.params;
    if (!validStoredId(jobId)) {
      return withPrivateOwnerResponse(
        Response.json({ error: "Invalid job ID." }, { status: 400 }),
        owner,
      );
    }
    const job = await readJob(owner.id, jobId);
    if (!job) {
      return withPrivateOwnerResponse(
        Response.json({ error: "Job not found." }, { status: 404 }),
        owner,
      );
    }

    if (job.status !== "COMPLETED" && job.status !== "FAILED" && job.status !== "CANCELLED") {
      const { url, headers } = runpodEndpointUrl(
        `/cancel/${encodeURIComponent(job.runpodJobId)}`,
      );
      const response = await fetch(url, {
        method: "POST",
        headers,
        cache: "no-store",
      });
      if (!response.ok) {
        return withPrivateOwnerResponse(
          Response.json(
            { error: `Runpod could not cancel the job (HTTP ${response.status}).` },
            { status: 502 },
          ),
          owner,
        );
      }
    }

    if (job.status !== "COMPLETED") await settleTtsQuota(job.id, false);
    await removeJob(owner.id, jobId);
    if (job.referenceId) await removeReference(job.referenceId);
    return withPrivateOwnerResponse(Response.json({ cancelled: true }), owner);
  } catch (error) {
    return withPrivateOwnerResponse(runpodErrorResponse(error), owner);
  }
}
