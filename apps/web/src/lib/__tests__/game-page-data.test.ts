import { describe,expect,it } from "vitest";
import { parseGameMapData,parseGameCatalogData,parseGameQuizData,safeGameContentUrl } from "../game-page-data";
const map={image:"/map.png",width:100,height:100,attribution:"Game map source",markers:[{id:"a",title:"A",x:0,y:100}]};
const question={id:"a",question:"Choose A",options:["a","b","c","d"].map(id=>({id,text:id})),correctOptionId:"a"};
describe("shared reference data",()=>{
  it("accepts boundary coordinates and rejects missing, infinite or out-of-bounds positions",()=>{
    expect(parseGameMapData(map).markers[0].y).toBe(100);
    for(const x of [undefined,NaN,Infinity,-1,101]) expect(()=>parseGameMapData({...map,markers:[{...map.markers[0],x}]})).toThrow();
    expect(()=>parseGameMapData({...map,width:0})).toThrow();
  });
  it("rejects duplicate markers and dangerous image or guide URLs",()=>{
    expect(()=>parseGameMapData({...map,markers:[...map.markers,...map.markers]})).toThrow();
    expect(()=>parseGameMapData({...map,image:"javascript:alert(1)"})).toThrow();
    expect(()=>parseGameMapData({...map,markers:[{...map.markers[0],href:"//example.com"}]})).toThrow();
  });
  it("accepts different catalog columns without requiring cards",()=>{
    expect(parseGameCatalogData({columns:[{key:"weapon",label:"Weapon"},{key:"damage",label:"Damage"}],items:[{id:"sword",weapon:"Sword",damage:7}]}).items[0].damage).toBe(7);
    expect(parseGameCatalogData({columns:[{key:"recipe",label:"Recipe"}],items:[{id:"plate",recipe:"Iron plate"}]}).columns[0].key).toBe("recipe");
  });
  it("rejects nested catalog values, unknown columns and duplicate row IDs",()=>{
    const columns=[{key:"name",label:"Name"}];
    for(const items of [[{id:"a",name:{html:"bad"}}],[{id:"a",secret:"bad"}],[{id:"a",name:"A"},{id:"a",name:"B"}]])expect(()=>parseGameCatalogData({columns,items})).toThrow();
  });
  it("keeps quiz answer validation and rejects unsafe question images",()=>{
    const quiz={easy:[question],medium:[{...question,id:"b"}],hard:[{...question,id:"c"}]};
    expect(parseGameQuizData(quiz).hard).toHaveLength(1);
    expect(()=>parseGameQuizData({...quiz,easy:[{...question,correctOptionId:"missing"}]})).toThrow();
    expect(()=>parseGameQuizData({...quiz,easy:[{...question,image:"data:text/html,bad"}]})).toThrow();
  });
  it("rejects remote credentials, protocol-relative and backslash URLs",()=>{
    for(const url of ["https://user:password@example.com/map.png","//example.com/map.png","/\\example.com/map.png","javascript:alert(1)"])expect(safeGameContentUrl(url)).toBe(false);
    expect(safeGameContentUrl("/gta/wiki/gta-5#item-one")).toBe(true);
    expect(safeGameContentUrl("https://example.com/map.png")).toBe(true);
  });
});
