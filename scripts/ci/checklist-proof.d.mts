export type ChecklistItem = {id?:string;section_code:string;title:string;description?:string|null;is_required?:boolean;item_key?:string};
export function fingerprint(value:string|Buffer|unknown):string;
export function checklistItems(items:ChecklistItem[],shared?:boolean):string[];
export function assertChecklistItems(expected:ChecklistItem[],actual:ChecklistItem[],shared?:boolean):void;
export function assertPageFields(expected:Record<string,unknown>,actual:Record<string,unknown>):void;
export function retainChecklistIds(items:ChecklistItem[],saved:ChecklistItem[]):Array<{id?:string;section_code:string;title:string;description:string|null;is_required:boolean}>;
