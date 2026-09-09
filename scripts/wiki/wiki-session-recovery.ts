import { readFile, writeFile, rename } from "node:fs/promises";

export type SessionState = { sessionId?: string; repairs: number; completed?: boolean; lastError?: string };
export async function readSessionState(file: string): Promise<SessionState> {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { repairs: 0 }; throw error; }
}
export async function saveSessionState(file: string, state: SessionState) {
  await writeFile(`${file}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(`${file}.tmp`, file);
}
export async function recoverStep<T>(options: {
  file: string;
  label: string;
  operation: () => Promise<T>;
  repair: (sessionId: string, error: string) => Promise<void>;
  maxRepairs?: number;
}): Promise<T> {
  for (;;) {
    try { return await options.operation(); }
    catch (error) {
      const state = await readSessionState(options.file);
      state.lastError = `${options.label}: ${error instanceof Error ? error.message : String(error)}`;
      if (!state.sessionId || state.completed || state.repairs >= (options.maxRepairs ?? 3)) {
        await saveSessionState(options.file, state);
        throw error;
      }
      state.repairs += 1;
      await saveSessionState(options.file, state);
      await options.repair(state.sessionId, state.lastError);
    }
  }
}
export function resumedCodexArgs(sessionId: string, prompt: string, model: string, effort: string) {
  return ["exec", "resume", "--model", model, "--config", `model_reasoning_effort=${JSON.stringify(effort)}`, "--json", sessionId, prompt];
}
