declare const chrome: {
  runtime: {
    onMessage: {
      addListener(
        callback: (message: any, sender: unknown, sendResponse: (response: any) => void) => boolean | void
      ): void;
    };
    getURL(path: string): string;
    sendMessage(message: any, callback: (response?: any) => void): void;
    lastError?: {
      message?: string;
    };
  };
  storage: {
    sync: {
      get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: (items: Record<string, unknown>) => void
      ): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };
    onChanged: {
      addListener(
        callback: (
          changes: Record<
            string,
            {
              oldValue?: unknown;
              newValue?: unknown;
            }
          >,
          areaName: string
        ) => void
      ): void;
    };
  };
};
