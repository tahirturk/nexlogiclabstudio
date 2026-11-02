import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReservationResult =
  | { allowed: true }
  | {
      allowed: false;
      code: "PACKAGE_REQUIRED";
    }
  | {
      allowed: false;
      code: "QUOTA_EXCEEDED";
      limit: number;
      used: number;
      reserved: number;
    };

function isReservationResult(value: unknown): value is ReservationResult {
  if (!value || typeof value !== "object" || !("allowed" in value)) {
    return false;
  }
  if (value.allowed === true) return true;
  if (value.allowed !== false || !("code" in value)) return false;
  if (value.code === "PACKAGE_REQUIRED") return true;
  return (
    value.code === "QUOTA_EXCEEDED" &&
    "limit" in value &&
    typeof value.limit === "number" &&
    "used" in value &&
    typeof value.used === "number" &&
    "reserved" in value &&
    typeof value.reserved === "number"
  );
}

export async function reserveTtsQuota(
  userId: string,
  jobId: string,
  characters: number,
) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "reserve_tts_quota",
    {
      p_user_id: userId,
      p_job_id: jobId,
      p_characters: characters,
    },
  );
  if (error) {
    throw new Error(
      "Could not reserve voice generation quota. Verify the Supabase quota migration and server configuration.",
    );
  }
  if (!isReservationResult(data)) {
    throw new Error("Quota service returned an invalid reservation result.");
  }
  return data;
}

export async function settleTtsQuota(jobId: string, success: boolean) {
  const { error } = await createSupabaseAdminClient().rpc("settle_tts_quota", {
    p_job_id: jobId,
    p_success: success,
  });
  if (error) {
    throw new Error(
      "Could not update voice generation quota. Verify the Supabase quota migration and server configuration.",
    );
  }
}
