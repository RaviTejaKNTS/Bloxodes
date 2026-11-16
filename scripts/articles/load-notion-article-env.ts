import { loadBloxodesEnv } from "../shared/env-files";

// Queue/discovery commands need only the article integration, never a DB target.
process.env.BLOXODES_ENV_PROFILE = "process-only";
const overlays = new Set((process.env.BLOXODES_ENV_OVERLAYS || "").split(",").filter(Boolean));
overlays.add("articles");
process.env.BLOXODES_ENV_OVERLAYS = [...overlays].join(",");
loadBloxodesEnv();
