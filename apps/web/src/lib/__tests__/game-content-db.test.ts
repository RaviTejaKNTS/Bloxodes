import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gameDatabase } from "../game-content-db";
function fake() {
 const query = { eq: vi.fn(), select: vi.fn(), insert: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() };
 for(const method of Object.values(query)) method.mockReturnValue(query);
 const from=vi.fn(()=>query);
 return { client: {from} as unknown as SupabaseClient, from, query };
}
describe("shared game storage boundaries",()=>{
 it("scopes readers and excludes franchise roots from legacy game lists",()=>{
  const {client,from,query}=fake();gameDatabase(client,"gta").from("games").select("id");
  expect(from).toHaveBeenCalledWith("games");expect(query.eq.mock.calls).toEqual([["namespace","gta"],["kind","game"]]);
 });
 it("scopes updates and deletes before caller filters",()=>{
  const {client,query}=fake();const db=gameDatabase(client,"sandustry");db.from("wiki_pages").update({title:"Machines"});db.from("wiki_collection_items").delete();
  expect(query.eq.mock.calls).toEqual([["namespace","sandustry"],["namespace","sandustry"]]);
 });
 it("attaches namespace to every inserted row",()=>{
  const {client,query}=fake();gameDatabase(client,"sandustry").from("wiki_collection_items").insert([{item_slug:"press"},{item_slug:"belt"}]);
  expect(query.insert).toHaveBeenCalledWith([{item_slug:"press",namespace:"sandustry"},{item_slug:"belt",namespace:"sandustry"}]);
 });
 it("rejects explicit cross-game insertion and update",()=>{
  const {client,query}=fake();const db=gameDatabase(client,"gta");
  expect(()=>db.from("wiki_pages").insert({namespace:"minecraft"})).toThrow("Cross-game write rejected");
  expect(()=>db.from("wiki_pages").update({namespace:"minecraft"})).toThrow("Cross-game write rejected");
  expect(query.insert).not.toHaveBeenCalled();expect(query.update).not.toHaveBeenCalled();
 });
 it("keeps conflicts scoped while preserving caller options",()=>{
  const {client,query}=fake();gameDatabase(client,"red-dead").from("collection_progress").upsert({user_id:"user",collection_code:"cards"},{onConflict:"user_id,collection_code",ignoreDuplicates:true});
  expect(query.upsert).toHaveBeenCalledWith({user_id:"user",collection_code:"cards",namespace:"red-dead"},{onConflict:"namespace,user_id,collection_code",ignoreDuplicates:true});
 });
 it("disambiguates franchise and game slugs in game upserts",()=>{
  const {client,query}=fake();gameDatabase(client,"gta").from("games").upsert({slug:"gta"},{onConflict:"slug"});
  expect(query.upsert).toHaveBeenCalledWith({slug:"gta",namespace:"gta"},{onConflict:"namespace,slug,kind"});
 });
 it("rejects malformed namespaces before creating a query",()=>{
  const {client,from}=fake();expect(()=>gameDatabase(client,"../gta")).toThrow("Invalid game namespace");expect(from).not.toHaveBeenCalled();
 });
});
