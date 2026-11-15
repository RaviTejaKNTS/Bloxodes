import * as React from "react";

// React server renders share reads within a request. Other environments run the loader directly.
// Check membership first because partial React mocks may throw when an absent export is read.
export const requestCache: typeof React.cache =
  "cache" in React && typeof React.cache === "function" ? React.cache : (fn) => fn;
