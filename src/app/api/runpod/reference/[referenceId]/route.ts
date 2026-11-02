import { readReference, validStoredId } from "@/lib/runpod-storage";

type RouteContext = {
  params: Promise<{ referenceId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { referenceId } = await context.params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!validStoredId(referenceId)) {
    return new Response("Not found", { status: 404 });
  }

  const reference = await readReference(referenceId, token);
  if (!reference) return new Response("Not found", { status: 404 });

  return new Response(reference.bytes, {
    headers: {
      "Content-Type": reference.contentType,
      "Content-Length": String(reference.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
