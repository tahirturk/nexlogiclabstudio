import { getRequestOwner } from "@/lib/runpod-storage";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export async function GET() {
  const owner = await getRequestOwner();
  if (!owner) {
    return Response.json({ error: "Sign in to view your quota." }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return Response.json(
      { error: "Account quota storage is not configured on the server." },
      { status: 503 },
    );
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("user_tts_quotas")
    .select("package_id, quota_limit, characters_used, characters_reserved")
    .eq("user_id", owner.id)
    .maybeSingle();
  if (error) {
    return Response.json(
      { error: "Could not load your quota. Apply the Supabase quota migration first." },
      { status: 503 },
    );
  }
  return Response.json(
    {
      packageId: data?.package_id ?? null,
      limit: data?.quota_limit ?? 0,
      used: data?.characters_used ?? 0,
      reserved: data?.characters_reserved ?? 0,
      remaining: Math.max(
        0,
        (data?.quota_limit ?? 0) -
          (data?.characters_used ?? 0) -
          (data?.characters_reserved ?? 0),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
