import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import {
  deleteBlogPost,
  parseBlogPostInput,
  readBlogPosts,
  updateBlogPost,
} from "../../../../../lib/blog";

export const dynamic = "force-dynamic";

function readId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Yazı bulunamadı.");
  }
  return id;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const id = readId((await params).id);
    const input = parseBlogPostInput((await request.json()) as Record<string, unknown>);
    await updateBlogPost(id, input);
    return Response.json({ posts: await readBlogPosts() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Yazı güncellenemedi." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const id = readId((await params).id);
    await deleteBlogPost(id);
    return Response.json({ posts: await readBlogPosts() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Yazı silinemedi." },
      { status: 400 },
    );
  }
}
