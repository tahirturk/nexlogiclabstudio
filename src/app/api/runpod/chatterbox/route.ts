import { CHATTERBOX_VOICES } from "@/lib/chatterbox";
import {
  getRequestOwner,
  jobExpiry,
  newId,
  removeReference,
  saveJob,
  saveReference,
  StoredJob,
  withOwnerCookie,
} from "@/lib/runpod-storage";
import {
  readRunpodResponse,
  runpodEndpointUrl,
  runpodErrorResponse,
} from "@/lib/runpod";

const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/flac",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
]);

export const maxDuration = 300;

function publicAppUrl() {
  const value = process.env.APP_BASE_URL?.trim();
  if (!value) {
    throw new Error(
      "Set APP_BASE_URL to the public HTTPS URL of this app before using reference-audio uploads.",
    );
  }
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_BASE_URL must be an HTTPS origin without a path.");
  }
  return url.origin;
}

export async function POST(request: Request) {
  const owner = getRequestOwner(request);
  let referenceId: string | undefined;

  try {
    const form = await request.formData();
    const prompt = form.get("prompt");
    const title = form.get("title");
    const voice = form.get("voice");
    const reference = form.get("reference");

    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 30_000
    ) {
      return withOwnerCookie(
        Response.json(
          { error: "Enter a script between 1 and 30,000 characters." },
          { status: 400 },
        ),
        owner,
      );
    }
    if (
      typeof voice !== "string" ||
      !CHATTERBOX_VOICES.includes(
        voice as (typeof CHATTERBOX_VOICES)[number],
      )
    ) {
      return withOwnerCookie(
        Response.json(
          { error: "Choose a supported Chatterbox preset voice." },
          { status: 400 },
        ),
        owner,
      );
    }
    if (
      title !== null &&
      (typeof title !== "string" || title.length > 100)
    ) {
      return withOwnerCookie(
        Response.json({ error: "Project name must be 100 characters or fewer." }, { status: 400 }),
        owner,
      );
    }
    if (reference !== null && !(reference instanceof File)) {
      return withOwnerCookie(
        Response.json({ error: "Reference audio must be an uploaded file." }, { status: 400 }),
        owner,
      );
    }
    if (reference instanceof File) {
      if (form.get("consent") !== "true") {
        return withOwnerCookie(
          Response.json(
            { error: "Confirm that you have permission to use this reference voice." },
            { status: 400 },
          ),
          owner,
        );
      }
      if (!reference.size || reference.size > MAX_REFERENCE_BYTES) {
        return withOwnerCookie(
          Response.json(
            { error: "Reference audio must be smaller than 20 MB." },
            { status: 400 },
          ),
          owner,
        );
      }
      if (!ALLOWED_AUDIO_TYPES.has(reference.type.toLowerCase())) {
        return withOwnerCookie(
          Response.json(
            { error: "Upload a WAV, MP3, M4A, FLAC, or OGG voice sample." },
            { status: 400 },
          ),
          owner,
        );
      }
    }

    const id = newId();
    const createdAt = Date.now();
    let voiceUrl: string | undefined;
    if (reference instanceof File) {
      const base = publicAppUrl();
      const saved = await saveReference(
        owner.id,
        new Uint8Array(await reference.arrayBuffer()),
        reference.type,
      );
      referenceId = saved.id;
      voiceUrl = `${base}/api/runpod/reference/${saved.id}?token=${saved.token}`;
    }

    const { url, headers } = runpodEndpointUrl("/run");
    const runpodResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          prompt: prompt.trim(),
          voice,
          ...(voiceUrl ? { voice_url: voiceUrl } : {}),
          format: "wav",
        },
      }),
      cache: "no-store",
    });
    const data = await readRunpodResponse(runpodResponse);
    if (!runpodResponse.ok) {
      throw new Error(`Runpod rejected the request (HTTP ${runpodResponse.status}).`);
    }
    if (typeof data?.id !== "string") {
      throw new Error("Runpod did not return a job ID.");
    }

    const job: StoredJob = {
      id,
      ownerId: owner.id,
      runpodJobId: data.id,
      title:
        typeof title === "string" && title.trim()
          ? title.trim()
          : "Untitled voiceover",
      voice,
      createdAt,
      expiresAt: jobExpiry(createdAt),
      status:
        typeof data.status === "string" &&
        ["IN_QUEUE", "RUNNING"].includes(data.status.toUpperCase())
          ? data.status.toUpperCase()
          : "IN_QUEUE",
      ...(referenceId ? { referenceId } : {}),
    };
    await saveJob(job);

    return withOwnerCookie(
      Response.json(
        { id, status: job.status },
        { headers: { "Cache-Control": "no-store" } },
      ),
      owner,
    );
  } catch (error) {
    if (referenceId) await removeReference(referenceId);
    return withOwnerCookie(runpodErrorResponse(error), owner);
  }
}
