export function wikiReceiptMatches(row: any, ticket: {requestId: string}, now?: number): boolean;
export function wikiDispatchReady(row: any, now?: number): boolean;
export function wikiDispatchRecovery(row: any, now?: number): "retry" | "inspect" | null;
export function matchingWikiRun(runs: any[], receipt: any): any;
export function wikiDispatchClaimMatches(row: any, ticket: {requestId: string}, claim: any, now?: number): boolean;
