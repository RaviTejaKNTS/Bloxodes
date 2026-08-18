import { ARTICLE_PATCH_FIELDS, getAdminArticle, updateAdminArticle, type AdminArticlePatch } from "@/lib/admin/articles";
import { adminJson, adminWriteErrorResponse, guardAdminRequest, readAdminPatchBody, readAdminSlug } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guardAdminRequest(request, "articles");
  if (blocked) return blocked;

  const slug = readAdminSlug(new URL(request.url).searchParams.get("slug"));
  if (!slug) return adminJson({ error: "Missing or invalid slug" }, 400);

  try {
    const page = await getAdminArticle(slug);
    if (!page) return adminJson({ error: "Article not found" }, 404);
    return adminJson({ page });
  } catch (error) {
    console.error("admin/articles GET failed", error);
    return adminJson({ error: "Failed to load article" }, 500);
  }
}

export async function PATCH(request: Request) {
  const blocked = guardAdminRequest(request, "articles");
  if (blocked) return blocked;

  const parsed = await readAdminPatchBody(request, ARTICLE_PATCH_FIELDS);
  if (parsed instanceof Response) return parsed;

  try {
    const page = await updateAdminArticle(parsed.slug, parsed.patch as AdminArticlePatch);
    if (!page) return adminJson({ error: "Article not found" }, 404);
    return adminJson({ page });
  } catch (error) {
    return adminWriteErrorResponse(error, "article");
  }
}
