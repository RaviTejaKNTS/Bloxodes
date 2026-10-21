// Loose types: callers pass database rows of several shapes.
export function franchiseImageUrl(value: any): string | null;
export function requireFranchiseHubImages(game: any, label?: string): Array<{ url: string; role: any; label: string }>;
export function requireFranchiseCollectionImage(items: any[], label: string): void;
export function assertFranchisePageImages(input: { namespace: string; payload: any; storedGames: any[]; loadPage: (group: string, input: any) => Promise<any>; verifyImage: (image: any) => Promise<unknown> }): Promise<void>;
