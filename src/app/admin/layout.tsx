import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-auth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!getSupabaseConfig()) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !isAdminEmail(data.user?.email)) redirect("/");

  return children;
}
