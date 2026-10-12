type QuizProgress = {
  code: string;
  lastScore: number | null;
  lastTotal: number | null;
};

export type QuizProgressState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; progress: Map<string, QuizProgress> }
  | { status: "error" };

const quizProgressPromises = new Map<string, Promise<QuizProgressState>>();

export async function loadQuizProgressIndex(endpoint: string): Promise<QuizProgressState> {
  if (!quizProgressPromises.has(endpoint)) {
    const promise: Promise<QuizProgressState> = fetch(endpoint, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) return { status: "signed-out" } as QuizProgressState;
        if (!res.ok) return { status: "error" } as QuizProgressState;
        const payload = await res.json();
        const rows = Array.isArray(payload?.progress) ? payload.progress : [];
        const progress = new Map<string, QuizProgress>();
        for (const row of rows) {
          const rowCode = typeof row?.code === "string" ? row.code.trim().toLowerCase() : "";
          if (!rowCode) continue;
          progress.set(rowCode, {
            code: rowCode,
            lastScore: typeof row?.lastScore === "number" ? row.lastScore : null,
            lastTotal: typeof row?.lastTotal === "number" ? row.lastTotal : null
          });
        }
        return { status: "ready", progress } as QuizProgressState;
      })
      .catch(() => ({ status: "error" }) as QuizProgressState)
      .then((state) => {
        if (state.status === "error" && quizProgressPromises.get(endpoint) === promise) {
          quizProgressPromises.delete(endpoint);
        }
        return state;
      });
    quizProgressPromises.set(endpoint, promise);
  }

  return quizProgressPromises.get(endpoint)!;
}

