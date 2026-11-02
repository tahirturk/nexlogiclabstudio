import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function isSupabaseAdminConfigured() {
  return Boolean(
    getSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function createSupabaseAdminClient() {
  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRoleKey) {
    throw new Error(
      "Configure Supabase and SUPABASE_SERVICE_ROLE_KEY on the server to use account administration.",
    );
  }

  return createClient(config.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
