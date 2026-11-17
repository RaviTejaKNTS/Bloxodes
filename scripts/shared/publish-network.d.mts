export const PUBLISH_CONCURRENCY: 8;
export function formatPublishError(error: unknown): string;
export function isTransientPublishError(error: unknown, depth?: number): boolean;
export function retryPublishNetwork<T>(work: () => PromiseLike<T>, options?: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> }): Promise<T>;
export function readPublishQuery<T extends { error: unknown; status?: number }>(query: () => PromiseLike<T>): Promise<T>;
export function requirePublishResponse(response: Response, context: string): Promise<Response>;
export function mapPublishConcurrent<T, R>(items: readonly T[], work: (item: T, index: number) => Promise<R>, options?: { concurrency?: number; label?: string; every?: number; log?: (message: string) => void }): Promise<R[]>;
export function createPublishLimiter(concurrency?: number): <T>(work: () => Promise<T>) => Promise<T>;

export type LiveImageSelection = { mode?: "all" | "new" | "none"; expectedImages: string[]; renderedImages?: string[]; uploadedImages?: string[]; changedImages?: string[] };
export function selectLiveImages(input: LiveImageSelection): string[];
export function requireLiveImageResponse(response: Response, image: string): Promise<Response>;
