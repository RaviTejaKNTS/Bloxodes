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
};
