export type GameIdentity = { id: string; namespace: string; slug: string; kind: "franchise" | "game" };
export type GamePagesPayload = Record<string, Array<Record<string, any>>>;
export type ManagedGameLookup = {
  gameById(id: string): Promise<{ namespace: string } | null>;
  gameByIdentity(identity: { namespace: string; slug: string; kind: string }): Promise<string | null>;
  pageId(table: string, filters: Record<string, unknown>): Promise<string | null>;
};
export const MANAGED_TARGET: string;
export function parseGameIdentities(text: string | undefined | null): GameIdentity[];
export function referencedGameIds(payload: GamePagesPayload): string[];
export function productionGameIdentities(batch: { operations: Array<Record<string, any>> }, readPayload: (file: string) => GamePagesPayload, fetchGames: (ids: string[]) => Promise<GameIdentity[]>): Promise<GameIdentity[]>;
export function managedGamePagesPayload(input: { payload: GamePagesPayload; namespace: string; identities: GameIdentity[]; target: string | undefined; lookup: ManagedGameLookup }): Promise<{ payload: GamePagesPayload; changes: Array<{ group: string; from: string; to: string }> }>;
