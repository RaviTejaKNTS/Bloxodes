import { CODE_PAGE_PATCH_FIELDS, getAdminCodePage, updateAdminCodePage, type AdminCodePagePatch } from "@/lib/admin/codes";
import { adminJson, adminWriteErrorResponse, guardAdminRequest, readAdminPatchBody, readAdminSlug } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guardAdminRequest(request, "codes");
  if (blocked) return blocked;

  const slug = readAdminSlug(new URL(request.url).searchParams.get("slug"));
  if (!slug) return adminJson({ error: "Missing or invalid slug" }, 400);

  try {
    const page = await getAdminCodePage(slug);
    if (!page) return adminJson({ error: "Codes page not found" }, 404);
    return adminJson({ page });
  } catch (error) {
    console.error("admin/codes GET failed", error);
    return adminJson({ error: "Failed to load codes page" }, 500);
  }
}

export async function PATCH(request: Request) {
  const blocked = guardAdminRequest(request, "codes");
  if (blocked) return blocked;

  const parsed = await readAdminPatchBody(request, CODE_PAGE_PATCH_FIELDS);
  if (parsed instanceof Response) return parsed;

  try {
    const page = await updateAdminCodePage(parsed.slug, parsed.patch as AdminCodePagePatch);
    if (!page) return adminJson({ error: "Codes page not found" }, 404);
    return adminJson({ page });
  } catch (error) {
    return adminWriteErrorResponse(error, "codes page");
  }
}
