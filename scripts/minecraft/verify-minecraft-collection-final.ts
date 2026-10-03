// Reuse the existing franchise workflow with Minecraft namespace ownership.
process.argv.splice(2, 0, "--namespace", "minecraft");
void import("../franchise/verify-franchise-collection-final").catch(error => { console.error(error); process.exitCode = 1; });
