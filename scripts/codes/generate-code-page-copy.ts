import "../shared/load-env";
import { runLegacyGeneration } from "../shared/code-page-pipeline";

runLegacyGeneration().catch((error) => {
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
