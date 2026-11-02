import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

type AdminContext = {
  user: { id: string; email: string };
  adminClient: ReturnType<typeof createSupabaseAdminClient>;
};

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((adminEmail) => adminEmail.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function getAdminContext(): Promise<
  | { context: AdminContext; response?: never }
  | { context?: never; response: Response }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return {
      response: Response.json(
        { error: "Sign in to access administration." },
        { status: 401 },
      ),
    };
  }

  if (!isAdminEmail(data.user.email)) {
    return {
      response: Response.json(
        { error: "You do not have permission to access administration." },
        { status: 403 },
      ),
    };
  }

  if (!isSupabaseAdminConfigured()) {
    return {
      response: Response.json(
        { error: "Configure SUPABASE_SERVICE_ROLE_KEY on the server to enable administration." },
        { status: 503 },
      ),
    };
  }

  return {
    context: {
      user: { id: data.user.id, email: data.user.email },
      adminClient: createSupabaseAdminClient(),
    },
  };
}
