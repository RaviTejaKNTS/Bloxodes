// Reuse the existing franchise workflow with Minecraft namespace ownership.
process.argv.splice(2, 0, "--namespace", "minecraft", "--game", "minecraft");
void import("../franchise/publish-franchise-wiki-hubs").catch(error => { console.error(error); process.exitCode = 1; });
