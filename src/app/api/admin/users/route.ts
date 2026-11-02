import { getAdminContext } from "@/lib/admin-auth";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const result = await getAdminContext();
  if (result.response) return result.response;

  const page = Math.max(
    1,
    Math.min(10_000, Number(new URL(request.url).searchParams.get("page")) || 1),
  );
  const { data, error } = await result.context.adminClient.auth.admin.listUsers({
    page,
    perPage: PAGE_SIZE,
  });
  if (error) {
    return Response.json(
      { error: "Could not load user accounts." },
      { status: 502 },
    );
  }

  const userIds = data.users.map((user) => user.id);
  const quotaResult = userIds.length
    ? await result.context.adminClient
        .from("user_tts_quotas")
        .select("user_id, package_id, quota_limit, characters_used, characters_reserved")
        .in("user_id", userIds)
    : { data: [], error: null };
  if (quotaResult.error) {
    return Response.json(
      { error: "Could not load account quotas. Apply the Supabase quota migration first." },
      { status: 503 },
    );
  }
  const quotas = new Map(
    (quotaResult.data ?? []).map((quota) => [quota.user_id, quota]),
  );

  return Response.json(
    {
      users: data.users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        name:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "",
        createdAt: user.created_at,
        quota: quotas.get(user.id) ?? null,
      })),
      hasMore: data.users.length === PAGE_SIZE,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
