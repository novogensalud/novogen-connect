import {test} from 'node:test';import assert from 'node:assert/strict';
import {newSnake,stepSnake,placeFood,newBlocks,moveBlocks,rotate,fits} from '../lib/game-engine';
test('Snake rejects reverse direction, grows on food and ends on walls',()=>{
 let s=newSnake(()=>0);s={...s,food:{x:9,y:9}};
 let next=stepSnake(s,'left');assert.equal(next.direction,'right');assert.equal(next.score,10);assert.equal(next.body.length,4);
 next={...next,body:[{x:17,y:9},{x:16,y:9}]};assert.equal(stepSnake(next,'right').over,true);
 assert.equal(placeFood([{x:0,y:0}],1),null);
});
test('Snake can move into a tail cell that is leaving and detects body collision',()=>{
 const s={...newSnake(()=>0),body:[{x:1,y:1},{x:1,y:2},{x:2,y:2},{x:2,y:1}],direction:'up' as const,food:{x:0,y:0}};
 assert.equal(stepSnake(s,'right',3).over,false);
 assert.equal(stepSnake({...s,body:[...s.body,{x:2,y:0}]},'right',3).over,true);
});
test('Blocks rotate without mutating the board and clear completed lines',()=>{
 let s=newBlocks(()=>0);const before=JSON.stringify(s.board);const rotated=moveBlocks(s,'rotate');assert.equal(JSON.stringify(rotated.board),before);assert.deepEqual(rotate([[1,1,1]]),[[1],[1],[1]]);
 const board=Array.from({length:18},()=>Array(10).fill(0));board[17]=[1,1,1,1,1,1,0,0,0,0];
 s={...s,board,piece:{shape:[[1,1,1,1]],x:6,y:16,color:1}};
 const next=moveBlocks(s,'drop',()=>0.1);assert.equal(next.lines,1);assert.equal(next.score,100);assert.ok(next.board.every(r=>r.every(c=>!c)));assert.ok(fits(next.board,next.piece));
});
