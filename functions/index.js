const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const REGION = "us-central1";
const MAX_SEATS = 4;
const DEFAULT_STACK = 1000;

function fail(code, message) { throw new HttpsError(code, message); }
function uidOf(req) {
  if (!req.auth || !req.auth.uid) fail("unauthenticated", "Iniciá sesión para jugar al Póker.");
  return req.auth.uid;
}
function cleanName(value) {
  const name = String(value || "Jugador").replace(/[<>]/g, "").trim().slice(0, 16);
  return name || "Jugador";
}
function validCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) fail("invalid-argument", "Código de sala inválido.");
  return code;
}
function roomRef(appId, code) {
  if (typeof appId !== "string" || !/^[a-zA-Z0-9_-]{2,80}$/.test(appId)) fail("invalid-argument", "Identificador de aplicación inválido.");
  return db.doc(`artifacts/${appId}/public/data/uno_rooms/${code}`);
}
function handRef(appId, code, uid) {
  return db.doc(`artifacts/${appId}/public/data/uno_poker_private/${code}/hands/${uid}`);
}
function profileRef(appId, uid) { return db.doc(`artifacts/${appId}/users/${uid}`); }
function getBalance(profile) {
  const n = Number(profile && profile.pokerChips);
  return Number.isSafeInteger(n) && n >= 0 ? n : DEFAULT_STACK;
}
function shuffledDeck() {
  const suits = [{suit:"hearts",symbol:"♥",color:"red"},{suit:"diamonds",symbol:"♦",color:"red"},{suit:"clubs",symbol:"♣",color:"black"},{suit:"spades",symbol:"♠",color:"black"}];
  const faces = {11:"J",12:"Q",13:"K",14:"A"};
  const deck = [];
  for (const s of suits) for (let v=2; v<=14; v++) deck.push({id:crypto.randomUUID(),suit:s.suit,symbol:s.symbol,color:s.color,v,value:faces[v]||String(v)});
  for (let i=deck.length-1;i>0;i--) { const j=crypto.randomInt(i+1); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  return deck;
}
function combinations(items, k) {
  if (k===0) return [[]];
  if (items.length<k) return [];
  const [head,...tail]=items;
  return combinations(tail,k-1).map(x=>[head,...x]).concat(combinations(tail,k));
}
function evaluateFive(cards) {
  const vals=cards.map(c=>c.v).sort((a,b)=>b-a), counts={};
  vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const groups=Object.entries(counts).map(([v,n])=>({v:Number(v),n})).sort((a,b)=>b.n-a.n||b.v-a.v);
  const flush=cards.every(c=>c.suit===cards[0].suit), uniq=[...new Set(vals)];
  let straight=0;
  if(uniq.length===5){if(uniq[0]-uniq[4]===4)straight=uniq[0];else if(uniq.join(",")==="14,5,4,3,2")straight=5;}
  if(groups[0].n===5)return [9,groups[0].v];
  if(flush&&straight)return [8,straight];
  if(groups[0].n===4)return [7,groups[0].v,groups[1].v];
  if(groups[0].n===3&&groups[1].n===2)return [6,groups[0].v,groups[1].v];
  if(flush)return [5,...vals]; if(straight)return [4,straight];
  if(groups[0].n===3)return [3,groups[0].v,...groups.slice(1).map(g=>g.v)];
  if(groups[0].n===2&&groups[1].n===2)return [2,Math.max(groups[0].v,groups[1].v),Math.min(groups[0].v,groups[1].v),groups[2].v];
  if(groups[0].n===2)return [1,groups[0].v,...groups.slice(1).map(g=>g.v)];
  return [0,...vals];
}
function compareScore(a,b) {
  for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}
  return 0;
}
function bestHand(cards) {
  let best=null;
  for(const combo of combinations(cards,5)){const score=evaluateFive(combo);if(!best||compareScore(score,best.score)>0)best={score,cards:combo};}
  return best;
}
const rankNames=["Carta alta","Pareja","Doble pareja","Trío","Escalera","Color","Full house","Póker","Escalera de color"];
function publicPlayer(p) {
  const out={id:p.id,name:p.name,avatar:p.avatar||"🙂",seatIndex:p.seatIndex,stack:p.stack,folded:!!p.folded,bet:p.bet||0,acted:!!p.acted,allIn:p.stack===0,totalBet:p.totalBet||0};
  if (Array.isArray(p.hand)) out.hand=p.hand;
  return out;
}
function nextActor(players, from) {
  for(let n=1;n<=players.length;n++){const i=(from+n)%players.length,p=players[i];if(!p.folded&&p.stack>0&&!p.acted)return i;}
  return -1;
}
function activeIndexes(players) { return players.map((p,i)=>p.folded?-1:i).filter(i=>i>=0); }
function awardUncontested(g, winnerIndex) {
  g.players[winnerIndex].stack += g.pot;
  g.winners=[winnerIndex];g.message=`🏆 ${g.players[winnerIndex].name} ganó porque todos se retiraron.`;
  g.pot=0;g.over=true;g.stage=4;
}
function settleShowdown(g, hands) {
  const eligible=activeIndexes(g.players);
  const levels=[...new Set(g.players.map(p=>p.totalBet||0).filter(n=>n>0))].sort((a,b)=>a-b);
  let previous=0;
  for(const level of levels){
    const contributors=g.players.filter(p=>(p.totalBet||0)>=level);
    const tranche=(level-previous)*contributors.length;
    const contenders=eligible.filter(i=>(g.players[i].totalBet||0)>=level);
    if(tranche>0&&contenders.length){
      const scored=contenders.map(i=>({i,best:bestHand([...hands[i],...g.community])}));
      scored.sort((a,b)=>compareScore(b.best.score,a.best.score));
      const top=scored[0].best.score,winners=scored.filter(x=>compareScore(x.best.score,top)===0).map(x=>x.i);
      const share=Math.floor(tranche/winners.length),rem=tranche-share*winners.length;
      winners.forEach((i,k)=>g.players[i].stack+=share+(k===0?rem:0));
      winners.forEach(i=>{if(!g.winners.includes(i))g.winners.push(i);});
      if(!g.message)g.message=`🏆 ${winners.map(i=>g.players[i].name).join(", ")} ganó con ${rankNames[top[0]]}.`;
    }
    previous=level;
  }
  g.pot=0;g.over=true;g.stage=4;
  const ranked=eligible.map(i=>({i,best:bestHand([...hands[i],...g.community])})).sort((a,b)=>compareScore(b.best.score,a.best.score));
  const top=ranked[0]?.best.score;
  const winners=ranked.filter(x=>top&&compareScore(x.best.score,top)===0).map(x=>x.i);
  g.winners=winners;
  g.message=`🏆 ${winners.map(i=>g.players[i].name).join(", ")} ganó${winners.length>1?" (empate)":""} con ${rankNames[top?.[0]||0]}.`;
  g.players.forEach((p,i)=>{p.hand=hands[i];});
}
async function creditStacks(tx, appId, g) {
  const refs=g.players.map(p=>profileRef(appId,p.id));
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  snaps.forEach((snap,i)=>{
    const p=g.players[i],profile=snap.exists?snap.data():{},balance=getBalance(profile)+Math.max(0,Math.floor(p.stack||0));
    const localStorage={...(profile.localStorage||{}),uno_pok_chips:String(balance)};
    tx.set(ref,{uid:p.id,pokerChips:balance,localStorage,updatedAt:Date.now()},{merge:true});
  });
  g.players.forEach(p=>{p.paidOut=true;});
}
async function finishGame(tx, appId, room, g, hands) {
  if(g.over)return;
  if(hands) settleShowdown(g,hands);
  g.players.forEach((p,i)=>{if(hands&&hands[i])p.hand=hands[i];});
  await creditStacks(tx,appId,g);
  room.status="finished";room.arcadeState=g;room.pokerPaidOutUids=g.players.map(p=>p.id);room.updatedAt=Date.now();
}
function progressRound(g, deck) {
  const alive=activeIndexes(g.players);
  if(alive.length===1){awardUncontested(g,alive[0]);return "uncontested";}
  const canStillAct=alive.filter(i=>g.players[i].stack>0);
  const allMatched=canStillAct.every(i=>g.players[i].acted&&g.players[i].bet===g.currentBet);
  if(!allMatched)return "continue";
  g.players.forEach(p=>{p.bet=0;p.acted=false;});
  g.currentBet=0;
  if(g.stage===0){g.community.push(deck.pop(),deck.pop(),deck.pop());g.stage=1;g.message="Flop · nueva ronda de apuestas.";}
  else if(g.stage===1){g.community.push(deck.pop());g.stage=2;g.message="Turn · nueva ronda de apuestas.";}
  else if(g.stage===2){g.community.push(deck.pop());g.stage=3;g.message="River · última ronda de apuestas.";}
  else return "showdown";
  return "next";
}

exports.createPokerRoom = onCall({region:REGION, maxInstances:30}, async req => {
  const uid=uidOf(req), appId=req.data?.appId, stake=Math.floor(Number(req.data?.stake||100));
  if(!Number.isSafeInteger(stake)||stake<5||stake>50000)fail("invalid-argument","La entrada debe estar entre 5 y 50.000 fichas.");
  const profile=profileRef(appId,uid), profileSnap=await profile.get(), data=profileSnap.exists?profileSnap.data():{};
  const balance=getBalance(data); if(balance<stake)fail("failed-precondition","POKER_CHIPS_LOW");
  let balanceAfter=balance-stake;
  let code, ref;
  for(let tries=0;tries<8;tries++){code=crypto.randomBytes(3).toString("hex").toUpperCase();ref=roomRef(appId,code);if(!(await ref.get()).exists)break;ref=null;}
  if(!ref)fail("resource-exhausted","No se pudo generar un código. Intentá otra vez.");
  const next=balance-stake,localStorage={...(data.localStorage||{}),uno_pok_chips:String(next)};
  const player={id:uid,name:cleanName(req.data?.name),avatar:String(req.data?.avatar||"🙂").slice(0,8),seatIndex:0};
  const seats=[player,{id:null,name:"Asiento 2",avatar:"💺",seatIndex:1},{id:null,name:"Asiento 3",avatar:"💺",seatIndex:2},{id:null,name:"Asiento 4",avatar:"💺",seatIndex:3}];
  await db.runTransaction(async tx=>{
    const fresh=await tx.get(profile);const current=fresh.exists?fresh.data():{};const currentBalance=getBalance(current);
    if(currentBalance<stake)fail("failed-precondition","POKER_CHIPS_LOW");
    balanceAfter=currentBalance-stake;
    tx.set(profile,{uid,pokerChips:balanceAfter,localStorage:{...(current.localStorage||{}),uno_pok_chips:String(balanceAfter)},updatedAt:Date.now()},{merge:true});
    tx.create(ref,{code,arcadeRoom:true,arcadeMode:"poker",hostId:uid,isPublic:false,status:"lobby",maxSeats:MAX_SEATS,seats,memberUids:[uid],pokerStake:stake,pokerCurrency:"chips",createdAt:Date.now(),updatedAt:Date.now()});
  });
  return {code,balance:balanceAfter};
});

exports.joinPokerRoom = onCall({region:REGION,maxInstances:30}, async req=>{
  const uid=uidOf(req),appId=req.data?.appId,code=validCode(req.data?.code),ref=roomRef(appId,code),profile=profileRef(appId,uid);
  const name=cleanName(req.data?.name),avatar=String(req.data?.avatar||"🙂").slice(0,8);
  let balanceAfter=null;
  await db.runTransaction(async tx=>{
    const roomSnap=await tx.get(ref);if(!roomSnap.exists)fail("not-found","No existe esa sala.");
    const room=roomSnap.data();if(room.arcadeMode!=="poker"||!room.arcadeRoom)fail("failed-precondition","Ese código no pertenece a una mesa de Póker.");
    if(room.status!=="lobby")fail("failed-precondition","La partida ya comenzó.");
    const seats=room.seats||[];if(seats.some(s=>s.id===uid))return;
    const seat=seats.findIndex(s=>!s.id);if(seat<0)fail("resource-exhausted","La mesa está completa.");
    const pSnap=await tx.get(profile),pData=pSnap.exists?pSnap.data():{},balance=getBalance(pData),stake=Math.floor(Number(room.pokerStake||0));
    if(balance<stake)fail("failed-precondition","POKER_CHIPS_LOW");
    balanceAfter=balance-stake;
    seats[seat]={id:uid,name,avatar,seatIndex:seat};
    tx.set(profile,{uid,pokerChips:balanceAfter,localStorage:{...(pData.localStorage||{}),uno_pok_chips:String(balanceAfter)},updatedAt:Date.now()},{merge:true});
    tx.update(ref,{seats,memberUids:[...new Set([...(room.memberUids||[]),uid])],updatedAt:Date.now()});
  });
  return {code,balance:balanceAfter};
});

exports.startPokerHand = onCall({region:REGION,maxInstances:30}, async req=>{
  const uid=uidOf(req),appId=req.data?.appId,code=validCode(req.data?.code),ref=roomRef(appId,code);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)fail("not-found","La sala ya no existe.");
    const room=snap.data();if(room.arcadeMode!=="poker"||room.hostId!==uid)fail("permission-denied","Solo el anfitrión puede iniciar.");
    if(room.status!=="lobby")fail("failed-precondition","La sala ya comenzó.");
    const seats=(room.seats||[]).filter(s=>s.id);if(seats.length<2||seats.length>MAX_SEATS)fail("failed-precondition","Se necesitan entre 2 y 4 jugadores.");
    const buyIn=Math.floor(Number(room.pokerStake||100)),deck=shuffledDeck();
    const players=seats.map(s=>({id:s.id,name:cleanName(s.name),avatar:s.avatar||"🙂",seatIndex:s.seatIndex,stack:buyIn,bet:0,totalBet:0,folded:false,acted:false,allIn:false}));
    const hands=players.map(()=>[deck.pop(),deck.pop()]);
    const privateStateRef=db.doc(`artifacts/${appId}/public/data/uno_poker_private/${code}/server/state`);
    const small=Math.min(1,buyIn),big=Math.min(2,buyIn);
    players[0].stack-=small;players[0].bet=small;players[0].totalBet=small;
    players[1].stack-=big;players[1].bet=big;players[1].totalBet=big;
    const g={players,community:[],pot:small+big,currentBet:big,stage:0,turn:players.length>2?2:0,over:false,buyIn,winners:[],message:"Preflop: igualá, subí o retirate."};
    tx.create(privateStateRef,{deck,updatedAt:Date.now()});
    for(let i=0;i<players.length;i++)tx.create(handRef(appId,code,players[i].id),{uid:players[i].id,cards:hands[i],updatedAt:Date.now()});
    tx.update(ref,{status:"playing",arcadeState:g,updatedAt:Date.now()});
  });
  return {ok:true};
});

exports.actPoker = onCall({region:REGION,maxInstances:50}, async req=>{
  const uid=uidOf(req),appId=req.data?.appId,code=validCode(req.data?.code),action=String(req.data?.action||""),ref=roomRef(appId,code);
  if(!["fold","call","raise"].includes(action))fail("invalid-argument","Acción de Póker inválida.");
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)fail("not-found","La sala ya no existe.");
    const room=snap.data(),g=room.arcadeState;
    if(room.arcadeMode!=="poker"||room.status!=="playing"||!g||g.over)fail("failed-precondition","La partida no está activa.");
    const privateStateRef=db.doc(`artifacts/${appId}/public/data/uno_poker_private/${code}/server/state`);
    const privateStateSnap=await tx.get(privateStateRef);if(!privateStateSnap.exists)fail("failed-precondition","No se encontró el mazo privado de esta mano.");
    const deck=privateStateSnap.data().deck||[];
    const i=g.players.findIndex(p=>p.id===uid);if(i<0||g.turn!==i)fail("permission-denied","No es tu turno.");
    const p=g.players[i],due=Math.max(0,g.currentBet-p.bet),raiseBy=Math.max(1,Math.ceil((g.buyIn||100)/10));
    if(p.folded||p.stack<=0)fail("failed-precondition","No podés jugar en este turno.");
    if(action==="fold"){p.folded=true;p.acted=true;}
    else if(action==="call"){
      const pay=Math.min(due,p.stack);p.stack-=pay;p.bet+=pay;p.totalBet+=pay;g.pot+=pay;p.acted=true;
      if(p.stack===0)p.allIn=true;
    } else {
      const pay=due+raiseBy;if(pay>p.stack)fail("failed-precondition","No tenés fichas suficientes para subir.");
      p.stack-=pay;p.bet+=pay;p.totalBet+=pay;g.pot+=pay;g.currentBet=p.bet;p.acted=true;
      g.players.forEach((x,j)=>{if(j!==i&&!x.folded&&x.stack>0)x.acted=false;});
      if(p.stack===0)p.allIn=true;
    }
    const alive=activeIndexes(g.players);
    if(alive.length===1){awardUncontested(g,alive[0]);}
    else {
      const next=nextActor(g.players,i);
      const canAct=alive.filter(j=>g.players[j].stack>0);
      const roundDone=canAct.every(j=>g.players[j].acted&&g.players[j].bet===g.currentBet);
      if(roundDone){
        const result=progressRound(g,deck);
        if(result==="showdown"){
          const handSnaps=await Promise.all(g.players.map(pl=>tx.get(handRef(appId,code,pl.id))));
          const hands=handSnaps.map(h=>h.exists?h.data().cards:[]);
          if(hands.some(h=>h.length!==2))fail("internal","No se pudieron recuperar todas las manos.");
          settleShowdown(g,hands);
        } else if(result==="next"&&g.players.filter(pl=>!pl.folded&&pl.stack>0).length<=1){
          while(g.stage<3){if(g.stage===0)g.community.push(deck.pop(),deck.pop(),deck.pop());else g.community.push(deck.pop());g.stage++;}
          const handSnaps=await Promise.all(g.players.map(pl=>tx.get(handRef(appId,code,pl.id))));
          const hands=handSnaps.map(h=>h.exists?h.data().cards:[]);
          settleShowdown(g,hands);
        } else if(result==="uncontested"){}
        else {g.turn=nextActor(g.players,i);if(g.turn<0)g.turn=alive[0];}
      } else {g.turn=next>=0?next:alive[0];}
    }
    room.arcadeState=g;room.updatedAt=Date.now();
    if(g.over){
      const handSnaps=await Promise.all(g.players.map(pl=>tx.get(handRef(appId,code,pl.id))));
      const hands=handSnaps.map(h=>h.exists?h.data().cards:[]);
      g.players.forEach((pl,j)=>{if(hands[j]?.length===2)pl.hand=hands[j];});
      await creditStacks(tx,appId,g);
      room.status="finished";room.pokerPaidOutUids=g.players.map(pl=>pl.id);tx.delete(privateStateRef);
    } else {tx.set(privateStateRef,{deck,updatedAt:Date.now()});}
    tx.update(ref,{status:room.status,arcadeState:g,pokerPaidOutUids:room.pokerPaidOutUids||[],updatedAt:Date.now()});
  });
  return {ok:true};
});

exports.leavePokerRoom = onCall({region:REGION,maxInstances:30}, async req=>{
  const uid=uidOf(req),appId=req.data?.appId,code=validCode(req.data?.code),ref=roomRef(appId,code),profile=profileRef(appId,uid);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)return;
    const room=snap.data();if(room.arcadeMode!=="poker")return;
    const index=(room.seats||[]).findIndex(s=>s.id===uid);if(index<0)return;
    if(room.status==="lobby"){
      const pSnap=await tx.get(profile),pData=pSnap.exists?pSnap.data():{},balance=getBalance(pData)+Math.floor(Number(room.pokerStake||0));
      const seats=room.seats.slice();seats[index]={id:null,name:"Asiento "+(index+1),avatar:"💺",seatIndex:index};
      tx.set(profile,{uid,pokerChips:balance,localStorage:{...(pData.localStorage||{}),uno_pok_chips:String(balance)},updatedAt:Date.now()},{merge:true});
      const remaining=seats.filter(seat=>seat.id);
      if(room.hostId===uid&&!remaining.length){tx.delete(ref);}
      else {const nextHost=room.hostId===uid?remaining[0].id:room.hostId;tx.update(ref,{seats,hostId:nextHost,memberUids:(room.memberUids||[]).filter(x=>x!==uid),updatedAt:Date.now()});}
    } else if(room.status==="playing"&&room.arcadeState&&!room.arcadeState.over){
      const g=room.arcadeState,i=g.players.findIndex(p=>p.id===uid);
      if(i>=0&&!g.players[i].folded){
        g.players[i].folded=true;
        const alive=activeIndexes(g.players);
        if(alive.length===1){
          awardUncontested(g,alive[0]);
          const snaps=await Promise.all(g.players.map(p=>tx.get(profileRef(appId,p.id))));
          snaps.forEach((ps,j)=>{const data=ps.exists?ps.data():{},balance=getBalance(data)+Math.max(0,Math.floor(g.players[j].stack||0));tx.set(profileRef(appId,g.players[j].id),{uid:g.players[j].id,pokerChips:balance,localStorage:{...(data.localStorage||{}),uno_pok_chips:String(balance)},updatedAt:Date.now()},{merge:true});g.players[j].stack=0;});
          g.players.forEach(p=>p.paidOut=true);room.status="finished";room.pokerPaidOutUids=g.players.map(p=>p.id);tx.delete(db.doc(`artifacts/${appId}/public/data/uno_poker_private/${code}/server/state`));
        } else if(g.turn===i)g.turn=nextActor(g.players,i);
        room.arcadeState=g;tx.update(ref,{status:room.status,arcadeState:g,pokerPaidOutUids:room.pokerPaidOutUids||[],updatedAt:Date.now()});
      }
    }
  });
  return {ok:true};
});
