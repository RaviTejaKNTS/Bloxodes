// Read the exact published revision through the existing collection exporter.
process.argv.splice(2, 0, "--namespace", "minecraft");
void import("../gta/export-gta-collection-workspace").catch(error => { console.error(error); process.exitCode = 1; });
