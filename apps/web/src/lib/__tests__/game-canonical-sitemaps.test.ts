import { expect, it } from "vitest";
import { GET as gta } from "@/app/sitemaps/gta.xml/route";
import { GET as redDead } from "@/app/sitemaps/red-dead.xml/route";
import { GET as minecraft } from "@/app/sitemaps/minecraft.xml/route";
import { GET as index } from "@/app/sitemap.xml/route";
it.each([["gta", gta], ["red-dead", redDead], ["minecraft", minecraft]] as const)("redirects the retired %s sitemap permanently", async (namespace, handler) => {
 const response = handler(new Request(`https://bloxodes.com/sitemaps/${namespace}.xml`));
 expect(response.status).toBe(308);
 expect(response.headers.get("location")).toBe("https://bloxodes.com/sitemaps/games.xml");
});
it("lists games.xml once, retains moved.xml and omits retired sitemap URLs", async () => {
 const xml = await (await index()).text();
 expect(xml.split("/sitemaps/games.xml")).toHaveLength(2);
 expect(xml).toContain("/sitemaps/moved.xml");
 for (const ns of ["gta", "red-dead", "minecraft"]) expect(xml).not.toContain(`/sitemaps/${ns}.xml`);
});
