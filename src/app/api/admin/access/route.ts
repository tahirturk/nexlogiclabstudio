import { getAdminContext } from "@/lib/admin-auth";

export async function GET() {
  const result = await getAdminContext();
  if (result.response) {
    if (result.response.status === 401 || result.response.status === 403) {
      return Response.json({ isAdmin: false });
    }
    return result.response;
  }

  return Response.json({ isAdmin: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
