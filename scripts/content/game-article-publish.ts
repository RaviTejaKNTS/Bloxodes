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
import { assertArticleImageReadiness, checkArticleImageReadiness, readArticleImageManifest, findArticleImages } from "./article-image-readiness";
import { assertNoArticleMediaErrors, checkArticleMedia } from "./check-article-media";
import { verifyArticleAssets, verifyArticleLive } from "./article-publish";
import { revalidatePublishedContent } from "../shared/revalidate-published-content";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { fetchImageBytes } from "../shared/fetch-image-bytes";
import { toMediaPublicUrl } from "../shared/storage-public-url";
import { parseArticleContentPages } from "@/lib/article-blocks";
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
  return parseArticleContentPages(content).map(blocks=>blocks.map(block=>{
    if(block.kind==="markdown") return block.markdown;
    if(block.kind==="invalid") throw new Error(`Invalid article block: ${block.message}`);
    return "```"+block.kind+"\n"+JSON.stringify(block.data)+"\n```";
  }).join("\n\n"));
}
export async function publishGameArticleBundle(options:ContentOptions) {
  if (options.only?.length || options.approvedHubCoverSha256) throw new Error("Game articles do not accept wiki selection flags.");
  if (options.target==="production" && options.apply && !options.allowProd) throw new Error("Production apply requires --allow-prod.");
  const root=await fs.realpath(path.resolve(options.bundle!));
  const bundle=bundleSchema.parse(await json(await bundlePath(root,"bundle.json")));
  const finalFile=await bundlePath(root,bundle.finalJson), mediaFile=await bundlePath(root,bundle.mediaJson);
  const final=gameArticleFinalSchema.parse(await json(finalFile));
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
  const expected=await read(()=>db.rpc("expected_game_page_path",{p_game_id:game.id,p_type:"article",p_slug:final.slug}));
  if(expected!==`/articles/${final.slug}`) throw new Error("Target article route differs from contract.");
  const findings=publicCopyFindings(final,finalFile);
  if(findings.length) throw new Error(findings.map(f=>`${f.field}: ${f.rule}: ${f.excerpt}`).join("\n"));
  const manifest=await readArticleImageManifest(mediaFile);
  // Source manifest may reference managed-development media during promotion.
  const dev=options.target==="managed-dev" ? {url:process.env.SUPABASE_URL!} : resolveArticleDevCredentials({envFile:process.env.ARTICLE_DEV_ENV_FILE||path.resolve(".envs/targets/managed-dev.env")});
  const sourceEnv={...process.env,SUPABASE_URL:dev.url};
  assertArticleImageReadiness(checkArticleImageReadiness({manifest,finalJson:final,env:sourceEnv}),mediaFile);
  assertNoArticleMediaErrors(await checkArticleMedia({...final,env:sourceEnv,requireLocalFiles:true}));
  if(final.cover_image && findArticleImages(final.content_md).some(image=>image.src===final.cover_image)) throw new Error("Article cover must not repeat a body image.");
  const coverSource=final.cover_image || findArticleImages(final.content_md)[0]?.src || game.cover_image;
  if(!coverSource) throw new Error("Article cover is missing: provide cover_image, a body image, or the owning game cover_image.");
  await verifyArticleAssets(final,coverSource);
  // Derive from the source bundle before promotion rewrites body URLs to target Storage.
  // Decode and prepare cover before any writes, including body image uploads.
  const cover=await fetchImageBytes(new URL(coverSource,"https://bloxodes.com").href);
  const coverBytes=await sharp(cover).webp().toBuffer();
  if(!options.apply) { console.log("PASS game-article@1 preflight; no writes."); return; }
  if(!process.env.SUPABASE_MEDIA_BUCKET) throw new Error("Article apply requires SUPABASE_MEDIA_BUCKET.");
  if(options.target==="production" && (!process.env.REVALIDATE_SECRET || process.env.SUPABASE_MEDIA_PUBLIC_URL!=="https://media.bloxodes.com")) throw new Error("Production needs revalidation secret and production media origin.");
  if(options.target==="production") await assertLocalContentPublication();
  const stagingRoot=path.resolve("tmp/game-article-direct"); await fs.mkdir(stagingRoot,{recursive:true});
  const staging=await fs.mkdtemp(path.join(stagingRoot,"run-"));
  try {
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
    const payload=gameArticlePayload(promoted,bundle.namespace,game.id);
    // Recheck after media work. The route registry serializes competing inserts.
    await assertGameArticleRoute(db,final.slug,game.id,bundle.namespace);
    const stored=await read(()=>current ? db.from("game_article_pages").update(payload).eq("id",current.id).eq("namespace",bundle.namespace).eq("game_id",game.id).select("*").single() : db.from("game_article_pages").insert(payload).select("*").single());
    equalFields(stored,payload,"game article");
    const visible=await read(()=>db.from("game_article_pages_view").select("id").eq("id",stored.id).single());
    if(visible.id!==stored.id) throw new Error("Published article is not visible.");
    if(options.target==="production") {
      await revalidatePublishedContent(process.env,[{type:"game_content",slug:`articles/${final.slug}`}]);
      const pages=gameArticleVerificationPages(promoted.content_md);
      for (const [index,content_md] of pages.entries()) {
        await verifyArticleLive({...promoted,content_md},promoted.cover_image,resolveSeoTitle(promoted.seo_title)??promoted.title,index+1);
      }
    }
    console.log(`PASS published game article: https://bloxodes.com/articles/${final.slug}`);
  } finally { await fs.rm(staging,{recursive:true,force:true}); }
}
