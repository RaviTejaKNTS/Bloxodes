import { describe, expect, it } from 'vitest';
import { reconcileGameProgress } from '../game-progress-reconcile';
describe('shared collection revision progress', () => {
 const current = new Set(['retained', 'new']);
 const history = new Set(['removed']);
 it('accepts old local IDs without blocking new completion and retains history', () => {
  expect(reconcileGameProgress(['removed','new'],['removed','retained'],current,history)).toEqual({stored:['new','removed'],visible:['new']});
 });
 it('preserves saved historical completion when the client only submits current IDs', () => {
  expect(reconcileGameProgress(['new'],['removed'],current,history)?.stored).toEqual(['new','removed']);
 });
 it('rejects a submitted item that never belonged to this collection', () => {
  expect(reconcileGameProgress(['foreign','new'],[],current,history)).toBeNull();
 });
 it('clears historical completion on explicit reset', () => {
  expect(reconcileGameProgress([],['removed','retained'],current,history)).toEqual({stored:[],visible:[]});
 });
});
