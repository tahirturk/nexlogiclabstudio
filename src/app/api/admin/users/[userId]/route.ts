import { getAdminContext } from "@/lib/admin-auth";
import { isTtsPackageId, TTS_PACKAGES } from "@/lib/quotas";
import { validStoredId } from "@/lib/runpod-storage";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const result = await getAdminContext();
  if (result.response) return result.response;

  const { userId } = await context.params;
  if (!validStoredId(userId)) {
    return Response.json({ error: "Invalid user ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const values = body as Record<string, unknown>;
  if (!isTtsPackageId(values.packageId)) {
    return Response.json({ error: "Choose Starter or Pro." }, { status: 400 });
  }
  const packageId = values.packageId;
  const quotaLimit =
    values.quotaLimit === undefined
      ? TTS_PACKAGES[packageId].characters
      : values.quotaLimit;
  if (
    typeof quotaLimit !== "number" ||
    !Number.isSafeInteger(quotaLimit) ||
    quotaLimit < 0 ||
    quotaLimit > 100_000_000
  ) {
    return Response.json(
      { error: "Quota must be a whole number between 0 and 100,000,000 characters." },
      { status: 400 },
    );
  }

  const client = result.context.adminClient;
  const existing = await client
    .from("user_tts_quotas")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) {
    return Response.json(
      { error: "Could not load the current quota. Apply the Supabase quota migration first." },
      { status: 503 },
    );
  }

  const save = existing.data
    ? await client
        .from("user_tts_quotas")
        .update({
          package_id: packageId,
          quota_limit: quotaLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
    : await client.from("user_tts_quotas").insert({
        user_id: userId,
        package_id: packageId,
        quota_limit: quotaLimit,
      });

  if (save.error) {
    return Response.json(
      { error: "Could not save this user's package and quota." },
      { status: 502 },
    );
  }

  return Response.json(
    { saved: true, packageId, quotaLimit },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
