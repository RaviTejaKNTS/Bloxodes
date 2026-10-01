import test from "node:test";
import assert from "node:assert/strict";
import { officialUniverseCover } from "../official-universe-cover";
const response=(data: unknown)=>async()=>new Response(JSON.stringify({data}),{headers:{'content-type':'application/json'}});
test('official cover matches exact universe and completed media, ignoring pending and other games',async()=>{
  const url=await officialUniverseCover(123,response([{universeId:456,thumbnails:[{state:'Completed',imageUrl:'https://tr.rbxcdn.com/wrong'}]},{universeId:123,thumbnails:[{state:'Pending',imageUrl:'https://tr.rbxcdn.com/pending'},{state:'Completed',imageUrl:'https://tr.rbxcdn.com/exact'}]}]));
  assert.equal(url,'https://tr.rbxcdn.com/exact');
  assert.equal(await officialUniverseCover(123,response([])),null);
  await assert.rejects(officialUniverseCover(123,response([{universeId:123,thumbnails:[{state:'Completed',imageUrl:'https://unrelated.example/cover'}]}])),/unexpected media origin/);
});
