import { publishedArticleAction } from "./article-published-update";
import { isDeepStrictEqual } from "node:util";
import { assertArticleLinks } from "./article-links";
import { createNotionGameArticleQueue } from "../articles/notion-article-queue";
import { assertArticleQueue, assertArticleResultBinding, completeArticlePublication, type ArticleResultBinding } from "./article-publish";
import { acquireAgentWorkLock } from "../shared/agent-work-lock";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { bundleSchema, gameArticleFinalSchema, type GameArticleFinal } from "../../contracts/game-article/v1/schema";
import type { ContentOptions } from "./wiki-content-options";
import { bundlePath } from "../shared/roblox-wiki-bundle";
import { assertLocalContentPublication } from "../shared/local-content-publication-guard";
import { readPublishQuery } from "../shared/publish-network.mjs";
import { publicCopyFindings } from "./check-public-copy";
import { assertProductionArticleMediaUrls, assertArticleImageReadiness, checkArticleImageReadiness, readArticleImageManifest, findArticleImages, usedVerifiedArticleImages } from "./article-image-readiness";
import { assertNoArticleMediaErrors, checkArticleMedia } from "./check-article-media";
import { articleVerificationPages, verifyArticleAssets, verifyArticleLive } from "./article-publish";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";
import { fetchImageBytes } from "../shared/fetch-image-bytes";
import { toMediaPublicUrl } from "../shared/storage-public-url";
import { resolveSeoTitle } from "@/lib/seo";
import { ROBLOX_ARTICLE_GAME_SLUG, articleGameSlugFromUniverse } from "@/lib/slug";
import { pickEligibleArticleAuthorId } from "../shared/article-author-selection";
import { equalFields } from "./roblox-wiki-publish";

const json = async (file:string)=>JSON.parse(await fs.readFile(file,"utf8"));
async function read(query:()=>PromiseLike<any>) {
  const result = await readPublishQuery(query);
  if (result.error) throw result.error;
  return result.data;
}
export async function assertGameArticleQueueBinding(row:any, bundle:{slug:string;namespace:string;game:{slug:string;kind:string}}, binding:ArticleResultBinding) {
  assertArticleQueue(row,bundle.slug);await assertArticleResultBinding(row,binding);
  if(row.namespace!==bundle.namespace || row.game_slug!==bundle.game.slug || row.game_kind!==bundle.game.kind)throw new Error("Game queue identity differs from bundle.");
}
export async function resolveGameArticleIdentity(db:SupabaseClient, namespace:string, game:{slug:string;kind:string}) {
  const row = await read(()=>db.from("games").select("id,namespace,slug,kind,parent_id,is_published,cover_image").eq("namespace",namespace).eq("slug",game.slug).eq("kind",game.kind).single());
  if (!row.is_published) throw new Error("Article requires a published owning game.");
  if (row.parent_id) {
    const parent = await read(()=>db.from("games").select("is_published").eq("namespace",namespace).eq("id",row.parent_id).single());
    if (!parent.is_published) throw new Error("Article requires a published parent game.");
  }
  return row;
}
export async function assertGameArticleRoute(db:SupabaseClient, slug:string, gameId:string, namespace:string) {
  const current = await read(()=>db.from("game_article_pages").select("*").eq("slug",slug).maybeSingle());
  if (current && (current.namespace!==namespace || current.game_id!==gameId)) throw new Error("Article slug belongs to another game.");
  const roblox = await read(()=>db.from("articles").select("id").eq("slug",slug).maybeSingle());
  if (roblox) throw new Error("Article slug belongs to Roblox.");
  const route = await read(()=>db.from("site_routes").select("source,page_type,page_id,status").eq("path",`/articles/${slug}`).maybeSingle());
  if (route && (!current || route.source!=="game" || route.page_type!=="article" || route.page_id!==current.id || route.status!=="live")) throw new Error("Article route is reserved by another owner.");
  return current;
}
export async function assertGameArticleArchive(db:SupabaseClient, gameSlug:string) {
  const rows = await read(()=>db.from("articles").select("universe:roblox_universes(universe_id,slug,display_name,name)").eq("is_published",true).not("universe_id","is",null).limit(10000));
  const taken = gameSlug===ROBLOX_ARTICLE_GAME_SLUG || (rows??[]).some((row:any)=>{
    const universe=Array.isArray(row.universe)?row.universe[0]:row.universe;
    return universe && articleGameSlugFromUniverse(universe)===gameSlug;
  });
  if (taken) throw new Error(`Article archive /articles/games/${gameSlug} already belongs to a Roblox game.`);
}
// Some franchises have a root and a game with one slug, such as gta. Only one can own the archive URL.
export async function assertGameArticleArchiveOwner(db:SupabaseClient, game:{id:string;slug:string}) {
  const others = await read(()=>db.from("games").select("id").eq("slug",game.slug).neq("id",game.id));
  if (!others?.length) return;
  const used = await read(()=>db.from("game_article_pages").select("id").in("game_id",others.map((other:{id:string})=>other.id)).limit(1));
  if (used?.length) throw new Error(`Article archive /articles/games/${game.slug} already belongs to another game with this slug.`);
}
export function gameArticlePayload(final:GameArticleFinal, namespace:string, gameId:string) {
  return {...final,namespace,game_id:gameId,canonical_path:`/articles/${final.slug}`,seo_title:final.seo_title??null,
    meta_description:final.meta_description??null,tags:final.tags??[],faq_json:final.faq_json??[],is_published:true,
    word_count:final.content_md.trim().split(/\s+/).length};
}
export function gameArticleVerificationPages(content: string): string[] {
  return articleVerificationPages(content);
}
export function gameArticleReadbackMismatch(stored: Record<string, any>, final: GameArticleFinal) {
  const expected = gameArticlePayload(final, stored.namespace, stored.game_id);
  for (const field of ["slug", "title", "content_md", "meta_description", "seo_title", "tags", "faq_json", "sources_json", "is_published"]) {
    if (!isDeepStrictEqual(stored[field], expected[field])) return field;
  }
  return null;
}
async function verifyGameArticleLive(final: GameArticleFinal) {
  await revalidatePublishedContent(process.env,[{type:"game_content",slug:`articles/${final.slug}`}]);
  await verifyArticleLive(final,final.cover_image!,resolveSeoTitle(final.seo_title)??final.title);
}
export async function publishGameArticleBundle(options:ContentOptions) {
  if (options.only?.length || options.approvedHubCoverSha256) throw new Error("Game articles do not accept wiki selection flags.");
  if (options.target==="production" && options.apply && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  const root=await fs.realpath(path.resolve(options.bundle!));
  const bundle=bundleSchema.parse(await json(await bundlePath(root,"bundle.json")));
  const finalFile=await bundlePath(root,bundle.finalJson), mediaFile=await bundlePath(root,bundle.mediaJson);
  const finalBytes=await fs.readFile(finalFile);
  const final=gameArticleFinalSchema.parse(JSON.parse(finalBytes.toString("utf8")));
  const queueDb=bundle.queueId ? createNotionGameArticleQueue() : null;
  if(queueDb)await queueDb.validate();
  const queue=queueDb ? await queueDb.get(bundle.queueId!) : null;
  const binding:ArticleResultBinding| null=queue ? {slug:bundle.slug,resultPath:queue.result_path!,finalPath:finalFile,sha256:createHash("sha256").update(finalBytes).digest("hex")} : null;
  if(queue)await assertGameArticleQueueBinding(queue,bundle,binding!);
  await assertArticleLinks(final,{namespace:bundle.namespace,gameSlug:bundle.game.slug,kind:bundle.game.kind});
  if(final.slug!==bundle.slug) throw new Error("Article slug differs from bundle.");
  if(options.target==="production") await assertLocalContentPublication();
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE!,{auth:{persistSession:false,autoRefreshToken:false}});
  const game=await resolveGameArticleIdentity(db,bundle.namespace,bundle.game);
  const current=await assertGameArticleRoute(db,final.slug,game.id,bundle.namespace);
  await assertGameArticleArchive(db,game.slug);
  await assertGameArticleArchiveOwner(db,game);
  const authorId=current?.author_id ?? pickEligibleArticleAuthorId(
    await read(()=>db.from("authors").select("id,name,slug")),
    {preferredAuthorId:final.author_id},
  );
  final.author_id=authorId;
  const expectedPath=await read(()=>db.rpc("expected_game_page_path",{p_game_id:game.id,p_type:"article",p_slug:final.slug}));
  if(expectedPath!==`/articles/${final.slug}`) throw new Error("Target article route differs from contract.");
  const findings=publicCopyFindings(final,finalFile);
  if(findings.length) throw new Error(findings.map(f=>`${f.field}: ${f.rule}: ${f.excerpt}`).join("\n"));
  const manifest=await readArticleImageManifest(mediaFile);
  if(options.target==="production") assertProductionArticleMediaUrls(final);
  const sourceEnv=process.env;
  assertArticleImageReadiness(checkArticleImageReadiness({manifest,finalJson:final,env:sourceEnv}),mediaFile);
  assertNoArticleMediaErrors(await checkArticleMedia({...final,env:sourceEnv,requireLocalFiles:true}));
  if(final.cover_image && findArticleImages(final.content_md).some(image=>image.src===final.cover_image)) throw new Error("Article cover must not repeat a body image.");
  const coverSource=(current?.is_published && !final.cover_image ? current.cover_image : null) || final.cover_image || findArticleImages(final.content_md)[0]?.src || game.cover_image;
  if(!coverSource) throw new Error("Article cover is missing: provide cover_image, a body image, or the owning game cover_image.");
  if(options.target==="production") assertProductionArticleMediaUrls({...final,cover_image:coverSource});
  await verifyArticleAssets(final,coverSource);
  // Derive from the source bundle before promotion rewrites body URLs to target Storage.
  // Decode and prepare cover before any writes, including body image uploads.
  const cover=await fetchImageBytes(new URL(coverSource,"https://bloxodes.com").href);
  const coverBytes=await sharp(cover).webp().toBuffer();
  const expected = structuredClone(final);
  for(const entry of usedVerifiedArticleImages(manifest,expected.content_md)) {
    if(entry.public_url && entry.uploaded_path && process.env.SUPABASE_MEDIA_BUCKET) {
      const targetUrl=toMediaPublicUrl(`${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_MEDIA_BUCKET}/${entry.uploaded_path}`)!;
      expected.content_md=expected.content_md.split(entry.public_url).join(targetUrl);
    }
  }
  const expectedCover=toMediaPublicUrl(`${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_MEDIA_BUCKET}/articles/${final.slug}/cover-${createHash("sha256").update(coverBytes).digest("hex")}.webp`);
  const mismatch=current?.is_published ? gameArticleReadbackMismatch(current,expected) ??
    (final.cover_image && current.cover_image!==final.cover_image && current.cover_image!==expectedCover ? "cover_image" : null) : null;
  const action=current?.is_published ? publishedArticleAction(mismatch,Boolean(options.updatePublished)) : "update";
  if(!options.apply) { console.log("PASS game-article@1 preflight; no writes."); return; }
  if(queue)await assertGameArticleQueueBinding(await queueDb!.get(queue.id),bundle,binding!);
  if(!process.env.SUPABASE_MEDIA_BUCKET) throw new Error("Article apply requires SUPABASE_MEDIA_BUCKET.");
  if(options.target==="production" && (!process.env.REVALIDATE_SECRET || process.env.SUPABASE_MEDIA_PUBLIC_URL!=="https://media.bloxodes.com")) throw new Error("Production needs revalidation secret and production media origin.");
  if(options.target==="production") await assertLocalContentPublication();
  const stagingRoot=path.resolve("tmp/game-article-direct"); await fs.mkdir(stagingRoot,{recursive:true});
  const staging=await fs.mkdtemp(path.join(stagingRoot,"run-"));
  const unlock=await acquireAgentWorkLock(path.resolve("tmp/content-publish/article"),"direct-game-article-publish");
  if(!unlock){await fs.rm(staging,{recursive:true,force:true});throw new Error("Article publication is busy; retry.");}
  try {
    const latest=await assertGameArticleRoute(db,final.slug,game.id,bundle.namespace);
    if(!isDeepStrictEqual(latest,current))throw new Error("Live game article changed during publication preflight; retry with the current bundle.");
    if(action==="verify") {
      const verified={...expected,author_id:current.author_id,cover_image:current.cover_image};
      equalFields(current,gameArticlePayload(verified,bundle.namespace,game.id),"published game article");
      const visible=await read(()=>db.from("game_article_pages_view").select("id").eq("id",current.id).single());
      if(visible.id!==current.id)throw new Error("Published article is not visible.");
      if(options.target==="production") {
        const verify=()=>verifyGameArticleLive(verified);
        if(queue)await completeArticlePublication(queueDb!,queue,binding!,verify);else await verify();
      }
      console.log(`PASS already published: https://bloxodes.com/articles/${final.slug}`);
      return;
    }
    if(queue)await assertGameArticleQueueBinding(await queueDb!.get(queue.id),bundle,binding!);
    const stagedFinal=path.join(staging,"final.json"),stagedMedia=path.join(staging,"media.json");
    await fs.writeFile(stagedFinal,JSON.stringify(final)); await fs.writeFile(stagedMedia,JSON.stringify(manifest));
    const {collectArticleImages}=await import("./collect-article-images");
    await collectArticleImages({manifest:stagedMedia,finalFile:stagedFinal,apply:true,allowProd:options.allowProd});
    const promoted=gameArticleFinalSchema.parse(await json(stagedFinal));
    const bucket=process.env.SUPABASE_MEDIA_BUCKET;
    const key=`articles/${final.slug}/cover-${createHash("sha256").update(coverBytes).digest("hex")}.webp`;
    const upload=await db.storage.from(bucket).upload(key,coverBytes,{contentType:"image/webp",upsert:true});
    if(upload.error) throw upload.error;
    const coverUrl=toMediaPublicUrl(db.storage.from(bucket).getPublicUrl(key).data.publicUrl);
    if(!coverUrl) throw new Error("Storage returned no public cover URL.");
    promoted.cover_image=coverUrl;
    await verifyArticleAssets(promoted,promoted.cover_image);
    const payload:Record<string,any>=gameArticlePayload(promoted,bundle.namespace,game.id);
    if(current?.is_published) {payload.author_id=current.author_id;payload.published_at=current.published_at;if(!final.cover_image)payload.cover_image=current.cover_image;}
    promoted.cover_image=payload.cover_image;
    // Recheck after media work. The route registry serializes competing inserts.
    const beforeWrite=await assertGameArticleRoute(db,final.slug,game.id,bundle.namespace);
    if(!isDeepStrictEqual(beforeWrite,current))throw new Error("Live game article changed before write; retry with the current bundle.");
    const stored=await read(()=>{
      if(!current)return db.from("game_article_pages").insert(payload).select("*").single();
      let update=db.from("game_article_pages").update(payload).eq("id",current.id).eq("namespace",bundle.namespace).eq("game_id",game.id);
      if(current.updated_at)update=update.eq("updated_at",current.updated_at);
      return update.select("*").single();
    });
    equalFields(stored,payload,"game article");
    const visible=await read(()=>db.from("game_article_pages_view").select("id").eq("id",stored.id).single());
    if(visible.id!==stored.id) throw new Error("Published article is not visible.");
    if(options.target==="production") {
      const verify=()=>verifyGameArticleLive(promoted);
      if(queue)await completeArticlePublication(queueDb!,queue,binding!,verify);else await verify();
    }
    console.log(`PASS published game article: https://bloxodes.com/articles/${final.slug}`);
  } finally { try {await fs.rm(staging,{recursive:true,force:true});}finally{await unlock();} }
}
