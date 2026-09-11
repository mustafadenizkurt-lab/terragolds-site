import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import {
  createBlogPost,
  parseBlogPostInput,
  readBlogPosts,
} from "../../../../lib/blog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json({ posts: await readBlogPosts() });
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const input = parseBlogPostInput((await request.json()) as Record<string, unknown>);
    await createBlogPost(input);
    return Response.json({ posts: await readBlogPosts() }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Yazı oluşturulamadı." },
      { status: 400 },
    );
  }
}
