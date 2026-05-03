declare namespace NodeJS {
  type ProcessEnv = {
    EXPO_PUBLIC_BLOXODES_API_URL?: string;
  };
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
