'use client';
import {useEffect,useRef,useState} from 'react';
import {newSnake,stepSnake,newBlocks,moveBlocks,type Direction} from '@/lib/game-engine';
import './games.css';
type Game='snake'|'blocks';
export default function GameRoom(){
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 const [game,setGame]=useState<Game>('snake');
 const [snake,setSnake]=useState(()=>newSnake(()=>0.5));
 const [blocks,setBlocks]=useState(()=>newBlocks(()=>0.5));
 const [playing,setPlaying]=useState(false);
 const [records,setRecords]=useState({snake:0,blocks:0});
 const [played,setPlayed]=useState({snake:false,blocks:false});
 useEffect(()=>{try{const p=JSON.parse(localStorage.getItem('connect-games-badges-v1')||'{}');setPlayed({snake:p.snake===true,blocks:p.blocks===true});}catch{}},[]);
 const markPlayed=()=>setPlayed(previous=>{const next={...previous,[game]:true};try{localStorage.setItem('connect-games-badges-v1',JSON.stringify(next));}catch{}return next;});
 const direction=useRef<Direction>('right');
 const startTouch=useRef<{x:number;y:number}|null>(null);
 const over=game==='snake'?snake.over:blocks.over;
 const score=game==='snake'?snake.score:blocks.score;
 useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem('connect-game-records-v1')||'{}');setRecords({snake:Number.isSafeInteger(stored.snake)&&stored.snake>=0?stored.snake:0,blocks:Number.isSafeInteger(stored.blocks)&&stored.blocks>=0?stored.blocks:0});}catch{}},[]);
 useEffect(()=>{if(!over)return;setPlaying(false);setRecords(previous=>{const next={...previous,[game]:Math.max(previous[game],score)};try{localStorage.setItem('connect-game-records-v1',JSON.stringify(next));}catch{}return next;});},[over,game,score]);
 useEffect(()=>{if(!playing)return;const timer=setInterval(()=>{if(game==='snake')setSnake(s=>stepSnake(s,direction.current));else setBlocks(s=>moveBlocks(s,'down'));},game==='snake'?Math.max(85,180-Math.floor(snake.score/40)*10):Math.max(150,650-blocks.lines*20));return()=>clearInterval(timer);},[playing,game,snake.score,blocks.lines]);
 useEffect(()=>{const pause=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',pause);return()=>document.removeEventListener('visibilitychange',pause);},[]);
 const command=(key:string)=>{
  if(key===' '||key==='Escape'){setPlaying(v=>!over&&!v);return;}
  if(!playing||over)return;
  if(game==='snake'){const map:Record<string,Direction>={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(map[key])direction.current=map[key];}
  else{const map:Record<string,'left'|'right'|'down'|'rotate'|'drop'>={ArrowUp:'rotate',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',Enter:'drop'};if(map[key])setBlocks(s=>moveBlocks(s,map[key]));}
 };
 const commandRef=useRef(command);commandRef.current=command;
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Escape','Enter'].includes(e.key)&&(!([' ','Enter'].includes(e.key))||!(e.target instanceof HTMLButtonElement))){e.preventDefault();commandRef.current(e.key);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const restart=()=>{markPlayed();direction.current='right';if(game==='snake')setSnake(newSnake());else setBlocks(newBlocks());setPlaying(true);};
 const cells=game==='snake'?Array.from({length:18},(_,y)=>Array.from({length:18},(_,x)=>snake.body.some(c=>c.x===x&&c.y===y)?2:snake.food?.x===x&&snake.food?.y===y?1:0)):blocks.board.map(r=>[...r]);
 if(game==='blocks')blocks.piece.shape.forEach((row,y)=>row.forEach((value,x)=>{if(value&&cells[blocks.piece.y+y])cells[blocks.piece.y+y][blocks.piece.x+x]=blocks.piece.color;}));
 return <main className="game-room"><div className="game-shell"><a className="game-back" href="/connect/novogen/app">← Volver a FLASH</a><p className="game-eyebrow">NOVOGEN CONNECT</p><h1>Tu pausa para jugar</h1><p>Elige un clásico y supera tu récord.</p><div className="game-tabs" role="group" aria-label="Elegir juego">{(['snake','blocks'] as Game[]).map(id=><button key={id} disabled={!mounted} aria-pressed={game===id} onClick={()=>{setPlaying(false);setGame(id);}}>{id==='snake'?'Snake':'Bloques'}</button>)}</div><div className="game-score"><span>Puntaje <strong>{score}</strong></span><span>Tu récord <strong>{records[game]}</strong></span></div><div className="game-board-wrap"><div className={'game-board '+game} role="img" aria-label={game==='snake'?'Tablero de Snake':'Tablero de Bloques'} style={{gridTemplateColumns:`repeat(${game==='snake'?18:10},1fr)`}} onTouchStart={e=>{startTouch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{if(!startTouch.current)return;const dx=e.changedTouches[0].clientX-startTouch.current.x,dy=e.changedTouches[0].clientY-startTouch.current.y;if(Math.max(Math.abs(dx),Math.abs(dy))>16)command(Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp');startTouch.current=null;}}>{cells.flatMap((row,y)=>row.map((value,x)=><span key={`${x}-${y}`} className={'game-cell color-'+value}/>))}</div>{(!playing||over)&&<div className="game-overlay"><strong>{over?'¡Buen intento!':'¿Jugamos?'}</strong><span>{over?`Puntaje final: ${score}`:'Toca iniciar o continuar'}</span></div>}</div><div className="game-actions"><button disabled={!mounted} onClick={over?restart:()=>{if(!playing)markPlayed();setPlaying(v=>!v);}}>{over?'Volver a jugar':playing?'Pausar':'Continuar'}</button><button disabled={!mounted} onClick={restart}>Nueva partida</button></div><div className="game-pad" aria-label="Controles del juego"><button disabled={!mounted||!playing} aria-label={game==='snake'?'Subir':'Girar pieza'} onClick={()=>command('ArrowUp')}>{game==='snake'?'↑':'↻'}</button><div><button aria-label="Izquierda" onClick={()=>command('ArrowLeft')}>←</button><button aria-label="Bajar" onClick={()=>command('ArrowDown')}>↓</button><button aria-label="Derecha" onClick={()=>command('ArrowRight')}>→</button></div>{game==='blocks'&&<button disabled={!mounted||!playing} onClick={()=>command('Enter')}>Dejar caer</button>}</div><p className="game-help">{game==='snake'?'Recoge los puntos y evita chocar. Usa las flechas o desliza sobre el tablero.':'Gira y acomoda las piezas. Completa filas para sumar puntaje.'}</p><section className="game-progress"><h2>Mis récords</h2><p>Snake: {records.snake} · Bloques: {records.blocks}</p><p>Se guardan en este teléfono.</p><h2>Mis insignias</h2><ul className="game-badges">{(played.snake||played.blocks)&&<li>Primera partida</li>}{played.snake&&played.blocks&&<li>Explorador de clásicos</li>}{records.snake>=50&&<li>Serpiente ágil</li>}{records.blocks>=100&&<li>Primeras filas</li>}</ul>{!played.snake&&!played.blocks&&<p>Inicia una partida para obtener tu primera insignia.</p>}<h2>NovoPoint</h2><p>Los puntos canjeables estarán disponibles cuando se active el programa.</p></section></div></main>;
}

