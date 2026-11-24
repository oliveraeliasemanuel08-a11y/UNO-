/* UNO! CLUB — UNO Mentiroso 3D Online Adapter. Motor 3D original intacto. */
(() => {
  const V = '11.6.1';
  const CONFIG = { apiKey:'AIzaSyDGphhSEypZrGrqm8pj9wykEQ2wiv7RgUo', authDomain:'uno-club-dc29c.firebaseapp.com', projectId:'uno-club-dc29c', storageBucket:'uno-club-dc29c.firebasestorage.app', messagingSenderId:'375402756368', appId:'1:375402756368:web:ca9082992d6c317a0e8d95' };
  const APP = 'uno-club-official';
  const $ = id => document.getElementById(id);
  const S = { app:null,auth:null,db:null,sdk:null,uid:null,name:'Jugador',roomId:null,roomRef:null,isHost:false,online:false,members:[],privateHand:[],unsubs:[],processed:new Set(),original:{},publishing:false,lastSnapshot:null,hooks:false,privateSub:false,actionPending:false };
  const root = () => 'artifacts/' + APP + '/public/data';
  const paths = () => ({ room:root()+'/uno_rooms/'+S.roomId, members:root()+'/uno_liar_private/'+S.roomId+'/members', hands:root()+'/uno_liar_private/'+S.roomId+'/hands', actions:root()+'/uno_liar_actions/'+S.roomId+'/actions' });
  function status(msg,err){ const e=$('liar-online-status'); if(e){e.textContent=msg;e.className='mt-2 text-xs font-semibold '+(err?'text-rose-300':'text-emerald-300');} const l=$('liar-lobby-status');if(l)l.textContent=msg; }
  function showLobby(v){$('liar-online-lobby')?.classList.toggle('hidden',!v);}
  async function loadFirebase(){
    if(S.db && S.auth?.currentUser)return;
    const [a,u,f]=await Promise.all([import('https://www.gstatic.com/firebasejs/'+V+'/firebase-app.js'),import('https://www.gstatic.com/firebasejs/'+V+'/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/'+V+'/firebase-firestore.js')]);
    S.sdk=f; S.app=a.getApps().find(x=>x.name==='[DEFAULT]')||a.initializeApp(CONFIG); S.auth=u.getAuth(S.app); S.db=f.getFirestore(S.app);
    await S.auth.authStateReady(); if(!S.auth.currentUser)await u.signInAnonymously(S.auth); S.uid=S.auth.currentUser.uid;
  }
  function clearSession(){S.unsubs.forEach(fn=>{try{fn();}catch(e){}});S.unsubs=[];S.processed.clear();S.privateSub=false;S.privateHand=[];S.members=[];S.lastSnapshot=null;S.actionPending=false;S.online=false;S.isHost=false;S.roomId=null;S.roomRef=null;}
  function code6(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;}
  function profile(){return {uid:S.uid,name:S.name.slice(0,16)||'Jugador',avatar:'😎',joinedAt:Date.now()};}
  async function createRoom(){
    try{clearSession();await loadFirebase();S.name=($('liar-online-name')?.value||'Jugador').trim().slice(0,16)||'Jugador';let code=code6();let ref=S.sdk.doc(S.db,root()+'/uno_rooms/'+code);
      for(let i=0;i<5&&(await S.sdk.getDoc(ref)).exists();i++){code=code6();ref=S.sdk.doc(S.db,root()+'/uno_rooms/'+code);}
      S.roomId=code;S.roomRef=ref;S.isHost=true;S.online=true;S.members=[profile()];
      await S.sdk.setDoc(ref,{code:code,gameType:'liar3d',hostId:S.uid,hostName:S.name,memberUids:[S.uid],members:S.members,status:'waiting',maxPlayers:6,createdAt:S.sdk.serverTimestamp(),updatedAt:Date.now()});
      await S.sdk.setDoc(S.sdk.doc(S.db,paths().members+'/'+S.uid),profile());
      $('liar-room-code').textContent=code;$('liar-host-start').classList.remove('hidden');$('liar-host-start').disabled=true;$('liar-host-start').textContent='ESPERANDO JUGADORES…';$('setup-modal').classList.add('hidden');showLobby(true);status('Sala creada. Comparte el código con tus amigos.');subscribeRoom();subscribeMembers();
    }catch(e){console.error('[UNO Mentiroso] crear sala',e);status(e.message||'No se pudo crear la sala.',true);}
  }
  async function joinRoom(){
    try{clearSession();await loadFirebase();S.name=($('liar-online-name')?.value||'Jugador').trim().slice(0,16)||'Jugador';const code=($('liar-join-code')?.value||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))throw Error('Escribe un código válido de 6 caracteres.');
      S.roomId=code;S.roomRef=S.sdk.doc(S.db,root()+'/uno_rooms/'+code);const snap=await S.sdk.getDoc(S.roomRef);if(!snap.exists())throw Error('No existe una sala con ese código.');const room=snap.data();
      const alreadyMember=(room.memberUids||[]).includes(S.uid);if(room.gameType!=='liar3d'||(room.status!=='waiting'&&!(alreadyMember&&['playing','finished'].includes(room.status))))throw Error('La partida ya comenzó o la sala no es válida.');if(room.status!=='waiting'&&room.hostId===S.uid)throw Error('El anfitrión debe mantener abierta su pestaña original durante la partida.');
      if(!alreadyMember){
        if(room.status!=='waiting')throw Error('No puedes entrar a una partida que ya comenzó.');
        if((room.memberUids||[]).length>=Math.min(6,room.maxPlayers||6))throw Error('La sala está completa.');
        const memberRef=S.sdk.doc(S.db,paths().members+'/'+S.uid);
        await S.sdk.setDoc(memberRef,profile());
        try{
          await S.sdk.runTransaction(S.db,async tx=>{
            const fresh=await tx.get(S.roomRef);
            if(!fresh.exists())throw Error('La sala ya no existe.');
            const current=fresh.data(),uids=current.memberUids||[];
            if(current.status!=='waiting')throw Error('La partida ya comenzó.');
            if(uids.includes(S.uid))return;
            if(uids.length>=Math.min(6,current.maxPlayers||6))throw Error('La sala se llenó justo antes de entrar.');
            tx.update(S.roomRef,{memberUids:[...uids,S.uid],updatedAt:Date.now()});
          });
        }catch(joinError){
          try{await S.sdk.deleteDoc(memberRef);}catch(cleanError){console.warn('Limpiar intento de ingreso',cleanError);}
          throw joinError;
        }
      }
      S.isHost=room.hostId===S.uid;S.online=true;$('liar-room-code').textContent=code;$('liar-host-start').classList.toggle('hidden',!S.isHost);$('setup-modal').classList.add('hidden');showLobby(true);status('Conectado. Esperando que el anfitrión inicie la partida.');subscribeRoom();if(S.isHost)subscribeMembers();
    }catch(e){console.error('[UNO Mentiroso] unirse',e);status(e.message||'No se pudo entrar a la sala.',true);}
  }
  function subscribeRoom(){S.unsubs.push(S.sdk.onSnapshot(S.roomRef,snap=>{if(!snap.exists()){status('La sala ya no existe.',true);return;}const room=snap.data();S.lastSnapshot=room;if(room.members)renderMembers(room.members);if(S.isHost&&room.status==='waiting')S.sdk.getDocs(S.sdk.collection(S.db,paths().members)).then(syncLobbyMembers).catch(e=>console.warn('Actualizar lobby',e));if((room.status==='playing'||room.status==='finished')&&room.gameState&&!S.isHost){showLobby(false);if(!S.privateSub)subscribePrivateHand();applyGameState(room.gameState);if(room.status==='finished')status('Partida finalizada. ¡Gracias por jugar!');}else if(room.status==='closed'){status('El anfitrión cerró la sala.',true);showLobby(false);if(!S.isHost)S.sdk.deleteDoc(S.sdk.doc(S.db,paths().members+'/'+S.uid)).catch(()=>{});}},e=>status(e.message,true)));}
  function syncLobbyMembers(snap){const allowed=new Set(S.lastSnapshot?.memberUids||[]);const list=snap.docs.map(d=>d.data()).filter(m=>m.uid&&allowed.has(m.uid));S.members=[...new Map(list.map(m=>[m.uid,m])).values()].slice(0,6);renderMembers(S.members);if(S.isHost&&S.lastSnapshot?.status==='waiting'){const start=$('liar-host-start');if(start){start.disabled=S.members.length<2;start.textContent=S.members.length<2?'NECESITAS 2 JUGADORES':'INICIAR PARTIDA ('+S.members.length+')';}const current=S.lastSnapshot.members||[];if(JSON.stringify(current)!==JSON.stringify(S.members))S.sdk.updateDoc(S.roomRef,{members:S.members,updatedAt:Date.now()}).catch(e=>console.warn('Publicar miembros',e));}}
  function subscribeMembers(){const ref=S.sdk.collection(S.db,paths().members);S.unsubs.push(S.sdk.onSnapshot(ref,syncLobbyMembers,e=>status(e.message,true)));}
  function renderMembers(members){const list=$('liar-lobby-players');if(!list)return;list.innerHTML='';members.forEach((m,i)=>{const row=document.createElement('div');row.className='flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2';const av=document.createElement('span');av.className='text-xl';av.textContent=m.avatar||'😎';const nm=document.createElement('span');nm.className='min-w-0 flex-1 truncate text-sm font-bold text-white';nm.textContent=m.name||('Jugador '+(i+1));const tag=document.createElement('span');tag.className='text-[10px] font-black uppercase tracking-wider text-amber-300';tag.textContent=m.uid===S.lastSnapshot?.hostId?'ANFITRIÓN':'CONECTADO';row.append(av,nm,tag);list.appendChild(row);});$('liar-lobby-count').textContent=members.length+'/6 JUGADORES';}
  function startHostGame(){if(!S.isHost||S.members.length<2||S.members.length>6)return;const players=S.members.map(m=>({uid:m.uid,name:m.name,avatar:m.avatar||'😎',isHuman:m.uid===S.uid,style:'balanced',lives:3,hand:[],eliminated:false}));window.Liar3DBridge.startOnlineMatch(players);showLobby(false);subscribeActions();setTimeout(publishState,350);status('Partida online iniciada.');}
  function subscribeActions(){const ref=S.sdk.collection(S.db,paths().actions);S.unsubs.push(S.sdk.onSnapshot(ref,snap=>snap.docChanges().forEach(c=>{if(c.type!=='added'||S.processed.has(c.doc.id))return;S.processed.add(c.doc.id);if(S.isHost)processAction(c.doc.id,c.doc.data());}),e=>status(e.message,true)));}
  async function processAction(id,a){
    try{
      const b=window.Liar3DBridge,g=b.game;
      const p=g.players.find(x=>x.uid===a.actorUid);
      const current=g.players[g.turnIndex];
      if(!p||p.eliminated||current?.uid!==a.actorUid)throw Error('Acción fuera de turno.');
      if(a.type==='play'){
        const previous=g.lastClaim?g.players[g.lastClaim.playerIndex]:null;
        if(previous&&previous.hand.length===0)throw Error('Debes desafiar la última jugada; no puedes lanzar cartas.');
        const ids=Array.isArray(a.cardIds)?a.cardIds:[];
        if(ids.length<1||ids.length>3||ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length)throw Error('Selección de cartas inválida.');
        const ix=ids.map(x=>p.hand.findIndex(c=>c.instanceId===x));
        if(ix.some(x=>x<0)||new Set(ix).size!==ix.length)throw Error('Una o más cartas ya no están en tu mano.');
        const cards=ix.map(x=>p.hand[x]);
        [...ix].sort((x,y)=>y-x).forEach(x=>p.hand.splice(x,1));
        b.playCards(p,cards);
      }else if(a.type==='challenge'){
        if(!g.lastClaim||g.lastClaim.playerIndex===p.id)throw Error('No hay una jugada rival que puedas desafiar.');
        b.challenge(p);
      }else if(a.type==='next_round'){
        if(g.phase!=='ROUND_END')throw Error('Todavía no corresponde iniciar otra ronda.');
        b.nextRound();
      }else{
        throw Error('Tipo de acción desconocido.');
      }
    }catch(e){
      console.warn('[UNO Mentiroso] acción rechazada',e);
      status(e.message||'La acción fue rechazada.',true);
      setTimeout(publishState,120);
    }finally{
      try{await S.sdk.deleteDoc(S.sdk.doc(S.db,paths().actions+'/'+id));}
      catch(e){console.warn('Limpiar acción',e);}
    }
  }
  async function sendAction(type,extra){if(!S.online||S.isHost||S.actionPending)return false;S.actionPending=true;try{await S.sdk.addDoc(S.sdk.collection(S.db,paths().actions),Object.assign({actorUid:S.uid,type:type,createdAt:Date.now()},extra||{}));return true;}catch(e){S.actionPending=false;status(e.message||'No se pudo enviar la acción.',true);if(S.lastSnapshot?.gameState)applyGameState(S.lastSnapshot.gameState);return false;}}
  async function publishState(){if(!S.isHost||!S.online||S.publishing)return;const b=window.Liar3DBridge,g=b?.game;if(!g?.players?.length)return;S.publishing=true;try{const current=g.players[g.turnIndex],last=g.lastClaim;const gs={round:g.round,phase:g.phase,turnIndex:g.turnIndex,turnUid:current?.uid||S.uid,targetCardId:g.targetCard.id,pileCount:b.tablePileCount(),players:g.players.map(p=>({uid:p.uid,name:p.name,avatar:p.avatar,lives:p.lives,eliminated:!!p.eliminated,handCount:p.hand.length})),lastClaim:last?{playerUid:g.players[last.playerIndex]?.uid,count:last.count}:null,revealedCards:(g.phase==='RESOLVING'||g.phase==='ROUND_END'||g.phase==='GAME_OVER')&&last?last.cards.map(c=>({id:c.id,color:c.color,value:c.value,label:c.label})):null,updatedAt:Date.now()};
      await Promise.all(g.players.map(p=>S.sdk.setDoc(S.sdk.doc(S.db,paths().hands+'/'+p.uid),{uid:p.uid,cards:p.hand.map(c=>Object.assign({},c)),updatedAt:Date.now()})));await S.sdk.updateDoc(S.roomRef,{status:g.phase==='GAME_OVER'?'finished':'playing',gameState:gs,updatedAt:Date.now()});
    }catch(e){console.error('[UNO Mentiroso] sincronizar',e);status('Error sincronizando: '+e.message,true);}finally{S.publishing=false;}}
  function applyGameState(gs){if(!gs||!window.Liar3DBridge)return;S.actionPending=false;window.Liar3DBridge.applyRemoteState(gs,S.privateHand);if(gs.phase==='TURN'){const p=gs.players[gs.turnIndex];status(p?.uid===S.uid?'¡Es tu turno! Juega o desafía.':'Turno de '+(p?.name||'otro jugador')+'.');}}
  function subscribePrivateHand(){S.privateSub=true;const ref=S.sdk.doc(S.db,paths().hands+'/'+S.uid);S.unsubs.push(S.sdk.onSnapshot(ref,snap=>{if(!snap.exists())return;S.privateHand=snap.data().cards||[];if(S.lastSnapshot?.gameState)applyGameState(S.lastSnapshot.gameState);},e=>status('No se pudo cargar tu mano: '+e.message,true)));}
  function installHooks(){if(S.hooks||!window.Liar3DBridge)return;S.hooks=true;const b=window.Liar3DBridge;S.original={beginTurn:window.beginTurn,play:window.playCardsToCenter,challenge:window.resolveLiarChallenge,playHuman:window.humanPlaySelected,callHuman:window.humanCallLiar,next:window.handleNextRoundClick};
    window.beginTurn=function(){if(!S.online)return S.original.beginTurn();const g=b.game,p=g.players[g.turnIndex];if(S.isHost){const alive=g.players.filter(x=>!x.eliminated);if(alive.length<=1){b.gameOver(alive[0]);setTimeout(publishState,2200);return;}if(p?.eliminated){g.turnIndex=(g.turnIndex+1)%g.players.length;window.beginTurn();setTimeout(publishState,120);return;}const withCards=alive.filter(x=>x.hand.length>0);if(withCards.length===0&&g.lastClaim){window.resolveLiarChallenge(p);return;}if(p&&p.hand.length===0){g.turnIndex=(g.turnIndex+1)%g.players.length;window.beginTurn();setTimeout(publishState,120);return;}if(p?.uid!==S.uid){g.phase='TURN';window.updateAllSeatsUI?.();window.setCameraView?.('overview');b.hideLocalControls('Turno de '+(p?.name||'jugador')+'…');return;}return S.original.beginTurn();}window.setCameraView?.('overview');if(p?.uid===S.uid&&g.phase==='TURN')b.prepareHumanTurn(p);else b.hideLocalControls('Turno de '+(p?.name||'jugador')+'…');};
    window.playCardsToCenter=function(p,cards){const r=S.original.play(p,cards);if(S.isHost)setTimeout(publishState,900);return r;};
    window.resolveLiarChallenge=function(p){const r=S.original.challenge(p);if(S.isHost){setTimeout(publishState,120);setTimeout(publishState,2050);setTimeout(publishState,2450);setTimeout(()=>{const btn=document.getElementById('btn-next-round');if(btn&&b.game.phase==='ROUND_END')btn.disabled=b.game.players[b.game.turnIndex]?.uid!==S.uid;},1950);}return r;};
    window.humanPlaySelected=async function(){if(!S.online||S.isHost){const r=S.original.playHuman();return r;}if(S.actionPending)return;const g=b.game,p=g.players[g.turnIndex],ids=g.selectedIndices.map(i=>p?.hand[i]?.instanceId).filter(Boolean);if(!ids.length)return;b.hideLocalControls('Enviando jugada…');await sendAction('play',{cardIds:ids});};
    window.humanCallLiar=async function(){if(!S.online||S.isHost){const r=S.original.callHuman();return r;}if(S.actionPending)return;b.hideLocalControls('Desafiando la jugada…');await sendAction('challenge');};
    window.handleNextRoundClick=async function(){if(S.online&&S.isHost&&b.game.phase==='GAME_OVER'){const players=b.game.players.map(p=>({uid:p.uid,name:p.name,avatar:p.avatar,isHuman:p.uid===S.uid,style:p.style||'balanced'}));b.startOnlineMatch(players);setTimeout(publishState,350);status('Nueva partida online iniciada con la misma sala.');return;}if(!S.online||S.isHost){const r=S.original.next();if(S.isHost)setTimeout(publishState,300);return r;}if(S.actionPending)return;await sendAction('next_round');};
    const localStart=window.startMatchFromSetup;window.startMatchFromSetup=function(){if(S.online){status('La sala online ya está en curso.');return;}return localStart();};const localOpenSetup=window.openSetupModal;window.openSetupModal=function(){if(S.online){status('No puedes abrir otra mesa mientras esta partida online está activa.');return;}return localOpenSetup();};
  }
  async function leaveLobby(){try{if(S.online&&S.roomRef&&S.lastSnapshot?.status==='waiting'){if(S.isHost){await S.sdk.updateDoc(S.roomRef,{status:'closed',updatedAt:Date.now()});}else{await S.sdk.runTransaction(S.db,async tx=>{const snap=await tx.get(S.roomRef);if(!snap.exists())return;const room=snap.data(),uids=room.memberUids||[];if(room.status!=='waiting'||!uids.includes(S.uid))return;tx.update(S.roomRef,{memberUids:uids.filter(uid=>uid!==S.uid),updatedAt:Date.now()});});}try{await S.sdk.deleteDoc(S.sdk.doc(S.db,paths().members+'/'+S.uid));}catch(e){console.warn('Limpiar miembro al salir',e);}}}catch(e){console.warn('Salir del lobby',e);status(e.message||'No se pudo salir correctamente.',true);}clearSession();showLobby(false);$('setup-modal')?.classList.remove('hidden');}
  function installUI(){ $('liar-online-create')?.addEventListener('click',createRoom);$('liar-online-join')?.addEventListener('click',joinRoom);$('liar-host-start')?.addEventListener('click',startHostGame);$('liar-lobby-copy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(S.roomId||'');status('Código copiado. ¡Pásalo al grupo!');}catch(e){status('Copia el código manualmente.',true);}});$('liar-lobby-back')?.addEventListener('click',leaveLobby);$('liar-join-code')?.addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));}
  function boot(){if(!window.Liar3DBridge){setTimeout(boot,50);return;}installHooks();installUI();window.Liar3DBridge.setOnlinePublisher(publishState);}
  window.addEventListener('beforeunload',()=>S.unsubs.forEach(f=>{try{f();}catch(e){}}));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.LiarOnline={publish:publishState,sendAction:sendAction,getSession:()=>({uid:S.uid,isHost:S.isHost,online:S.online})};
})();