const ENDPOINT_URL = "https://api.runpod.ai/v2/chatterbox-turbo";

export function isRunpodConfigured() {
  return Boolean(process.env.RUNPOD_API_KEY?.trim());
}

export function runpodEndpointUrl(path: string) {
  const apiKey = process.env.RUNPOD_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Runpod is not configured. Set RUNPOD_API_KEY in the app server environment and restart the app.",
    );
  }

  return {
    url: `${ENDPOINT_URL}${path}`,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  };
}

export function validRunpodJobId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export async function readRunpodResponse(response: Response) {
  return (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
}

export function runpodRateLimitResponse(response: Response) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) headers.set("Retry-After", retryAfter);

  return Response.json(
    { error: "Runpod is rate limiting requests. Please retry shortly." },
    { status: 429, headers },
  );
}

export function runpodErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "The Runpod request failed.";
  const status = message.startsWith("Runpod is not configured.") ? 503 : 502;
  return Response.json({ error: message }, { status });
}
