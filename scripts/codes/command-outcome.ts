// Keep failure reporting and exit status identical for timer and request failures.
export async function discoveryExitCode(run: () => Promise<void>, report: (line: string) => void = console.error) {
  try { await run(); return 0; }
  catch (error) {
    report(`Codes discovery failed: ${error instanceof Error ? error.message : "Unknown failure"}`);
    return 1;
  }
}
