export type Cell={x:number;y:number};
export type Direction='up'|'down'|'left'|'right';
export type SnakeState={body:Cell[];food:Cell|null;direction:Direction;score:number;over:boolean};
export const vectors:Record<Direction,Cell>={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
export function placeFood(body:Cell[],size=18,random=Math.random):Cell|null{
 const free:Cell[]=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!body.some(c=>c.x===x&&c.y===y))free.push({x,y});
 return free.length?free[Math.min(free.length-1,Math.floor(random()*free.length))]:null;
}
export function newSnake(random=Math.random):SnakeState{const body=[{x:8,y:9},{x:7,y:9},{x:6,y:9}];return {body,food:placeFood(body,18,random),direction:'right',score:0,over:false};}
export function stepSnake(state:SnakeState,wanted:Direction,size=18,random=Math.random):SnakeState{
 if(state.over)return state;
 const previous=vectors[state.direction],next=vectors[wanted];
 const direction=previous.x+next.x===0&&previous.y+next.y===0?state.direction:wanted;
 const v=vectors[direction],head={x:state.body[0].x+v.x,y:state.body[0].y+v.y};
 const eating=state.food?.x===head.x&&state.food?.y===head.y;
 const collision=state.body.slice(0,eating?undefined:-1).some(c=>c.x===head.x&&c.y===head.y);
 if(head.x<0||head.y<0||head.x>=size||head.y>=size||collision)return {...state,direction,over:true};
 const body=[head,...state.body];if(!eating)body.pop();
 const food=eating?placeFood(body,size,random):state.food;
 return {body,food,direction,score:state.score+(eating?10:0),over:food===null};
}
export const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
export type Piece={shape:number[][];x:number;y:number;color:number};
export type BlocksState={board:number[][];piece:Piece;score:number;lines:number;over:boolean};
export function newPiece(random=Math.random):Piece{const color=Math.min(6,Math.floor(random()*7))+1;const shape=shapes[color-1].map(r=>[...r]);return {shape,x:Math.floor((10-shape[0].length)/2),y:0,color};}
export function newBlocks(random=Math.random):BlocksState{return {board:Array.from({length:18},()=>Array(10).fill(0)),piece:newPiece(random),score:0,lines:0,over:false};}
export function fits(board:number[][],piece:Piece){return piece.shape.every((row,y)=>row.every((v,x)=>!v||(piece.x+x>=0&&piece.x+x<10&&piece.y+y>=0&&piece.y+y<18&&!board[piece.y+y][piece.x+x])));}
export function rotate(shape:number[][]){return shape[0].map((_,x)=>shape.map(row=>row[x]).reverse());}
export function moveBlocks(state:BlocksState,action:'left'|'right'|'down'|'rotate'|'drop',random=Math.random):BlocksState{
 if(state.over)return state;
 let piece={...state.piece};
 if(action==='rotate'){
  const shape=rotate(piece.shape);
  for(const shift of [0,-1,1,-2,2]){const test={...piece,shape,x:piece.x+shift};if(fits(state.board,test))return {...state,piece:test};}
  return state;
 }
 if(action==='left'||action==='right'){piece.x+=action==='left'?-1:1;return fits(state.board,piece)?{...state,piece}:state;}
 if(action==='drop'){while(fits(state.board,{...piece,y:piece.y+1}))piece.y++;}
 else if(fits(state.board,{...piece,y:piece.y+1}))return {...state,piece:{...piece,y:piece.y+1}};
 const board=state.board.map(r=>[...r]);piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v)board[piece.y+y][piece.x+x]=piece.color;}));
 const remaining=board.filter(row=>row.some(v=>!v));const cleared=18-remaining.length;
 while(remaining.length<18)remaining.unshift(Array(10).fill(0));
 const following=newPiece(random);
 return {board:remaining,piece:following,score:state.score+[0,100,300,500,800][cleared],lines:state.lines+cleared,over:!fits(remaining,following)};
}

