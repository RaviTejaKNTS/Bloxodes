declare const chrome: {
  tabs: {
    query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: Array<{ url?: string }>) => void
    ): void;
    create(createProperties: { url: string }): void;
  };
  runtime: {
    getURL(path: string): string;
    lastError?: { message?: string };
  };
  storage: {
    local: {
      get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
      remove(keys: string | string[], callback?: () => void): void;
    };
  };
};
