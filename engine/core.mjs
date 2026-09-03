import { attackPower, cardScore, chooseAttack, chooseDefense, choosePractice, choosePurchase, cost, focus, guard } from "./bots.mjs";

export class Rng { constructor(seed=1){this.state=(Number(seed)||1)>>>0;} next(){this.state=(1664525*this.state+1013904223)>>>0;return this.state/2**32;} pick(a){return a[Math.floor(this.next()*a.length)];} shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(this.next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;} }
const num=(v)=>Number.parseInt(String(v??0),10)||0;
const remove=(array,card)=>{const i=array.indexOf(card); if(i>=0) array.splice(i,1);};
const cardType=(card)=> card.subtype === "Kata" ? "Kata" : attackPower(card)>0 ? "Attack" : card.subtype;

export class Game {
  constructor(data,{seed=1,strategies=["balanced","balanced"],characters=[]}={}){
    this.data=data; this.rng=new Rng(seed); this.round=1; this.turns=0; this.winner=null; this.reason=""; this.events=[]; this.cardStats=new Map();
    const chars=data.cards.filter(c=>c.cardType==="Character");
    this.players=[0,1].map(i=>this.makePlayer(i,characters[i]??chars[i],strategies[i]));
    this.marketDeck=this.rng.shuffle(data.cards.filter(c=>data.definition.economy.market.decks.includes(c.deck)).slice()); this.marketDiscard=[]; this.market=[];
    this.refillMarket(true);
  }
  makePlayer(id,character,strategy){
    const deck=[]; for(const e of this.data.definition.starterDeck) for(let i=0;i<e.copies;i++) deck.push(this.data.byId.get(e.catalogId)); this.rng.shuffle(deck);
    const p={id,name:`Player ${id+1}`,character,strategy,hp:this.data.definition.mode.startingHp,maxHp:this.data.definition.mode.startingHp,atk:num(character.stats?.ATK),def:num(character.stats?.DEF),speed:num(character.stats?.Speed),deck,hand:[],discard:[],played:[],focus:0,xp:0,tempo:true,purchases:0,plays:0,openingPurchase:false};
    this.draw(p,this.data.definition.turn.handSize); const types=new Set(p.hand.map(cardType)); const req=this.data.definition.openingMulligan.requiredTypes; if(!req.some(t=>types.has(t))){p.deck.push(...p.hand);p.hand=[];this.rng.shuffle(p.deck);this.draw(p,this.data.definition.turn.handSize);} return p;
  }
  draw(p,n){while(n--){if(!p.deck.length){p.deck=this.rng.shuffle(p.discard.splice(0));} if(p.deck.length)p.hand.push(p.deck.pop());}}
  refillMarket(full=false,chooser=null){
    const size=this.data.definition.economy.market.rowSize;
    if(full){this.marketDiscard.push(...this.market);this.market=[];while(this.market.length<size&&this.marketDeck.length)this.market.push(this.marketDeck.pop());if(this.market.length<size&&this.marketDiscard.length){this.marketDeck=this.rng.shuffle(this.marketDiscard.splice(0));while(this.market.length<size&&this.marketDeck.length)this.market.push(this.marketDeck.pop());}return;}
    while(this.market.length<size && this.marketDeck.length){
      const reveal=this.marketDeck.splice(-this.data.definition.economy.market.controlledRefill.reveal);
      if(!reveal.length)break; const chosen=chooser?chooser(reveal):reveal[0]; this.market.push(chosen); this.marketDiscard.push(...reveal.filter(c=>c!==chosen));
    }
    if(this.market.length<size && this.marketDiscard.length){this.marketDeck=this.rng.shuffle(this.marketDiscard.splice(0));this.refillMarket(false,chooser);}
  }
  track(card,key,player){const s=this.cardStats.get(card.catalogId)??{id:card.catalogId,name:card.name,purchased:0,played:0,winnerOwned:0};s[key]++;if(player) (player._used??=new Set()).add(card.catalogId);this.cardStats.set(card.catalogId,s);}
  resolveAttack(attacker,defender,card,{useTempo=true,defenseCard}={}){
    remove(attacker.hand,card); attacker.played.push(card); attacker.focus+=focus(card); attacker.plays++; this.track(card,"played",attacker);
    const defense=defenseCard===undefined?chooseDefense(defender.hand):defenseCard; let defenseFocus=0;
    if(defense){remove(defender.hand,defense);defender.played.push(defense);defender.focus+=focus(defense);defenseFocus=focus(defense);this.track(defense,"played",defender);}
    const tempo=useTempo&&attacker.tempo?this.data.definition.turn.tempoAttackPower:0; if(tempo)attacker.tempo=false;
    const attack=attackPower(card)+attacker.atk+tempo; const block=defender.def+(defense?guard(defense):0); const damage=Math.max(this.data.definition.combat.damageFloor,attack-block); defender.hp-=damage; if(damage>0)attacker.xp+=this.data.definition.progression.attackXpOnHit;else if(defense)defender.xp+=this.data.definition.progression.defenseXpOnBlock;
    this.events.push({round:this.round,type:"attack",attacker:attacker.id,defender:defender.id,card:card.catalogId,defense:defense?.catalogId??null,attack,block,damage,defenseFocus}); return {attack,block,damage,defense};
  }
  practice(p,card){if(this.data.definition.economy.defensePractice.usesPerTurn<1||!card||guard(card)<=0||!p.hand.includes(card))return false;remove(p.hand,card);p.played.push(card);p.focus+=focus(card);this.track(card,"played",p);this.events.push({round:this.round,type:"defense-practice",player:p.id,card:card.catalogId,focus:focus(card)});return true;}
  buy(p,card){if(!card||!this.market.includes(card)||cost(card)>p.focus)return false;p.focus-=cost(card);remove(this.market,card);p.discard.push(card);p.purchases++;if(this.round===1)p.openingPurchase=true;this.track(card,"purchased",p);this.refillMarket(false,(choices)=>choices.sort((a,b)=>cardScore(b,p.strategy)-cardScore(a,p.strategy))[0]);this.events.push({round:this.round,type:"purchase",player:p.id,card:card.catalogId,cost:cost(card)});return true;}
  botTurn(index){const p=this.players[index],d=this.players[1-index];p.tempo=true;this.practice(p,choosePractice(p.hand,p.strategy));let attackNumber=0;while(d.hp>0){const a=chooseAttack(p.hand,p.strategy);if(!a)break;this.resolveAttack(p,d,a,{useTempo:attackNumber===0});attackNumber++;}for(const card of [...p.hand]){if(["Kata","Consumable","Gear","Weapon","Defense Equipment"].includes(card.subtype)){remove(p.hand,card);p.played.push(card);p.focus+=focus(card);this.track(card,"played",p);}}
    while(true){const buy=choosePurchase(this.market,p.focus,p.strategy);if(!buy||!this.buy(p,buy))break;}this.events.push({round:this.round,type:"turn-snapshot",player:p.id,xp:p.xp,focus:p.focus,hp:p.hp,purchases:p.purchases});this.hide(p);this.turns++;this.checkWinner();
  }
  hide(p){p.discard.push(...p.hand,...p.played);p.hand=[];p.played=[];p.focus=0;this.draw(p,this.data.definition.turn.handSize);}
  checkWinner(){const alive=this.players.filter(p=>p.hp>0);if(alive.length===1){this.winner=alive[0].id;this.reason="knockout";}else if(this.round>this.data.definition.mode.maxRounds){this.winner=this.players[0].hp===this.players[1].hp?this.rng.pick([0,1]):this.players[0].hp>this.players[1].hp?0:1;this.reason="round-limit";}return this.winner!==null;}
  run(){while(!this.checkWinner()){for(let i=0;i<2&&this.winner===null;i++)this.botTurn(i);if(this.winner===null){this.round++;for(const p of this.players){p.xp+=this.data.definition.progression.xpPerHonor;p.tempo=true;}this.refillMarket(true);}}for(const p of this.players)for(const id of p._used??[])if(p.id===this.winner)this.cardStats.get(id).winnerOwned++;return this.result();}
  result(){return {winner:this.winner,reason:this.reason,rounds:this.round,turns:this.turns,players:this.players.map(p=>({id:p.id,strategy:p.strategy,hp:p.hp,xp:p.xp,purchases:p.purchases,plays:p.plays,openingPurchase:p.openingPurchase})),cards:[...this.cardStats.values()],events:this.events};}
}
