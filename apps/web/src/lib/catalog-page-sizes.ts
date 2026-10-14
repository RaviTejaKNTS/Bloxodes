/**
 * Page sizes for the paged catalog browsers. The server pages, their JSON APIs and the client
 * browsers' fixed card slots all read these, so a page never holds more cards than it has slots.
 * Client-safe: no server imports.
 */
export const FREE_ITEMS_PAGE_SIZE = 24;
export const MUSIC_IDS_PAGE_SIZE = 24;
export const DECAL_IDS_PAGE_SIZE = 24;
export const MESH_IDS_PAGE_SIZE = 40;
