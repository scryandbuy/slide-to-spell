(function () {
'use strict';
const E=window.SlideEngine, boards=window.SlideBoards, R=window.SlideRewards, P=window.SlideProgress, J=window.SlideJourney, SR=window.SlideStarReveal, worlds=window.SlideWorlds, $=id=>document.getElementById(id);
const qa=new URLSearchParams(location.search).get('qa');
const suffix=qa?'-qa-'+qa.replace(/[^a-zA-Z0-9-]/g,''):'';
const key='slide-word-search-first-ten-v3'+suffix,previousKey='slide-word-search-levels-v2'+suffix,legacyKey='slide-word-search-locks-v1'+suffix;
let state,selected=[],pointer=null,sound=false,audio=null,records={},unlocked=1,archive=[],resultShown=false,reducedMotion=false,screen='home',mapGeneration=0,travelAnimation=null,pendingAdvance=null;
let restoredScreen='home',mapScroll=0,restoring=true,viewSaveTimer=0;
let completionMotion=null;
let starPolicyVersion=1,grandfatheredUnlocked=1,newWorldIndex=null;
let feedbackTimer=0;
let rejectionMotion=null;
const wordMotions=new Set();
function levelIndex(){return boards.findIndex(b=>b.id===state.boardId);}
function info(){const current=boards[levelIndex()];return current.compatibleDefinitions?.find(b=>b.definitionVersion===state.definitionVersion)||current;}
function escape(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function progress(){return{state,sound,records,unlocked,archive,reducedMotion,starPolicyVersion,grandfatheredUnlocked};}
function restore(){let raw=null;try{raw=JSON.parse(localStorage.getItem(key));if(!raw){const previous=JSON.parse(localStorage.getItem(previousKey)||localStorage.getItem(legacyKey));raw=previous||null;}}catch(_){}const p=P.restore(raw);state=p.state;sound=p.sound;records=p.records;unlocked=p.unlocked;archive=p.archive;starPolicyVersion=p.starPolicyVersion;grandfatheredUnlocked=p.grandfatheredUnlocked;reducedMotion=raw?.reducedMotion===true;restoredScreen=['home','map','game'].includes(raw?.screen)?raw.screen:raw?.state?'game':'home';mapScroll=Number.isFinite(raw?.mapScroll)?Math.max(0,raw.mapScroll):0;const start=Math.floor((unlocked-1)/10)*10;newWorldIndex=start>0&&levelIndex()<start&&!records[boards[start].id]?.completed?start:null;}
function save(){if(restoring)return;clearTimeout(viewSaveTimer);try{localStorage.setItem(key,JSON.stringify({schema:2,...progress(),screen,mapScroll}));}catch(_){}}
function systemReduced(){return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;}
function reduced(){return reducedMotion||systemReduced();}
function applyMotion(){document.documentElement.classList.toggle('reduce-motion',reduced());document.body.dataset.motion=reduced()?'reduced':'full';if(reduced()){clearFeedback();clearWordMotions();settleCompletionMotion();SR.settle();if(screen==='map')cancelTravel();}}
function currentWorld(){return J.worldFor(levelIndex(),worlds);}
function themeGame(){const world=currentWorld();document.body.style.setProperty('--current-world-image','url("'+world.background+'")');document.body.style.setProperty('--world-accent',world.accent);}
function cancelTravel(){mapGeneration++;travelAnimation?.cancel();travelAnimation=null;document.querySelectorAll('.map-butterfly-flight').forEach(e=>e.remove());const marker=document.querySelector('.butterfly-marker');if(marker)marker.style.visibility='';}
function setScreen(next){clearFeedback();clearWordMotions();if(screen==='map'&&!$('map-screen').hidden&&$('map-scroll').clientWidth>0&&$('map-scroll').clientHeight>0)mapScroll=$('map-scroll').scrollTop;cancelTravel();pointer=null;screen=next;for(const view of document.querySelectorAll('.app-screen'))view.hidden=view.dataset.screen!==next;document.body.dataset.screen=next;document.title=next==='game'?'Slide To Spell · Level '+(levelIndex()+1):next==='map'?'Slide To Spell · Level Map':'Slide To Spell: Word Search';save();if(next==='game')scheduleBoardFit();}
function renderHome(){const model=J.createModel(boards,worlds,progress()),level='Level '+(model.resumeIndex+1);$('home-continue').hidden=!model.hasProgress;$('home-play').hidden=model.hasProgress;$('home-continue-level').textContent=level;$('home-continue').setAttribute('aria-label','Continue '+level);}
function goHome(){closeModal();renderHome();setScreen('home');const button=$('home-continue').hidden?$('home-play'):$('home-continue');button.focus({preventScroll:true});}
function resumeGame(){const model=J.createModel(boards,worlds,progress()),gate=frontierGateIndex();if(state.finished&&gate<boards.length&&!P.isUnlocked(progress(),gate)&&gateReady(gate)){showMap({focusGate:gate});showWorldGate(gate);return;}if(state.finished&&model.resumeIndex!==model.activeIndex){newPuzzle(boards[model.resumeIndex].id);return;}closeModal();setScreen('game');render();if(state.finished){resultShown=false;showResults();}else $('game-menu')?.focus({preventScroll:true});}

const starPath='M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';
function starIcon(earned=true){return'<span class="rating-star'+(earned?' earned':'')+'" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+starPath+'"/></svg></span>';}
function ratingStars(count,extra=''){return'<span class="rating-stars '+extra+'" role="img" aria-label="'+count+' Of 3 Stars">'+[0,1,2].map(i=>starIcon(i<count)).join('')+'</span>';}
function thresholdStars(count){return'<span class="threshold-stars" role="img" aria-label="'+count+' Star'+(count===1?'':'s')+'">'+Array.from({length:count},()=>starIcon()).join('')+'</span>';}
function thresholdRows(number,vertical=false){const c=R.thresholds(number),rows=[[3,c.threeStarMax+' Or Less'],[2,(c.threeStarMax+1)+'–'+c.twoStarMax],[1,(c.twoStarMax+1)+' Or More']];return rows.map(([stars,label])=>'<'+(vertical?'div class="star-target-row"':'span')+'>'+thresholdStars(stars)+'<span class="threshold-range">'+label+'</span></'+(vertical?'div':'span')+'>').join('');}
function totalStars(){return R.totalStars(boards,records);}
function frontierGateIndex(){return(Math.floor((unlocked-1)/10)+1)*10;}
function gateReady(index){return P.isUnlocked(progress(),index)||(unlocked>=index&&records[boards[index-1].id]?.completed===true);}

function tone(type){if(!sound)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const time=audio.currentTime,notes=type==='find'?[523.25,659.25,783.99]:type==='error'?[196]:[392];notes.forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,time+i*.07);g.gain.exponentialRampToValueAtTime(.06,time+i*.07+.01);g.gain.exponentialRampToValueAtTime(.0001,time+i*.07+.16);o.connect(g);g.connect(audio.destination);o.start(time+i*.07);o.stop(time+i*.07+.18);});}catch(_){}}
function selectedWord(){return selected.map(id=>state.board.flat().find(t=>t.id===id)?.letter||'').join('');}
function validity(){const word=E.resolveTarget(state,selectedWord());if(!word)return{good:false,text:'Find a word from the list above.'};if(state.found.some(f=>f.word===word))return{good:false,word,text:'Already found. Look for another listed word.'};return{good:true,word,text:'Release to lock '+word+' in.'};}
function message(text){$('message').textContent=text;}
function wordTiles(ids){const chosen=new Set(ids);return[...document.querySelectorAll('.tile')].filter(tile=>chosen.has(tile.dataset.id));}
function clearWordMotions(){for(const motion of wordMotions){motion.animations.forEach(a=>a.cancel());motion.nodes.forEach(tile=>tile.classList.remove('word-accepted'));}wordMotions.clear();}
function animateAcceptedWord(ids){
  if(reduced())return;
  const nodes=wordTiles(ids);if(!nodes.length||typeof nodes[0].animate!=='function')return;
  const motion={nodes,animations:[]};wordMotions.add(motion);
  nodes.forEach((tile,index)=>{const shadow=getComputedStyle(tile).boxShadow;tile.classList.add('word-accepted');motion.animations.push(tile.animate([{transform:'scale(1)',boxShadow:shadow},{transform:'scale(1.045)',boxShadow:'inset 0 1px 0 #b5ca91,0 0 12px 3px #dfc47288',offset:.4},{transform:'scale(1)',boxShadow:shadow}],{duration:380,delay:index*25,easing:'ease-out'}));});
  Promise.all(motion.animations.map(a=>a.finished.catch(()=>{}))).then(()=>{motion.nodes.forEach(tile=>tile.classList.remove('word-accepted'));wordMotions.delete(motion);});
}
function clearFeedback(){
  clearTimeout(feedbackTimer);$('board-feedback').hidden=true;
  const motion=rejectionMotion;rejectionMotion=null;
  if(motion){motion.animations.forEach(a=>a.cancel());motion.nodes.forEach(tile=>tile.classList.remove('word-rejecting'));}
}
function selectionFeedback(){
  if(selected.length<2)return;
  const v=validity();if(v.good)return;
  const text=selected.length<3?'Use at least 3 letters.':v.word?'Already found.':'That isn’t a listed word.';
  const nodes=wordTiles(selected);clearFeedback();selected=[];renderSelection();
  const show=()=>{$('board-feedback').textContent=text;$('board-feedback').hidden=false;message(text);feedbackTimer=setTimeout(clearFeedback,1800);};
  if(reduced()||!nodes.length||typeof nodes[0].animate!=='function'){show();return;}
  const motion={nodes,animations:[]};rejectionMotion=motion;
  nodes.forEach(tile=>{const shadow=getComputedStyle(tile).boxShadow;tile.classList.add('word-rejecting');motion.animations.push(tile.animate([{transform:'translateX(0)',boxShadow:shadow},{transform:'translateX(-4px)',boxShadow:'inset 0 0 0 2px #b96d55,0 0 9px #c37b5b66',offset:.18},{transform:'translateX(4px)',offset:.36},{transform:'translateX(-3px)',offset:.54},{transform:'translateX(2px)',offset:.72},{transform:'translateX(0)',boxShadow:shadow}],{duration:260,easing:'ease-in-out'}));});
  Promise.all(motion.animations.map(a=>a.finished.catch(()=>{}))).then(()=>{if(rejectionMotion!==motion)return;rejectionMotion=null;nodes.forEach(tile=>tile.classList.remove('word-rejecting'));show();});
}
function renderSelection(){const v=validity();for(const tile of document.querySelectorAll('.tile')){const on=selected.includes(tile.dataset.id);tile.classList.toggle('selected',on);tile.classList.toggle('invalid-selection',on&&selected.length>=3&&!v.good);tile.setAttribute('aria-pressed',String(on));}if(selected.length)message(v.text);}
function arrow(axis,index,direction,r,c){const b=document.createElement('button'),name=axis==='row'?(direction<0?'Left':'Right'):(direction<0?'Up':'Down');b.className='arrow';b.tabIndex=-1;const chevron={Left:'15 6 9 12 15 18',Right:'9 6 15 12 9 18',Up:'6 15 12 9 18 15',Down:'6 9 12 15 18 9'}[name];b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="'+chevron+'"/></svg>';b.setAttribute('aria-label','Shift '+(axis==='row'?'Row ':'Column ')+(index+1)+' '+name);b.title=b.getAttribute('aria-label');b.style.gridRow=r;b.style.gridColumn=c;b.disabled=state.finished;const line=axis==='row'?state.board[index]:state.board.map(row=>row[index]);if(line.filter(t=>!t.locked).length<2)b.disabled=true;b.onclick=()=>apply(E.shift(state,axis,index,direction));return b;}
let fitFrame=0;
function fitBoard(){
  const area=document.querySelector('.play-area'),frame=$('board-frame');
  if(screen!=='game'||!area.clientWidth||!area.clientHeight)return;
  const size=Math.floor(Math.min(area.clientWidth,area.clientHeight));
  if(size<1)return;
  const n=state.board.length,arrows=size>=560?36:size>=300?32:28,gap=size>=560?4:2;
  const tile=(size-arrows*2-gap*(n+1))/n;
  $('game-screen').style.setProperty('--board-width',size+'px');
  frame.style.width=size+'px';
  frame.style.height=size+'px';
  frame.style.setProperty('--arrow-size',arrows+'px');
  frame.style.setProperty('--board-gap',gap+'px');
  frame.style.setProperty('--letter-size',Math.max(12,Math.min(48,Math.floor(tile*.67)))+'px');
  frame.style.setProperty('--arrow-font',Math.max(18,Math.min(30,Math.floor(arrows*.8)))+'px');
}
function scheduleBoardFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitBoard);}
function renderBoard(){clearWordMotions();const frame=$('board-frame'),n=state.board.length,children=[];frame.style.setProperty('--size',n);for(let i=0;i<n;i++){children.push(arrow('row',i,-1,i+2,1),arrow('row',i,1,i+2,n+2),arrow('column',i,-1,1,i+2),arrow('column',i,1,n+2,i+2));}state.board.forEach((row,r)=>row.forEach((t,c)=>{const b=document.createElement('button');b.className='tile'+(t.locked?' locked':'');b.tabIndex=-1;b.textContent=t.letter;b.dataset.id=t.id;b.dataset.row=r;b.dataset.col=c;b.style.gridRow=r+2;b.style.gridColumn=c+2;b.setAttribute('aria-label',t.letter+', Row '+(r+1)+', Column '+(c+1)+(t.locked?', Locked':''));b.setAttribute('aria-pressed','false');b.disabled=state.finished;b.onclick=e=>{if(e.detail===0&&!state.finished)tap(r,c);};children.push(b);}));frame.replaceChildren(...children);scheduleBoardFit();}
function renderTargets(targets){
  const split=Math.min(3,targets.length);
  const rows=[targets.slice(0,split)];if(split<targets.length)rows.push(targets.slice(split));
  $('target-bank').innerHTML=rows.map(words=>'<div class="target-row">'+words.map(w=>'<span class="target-word '+(state.found.some(f=>f.word===w)?'found':'')+'">'+escape(w)+'</span>').join('')+'</div>').join('');
}
function render(){const b=info(),i=levelIndex();themeGame();$('puzzle-number').innerHTML='Level <span class="level-heading-number">'+String(i+1).split('').map(d=>'<span class="level-heading-digit'+(/[34579]/.test(d)?' level-heading-descender':'')+'">'+d+'</span>').join('')+'</span>';$('moves').textContent=state.moves;$('moves').dataset.digits=Math.min(5,String(state.moves).length);$('star-thresholds').innerHTML=thresholdRows(i+1);renderTargets(b.targets);$('restart').hidden=state.finished;$('view-results').hidden=!state.finished;renderBoard();renderSelection();save();}

function apply(result){pointer=null;if(!result.ok){tone('error');renderSelection();message(result.message);selectionFeedback();return;}clearFeedback();const winningIds=result.word?[...selected]:[];state=result.state;selected=[];resultShown=false;tone(result.word?'find':'shift');render();message(result.message);if(state.finished)showResults({celebrate:true,tileIds:winningIds});else if(result.word)animateAcceptedWord(winningIds);}
function path(r,c,origin){if(r!==origin.r&&c!==origin.c)return null;const dr=Math.sign(r-origin.r),dc=Math.sign(c-origin.c),distance=Math.abs(r-origin.r)+Math.abs(c-origin.c);return Array.from({length:distance+1},(_,i)=>state.board[origin.r+dr*i][origin.c+dc*i].id);}
function tap(r,c){
  if(state.finished)return;
  clearFeedback();
  const id=state.board[r][c].id;
  if(selected[0]===id){clearDraft();return;}
  if(selected.length){const first=state.board.flatMap((row,rr)=>row.map((tile,cc)=>({tile,r:rr,c:cc}))).find(p=>p.tile.id===selected[0]);selected=path(r,c,first)||[id];}else selected=[id];
  if(validity().good)submit();else{renderSelection();selectionFeedback();}
}
function clearDraft(){clearFeedback();selected=[];pointer=null;renderSelection();message('Use arrows to shift. Swipe a word to lock it.');}
function submit(){if(selected.length)apply(E.submit(state,selected));}
$('board-frame').addEventListener('pointerdown',e=>{const t=e.target.closest('.tile');if(!t||state.finished||(e.pointerType==='mouse'&&e.button!==0)||pointer)return;e.preventDefault();clearFeedback();clearWordMotions();pointer={id:e.pointerId,r:+t.dataset.row,c:+t.dataset.col,moved:false,prior:[...selected]};$('board-frame').setPointerCapture(e.pointerId);selected=[t.dataset.id];renderSelection();});
$('board-frame').addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tile');if(!t||!t.closest('#board-frame'))return;const r=+t.dataset.row,c=+t.dataset.col,next=path(r,c,pointer);if(!next)return;if(r!==pointer.r||c!==pointer.c)pointer.moved=true;selected=next;renderSelection();});
$('board-frame').addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const p=pointer;pointer=null;if(p.moved&&selected.length>=3){submit();return;}if(!p.moved){selected=p.prior;tap(p.r,p.c);}else{renderSelection();selectionFeedback();}});
$('board-frame').addEventListener('pointercancel',clearDraft);
// Keep gameplay on the touch controls; semantic touch activation still works.
for(const type of ['keydown','keyup'])$('game-screen').addEventListener(type,e=>{if((e.key==='Enter'||e.key===' '||e.code==='Space')&&e.target.closest('#board-frame,#restart,#view-results'))e.preventDefault();});
function cancelCompletionMotion(){
  SR.cancel();
  const motion=completionMotion;completionMotion=null;
  if(motion){motion.animations.forEach(a=>a.cancel());motion.nodes.forEach(node=>node.remove());motion.shell.style.opacity='';motion.shell.style.transform='';}
  $('modal').classList.remove('is-celebrating');
}
function completionLanding(motion){
  const dialog=$('modal').getBoundingClientRect(),card=motion.shell.getBoundingClientRect(),safe=getComputedStyle($('modal'));
  const top=parseFloat(safe.paddingTop)||0,left=parseFloat(safe.paddingLeft)||0,right=parseFloat(safe.paddingRight)||0;
  const size=Math.min(72,Math.max(24,(card.top-dialog.top-top)*2)),radius=size/2;motion.actor.style.width=size+'px';motion.actor.style.height=size+'px';
  return{x:Math.max(left+radius,Math.min(card.left+card.width/2-dialog.left,dialog.width-right-radius)),y:Math.max(top+radius,card.top-dialog.top)};
}
function settleCompletionMotion({animateStars=false}={}){
  const motion=completionMotion;if(!motion)return;
  motion.settled=true;motion.animations.forEach(a=>a.cancel());motion.animations=[];
  motion.shell.style.opacity='';motion.shell.style.transform='';
  motion.nodes.filter(node=>node!==motion.actor).forEach(node=>node.remove());motion.nodes=[motion.actor];
  const end=completionLanding(motion);Object.assign(motion.actor.style,{left:end.x+'px',top:end.y+'px',opacity:'1',transform:'translate(-50%,-50%)'});
  motion.actor.firstElementChild.style.transform='';$('modal').classList.remove('is-celebrating');
  const ready=motion.onReady;motion.onReady=null;ready?.(animateStars);
}
function animateCompletion(tileIds,celebrate,onReady){
  const dialog=$('modal'),shell=dialog.querySelector('.modal-shell'),actor=document.createElement('div'),wings=document.createElement('div');
  actor.className='completion-butterfly';actor.setAttribute('aria-hidden','true');wings.className='completion-wings';actor.append(wings);dialog.append(actor);
  const motion={actor,shell,nodes:[actor],animations:[],settled:false,onReady};completionMotion=motion;
  if(!celebrate||reduced()||typeof actor.animate!=='function'){settleCompletionMotion({animateStars:!reduced()});return;}
  dialog.classList.add('is-celebrating');shell.style.opacity='0';
  requestAnimationFrame(()=>{
    if(completionMotion!==motion||motion.settled||!dialog.open)return;
    const ids=new Set(tileIds),tiles=[...document.querySelectorAll('.tile')].filter(tile=>ids.has(tile.dataset.id));
    const bounds=dialog.getBoundingClientRect(),board=$('board-frame').getBoundingClientRect();
    const centers=tiles.map(tile=>{const r=tile.getBoundingClientRect();return{x:r.left+r.width/2-bounds.left,y:r.top+r.height/2-bounds.top};});
    const start=centers.length?{x:centers.reduce((sum,p)=>sum+p.x,0)/centers.length,y:centers.reduce((sum,p)=>sum+p.y,0)/centers.length}:{x:board.left+board.width/2-bounds.left,y:board.top+board.height/2-bounds.top};
    const end=completionLanding(motion),run=(element,frames,options)=>{const a=element.animate(frames,options);motion.animations.push(a);return a;};
    Object.assign(actor.style,{left:end.x+'px',top:end.y+'px',opacity:'1'});
    tiles.forEach((tile,index)=>run(tile,[{boxShadow:'0 0 0 0 #dfc47200',transform:'scale(1)'},{boxShadow:'0 0 18px 4px #dfc47299',transform:'scale(1.06)',offset:.4},{boxShadow:'0 0 0 0 #dfc47200',transform:'scale(1)'}],{duration:420,delay:index*45,easing:'ease-out'}));
    const landing=run(actor,[{left:start.x+'px',top:start.y+'px',opacity:0,transform:'translate(-50%,-50%) rotate(-20deg) scale(.65)'},{opacity:1,offset:.12},{left:Math.min(bounds.width-35,end.x+50)+'px',top:end.y+45+'px',transform:'translate(-50%,-50%) rotate(12deg) scale(1.05)',offset:.6},{left:end.x+'px',top:end.y+'px',opacity:1,transform:'translate(-50%,-50%) rotate(0) scale(1)'}],{duration:920,delay:130,fill:'both',easing:'cubic-bezier(.3,.1,.25,1)'});
    landing.finished.catch(()=>{}).then(()=>{if(completionMotion===motion&&!motion.settled)settleCompletionMotion({animateStars:true});});
    run(wings,[{transform:'scaleX(1)'},{transform:'scaleX(.35)',offset:.5},{transform:'scaleX(1)'}],{duration:170,iterations:6});
    run(shell,[{opacity:0,transform:'translateY(10px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,delay:595,fill:'forwards',easing:'cubic-bezier(.2,.8,.25,1)'});
    for(let index=0;index<13;index++){
      const particle=document.createElement('span');particle.className='completion-sparkle';particle.setAttribute('aria-hidden','true');particle.style.left=end.x+'px';particle.style.top=end.y+'px';dialog.append(particle);motion.nodes.push(particle);
      const angle=-Math.PI+index/12*Math.PI,dx=Math.cos(angle)*(40+index%4*16),dy=Math.sin(angle)*(55+index%3*16);
      run(particle,[{opacity:0,transform:'translate(0,0) scale(.3)'},{opacity:.85,offset:.2},{opacity:0,transform:'translate('+dx+'px,'+dy+'px) rotate('+index*31+'deg) scale(.2)'}],{duration:980,delay:560+index*12,fill:'both',easing:'ease-out'});
    }
    Promise.all(motion.animations.map(a=>a.finished.catch(()=>{}))).then(()=>{if(completionMotion===motion)settleCompletionMotion();});
  });
}

function modal(html,{completion=false,kind=''}={}){clearFeedback();clearWordMotions();cancelCompletionMotion();pointer=null;$('modal').classList.toggle('completion-dialog',completion);$('modal').classList.toggle('gate-dialog',kind==='gate');$('modal-content').innerHTML=html;const heading=$('modal-content').querySelector('h2');if(heading){heading.id||='modal-title';$('modal').setAttribute('aria-labelledby',heading.id);}else $('modal').removeAttribute('aria-labelledby');if(!$('modal').open)$('modal').showModal();}
function closeModal(){cancelCompletionMotion();$('modal').close();$('modal').classList.remove('completion-dialog','gate-dialog');}
$('modal').addEventListener('close',()=>{if(!$('modal').open){cancelCompletionMotion();$('modal').classList.remove('completion-dialog','gate-dialog');}});
$('close-modal').onclick=closeModal;
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){if($('modal').classList.contains('completion-dialog')){closeModal();return;}const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function newPuzzle(id){const index=boards.findIndex(b=>b.id===id);if(!P.isUnlocked(progress(),index))return;if(newWorldIndex!==null&&index>=newWorldIndex)newWorldIndex=null;state=E.createGame(id);selected=[];pointer=null;resultShown=false;pendingAdvance=null;closeModal();setScreen('game');render();message('Find every listed word. Each slide counts as one move.');$('game-menu')?.focus({preventScroll:true});}
function showResults({celebrate=false,tileIds=[],recordCompletion=true,animateStars=celebrate}={}){
  if(!state.finished||resultShown)return;resultShown=true;
  const i=levelIndex(),previous=R.recordStars(i+1,records[state.boardId]),earned=R.starsForMoves(i+1,state.moves),boardId=state.boardId;
  if(recordCompletion){const before=unlocked,p=P.record(progress(),state);records=p.records;unlocked=p.unlocked;archive=p.archive;starPolicyVersion=p.starPolicyVersion;grandfatheredUnlocked=p.grandfatheredUnlocked;pendingAdvance=J.advancement(before,unlocked,boards.length);if(Math.floor((unlocked-1)/10)>Math.floor((before-1)/10))newWorldIndex=Math.floor((unlocked-1)/10)*10;save();}
  const gained=Math.max(0,R.recordStars(i+1,records[state.boardId])-previous),next=boards[i+1],explore=newWorldIndex!==null&&P.isUnlocked(progress(),newWorldIndex)?newWorldIndex:null;
  const blocked=next&&!P.isUnlocked(progress(),i+1),label=!next?'Return To Map':explore!==null?'Explore '+J.worldFor(explore,worlds).name:blocked?'View World Gate':'Next Level';
  const rating=gained?'<strong>New Best</strong><span>+'+gained+' Star'+(gained===1?'':'s')+'</span>':'<span class="completion-highest">Highest Rating '+ratingStars(R.recordStars(i+1,records[state.boardId]))+'</span>';
  modal('<div class="completion-content"><h2>Level '+(i+1)+'<br>Complete</h2>'+ratingStars(earned,'completion-stars')+'<p class="completion-moves"><strong>'+state.moves+'</strong><span>Moves</span></p><div class="completion-rating-info">'+rating+'</div><div class="completion-actions">'+(!next?'<p class="completion-finale">All '+boards.length+' Levels Complete</p>':explore!==null?'<p class="completion-unlocked">'+escape(J.worldFor(explore,worlds).name)+' is unlocked.</p>':'')+'<button class="primary" id="next-level">'+escape(label)+'</button><button class="secondary" id="replay-level">Replay Level</button><button class="completion-map" id="results-levels">Level Map</button></div></div>',{completion:true});
  const actions=$('modal-content').querySelector('.completion-actions');actions.inert=true;if(animateStars&&!reduced())$('modal-content').querySelector('.completion-content').classList.add('is-revealing');
  $('next-level').onclick=()=>{if(!next){showMap({focusIndex:boards.length-1});return;}if(explore!==null){const advance=pendingAdvance;pendingAdvance=null;showMap({advance,focusIndex:explore});return;}if(blocked){showMap({focusGate:i+1});showWorldGate(i+1);return;}newPuzzle(next.id);};
  $('replay-level').onclick=()=>newPuzzle(boardId);$('results-levels').onclick=()=>{const advance=pendingAdvance;pendingAdvance=null;showMap({advance});};
  animateCompletion(tileIds,celebrate,allowAnimation=>{if(!$('modal').open||!$('modal').classList.contains('completion-dialog')||state.boardId!==boardId)return;const card=$('modal-content').querySelector('.completion-content');SR.start({dialog:$('modal'),card,stars:card.querySelector('.completion-stars'),earned,actions,reduced:!animateStars||!allowAnimation||reduced()});});
}
function routePath(nodes){
  if(!nodes.length)return'';
  const points=nodes.map(node=>({x:node.point.x*6,y:node.point.y*11}));
  return points.reduce((d,p,i)=>{if(!i)return'M '+p.x+' '+p.y;const before=points[i-1],mid=(before.y+p.y)/2;return d+' C '+before.x+' '+mid+', '+p.x+' '+mid+', '+p.x+' '+p.y;},'');
}

function gateMarkup(index,inline=false){
  const status=P.gateStatus(progress(),index);if(!status)return'';
  const world=J.worldFor(index,worlds),ready=gateReady(index),open=status.unlocked;
  const need=open?'World Unlocked':!ready?'Complete Level '+index:status.starsRemaining+' More Star'+(status.starsRemaining===1?'':'s')+' To Unlock';
  const lock='<span class="gate-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>';
  const action=open?'explore':!ready?'continue':null;
  const button=action?'<button class="primary" data-gate-action="'+action+'" data-gate-index="'+index+'">'+escape(open?'Explore '+world.name:'Continue Playing')+'</button>':'';
  return(open?'<img class="gate-butterfly" src="assets/butterfly.webp" alt="">':lock)+'<'+(inline?'h3':'h2')+'>'+escape(world.name)+'</'+(inline?'h3':'h2')+'><p class="gate-meta">Levels '+(index+1)+'–'+Math.min(index+10,boards.length)+'</p><div class="gate-tally">'+starIcon()+'<span>'+status.totalStars+' / '+status.requiredStars+'</span></div><div class="gate-meter" role="progressbar" aria-label="Total Stars For '+escape(world.name)+'" aria-valuemin="0" aria-valuemax="'+status.requiredStars+'" aria-valuenow="'+Math.min(status.totalStars,status.requiredStars)+'"><span style="width:'+Math.min(100,status.totalStars/status.requiredStars*100)+'%"></span></div><p class="gate-need">'+need+'</p>'+button+(!inline?'<button class="gate-back" data-gate-action="map" data-gate-index="'+index+'">Back To Map</button>':'');
}
function bindGateActions(scope){scope.querySelectorAll('[data-gate-action]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.gateIndex),action=button.dataset.gateAction;if(action==='explore')openMapLevel(boards[index].id);else if(action==='continue')openMapLevel(boards[unlocked-1].id);else showMap({focusGate:index});});}
function showWorldGate(index){if(!P.gateStatus(progress(),index))return;modal('<div class="gate-content">'+gateMarkup(index)+'</div>',{kind:'gate'});bindGateActions($('modal-content'));}
function mapWorldHeader(area){
  const locked=!P.isUnlocked(progress(),area.startIndex);
  const lock=locked?'<span class="world-header-lock" role="img" aria-label="Locked"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>':'';
  return '<header class="world-header">'+lock+'<p class="eyebrow">Area '+(area.index+1)+' · Levels '+(area.startIndex+1)+'–'+(area.endIndex+1)+'</p><h2 id="world-'+area.index+'">'+escape(area.name)+'</h2></header>';
}
function renderMap(){
  const model=J.createModel(boards,worlds,progress()),gateIndex=newWorldIndex!==null?newWorldIndex:frontierGateIndex();
  $('map-star-total').innerHTML=starIcon()+'<span>'+totalStars()+' Total Stars</span>';
  $('map-journey').innerHTML=model.areas.map(area=>'<section class="map-world" data-world="'+area.index+'" aria-labelledby="world-'+area.index+'" style="--world-image:url(&quot;'+escape(area.background)+'&quot;);--world-accent:'+escape(area.accent)+'"><div class="world-art" aria-hidden="true"></div>'+mapWorldHeader(area)+'<div class="map-stage"><svg class="map-route" viewBox="0 0 600 1100" preserveAspectRatio="none" aria-hidden="true"><path class="map-route-base" d="'+routePath(area.nodes)+'"/><path class="map-route-completed" d="'+routePath(area.nodes.filter(n=>n.index<=model.markerIndex))+'"/></svg>'+area.nodes.map(node=>'<button class="map-node'+(node.completed?' completed':'')+(node.current?' current':'')+(!node.available?' locked':'')+(node.active&&!state.finished?' active':'')+'" data-level="'+node.id+'" data-level-index="'+node.index+'" style="--node-x:'+node.point.x+'%;--node-y:'+node.point.y+'%" '+(!node.available?'disabled ':'')+(node.current?'aria-current="step" ':'')+'aria-label="Level '+node.number+', '+(node.completed?R.recordStars(node.number,records[node.id])+' Star'+(R.recordStars(node.number,records[node.id])===1?'':'s'):node.available?'Ready To Play':'Locked')+(node.current?', Current Position':'')+'"><span class="node-number">'+node.number+'</span>'+(node.completed?ratingStars(R.recordStars(node.number,records[node.id])):!node.available?'<span class="node-lock" aria-hidden="true">🔒</span>':'')+'</button>').join('')+(model.markerIndex>=area.startIndex&&model.markerIndex<=area.endIndex?'<img class="butterfly-marker" src="assets/butterfly.webp" alt="" aria-hidden="true" style="--node-x:'+J.levelPoint(model.markerIndex%10).x+'%;--node-y:'+J.levelPoint(model.markerIndex%10).y+'%">':'')+'</div>'+(area.endIndex+1===gateIndex&&gateIndex<boards.length?'<section class="world-gate" data-gate-index="'+gateIndex+'" aria-label="'+escape(J.worldFor(gateIndex,worlds).name)+' World Gate">'+gateMarkup(gateIndex,true)+'</section>':'')+'</section>').join('');
  document.querySelectorAll('.map-node[data-level]').forEach(button=>button.onclick=()=>openMapLevel(button.dataset.level));bindGateActions($('map-journey'));
  $('map-status').textContent=model.completed+' of '+model.total+' levels complete. '+totalStars()+' total stars. Your butterfly is at level '+(model.markerIndex+1)+'.';
  return model;
}
function openMapLevel(id){
  const index=boards.findIndex(board=>board.id===id);
  if(!P.isUnlocked(progress(),index))return;
  const board=boards[index],world=J.worldFor(index,worlds),sameAttempt=id===state.boardId&&!state.finished;
  const samePartial=sameAttempt&&state.history.length>0,differentPartial=!sameAttempt&&!state.finished&&state.history.length>0,record=records[id];
  cancelTravel();
  modal('<div class="level-preview"><h2 id="preview-title">Level '+(index+1)+'</h2><p class="preview-area">'+escape(world.name)+'</p>'+(record?.completed?'<p class="preview-rating">Highest Rating '+ratingStars(R.recordStars(index+1,record))+'</p>':'')+(differentPartial?'<p class="preview-warning">Starting this level will replace your unfinished Level '+(levelIndex()+1)+' attempt.</p>':'')+'<button class="primary" id="preview-start">'+(samePartial?'Continue Level':'Start Level')+'</button><button class="secondary" id="preview-cancel">Cancel</button></div>');
  $('preview-start').onclick=()=>{if(sameAttempt)resumeGame();else newPuzzle(id);};
  $('preview-cancel').onclick=closeModal;
  $('preview-start').focus();
}
function focusMapNode(index){const button=document.querySelector('.map-node[data-level-index="'+index+'"]');if(button){button.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});button.focus({preventScroll:true});}}
async function animateJourney(advance){
  const generation=mapGeneration,from=document.querySelector('.map-node[data-level-index="'+advance.from+'"]'),to=document.querySelector('.map-node[data-level-index="'+advance.to+'"]');
  if(!from||!to||reduced()||typeof from.animate!=='function'){focusMapNode(advance.to);return;}
  from.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
  await new Promise(requestAnimationFrame);if(screen!=='map'||generation!==mapGeneration)return;
  const journey=$('map-journey'),origin=journey.getBoundingClientRect(),a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),marker=journey.querySelector('.butterfly-marker'),markerRect=marker?.getBoundingClientRect();
  const offset={x:markerRect?markerRect.left+markerRect.width/2-b.left-b.width/2:0,y:markerRect?markerRect.top+markerRect.height/2-b.top-b.height/2:-48};
  const start={x:a.left+a.width/2-origin.left+offset.x,y:a.top+a.height/2-origin.top+offset.y},end={x:b.left+b.width/2-origin.left+offset.x,y:b.top+b.height/2-origin.top+offset.y},mid=(start.y+end.y)/2;
  const butterfly=document.createElement('img');butterfly.className='map-butterfly-flight';butterfly.src='assets/butterfly.webp';butterfly.alt='';butterfly.setAttribute('aria-hidden','true');
  Object.assign(butterfly.style,{position:'absolute',width:(markerRect?.width||48)+'px',height:(markerRect?.height||48)+'px',objectFit:'contain',left:start.x+'px',top:start.y+'px',transform:'translate(-50%,-50%)',zIndex:'10',pointerEvents:'none'});
  if(marker)marker.style.visibility='hidden';journey.style.position='relative';journey.append(butterfly);
  const frames=Array.from({length:31},(_,i)=>{const t=i/30,u=1-t,x=u*u*u*start.x+3*u*u*t*start.x+3*u*t*t*end.x+t*t*t*end.x,y=u*u*u*start.y+3*u*u*t*mid+3*u*t*t*mid+t*t*t*end.y;return{offset:t,left:x+'px',top:y+'px'};});
  travelAnimation=butterfly.animate(frames,{duration:1100,easing:'ease-in-out',fill:'forwards'});
  to.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
  await travelAnimation.finished.catch(()=>{});
  if(generation!==mapGeneration)return;
  butterfly.remove();travelAnimation=null;if(marker)marker.style.visibility='';if(screen==='map')focusMapNode(advance.to);
}
// Wait for a measured map before restoring its saved position.
function restoreMapScroll(top){if(screen!=='map')return;const pane=$('map-scroll');if(pane.clientWidth<=0||pane.clientHeight<=0){requestAnimationFrame(()=>restoreMapScroll(top));return;}pane.scrollTo({top:Math.max(0,Math.min(top,pane.scrollHeight-pane.clientHeight)),left:0,behavior:'instant'});mapScroll=pane.scrollTop;save();}
function showMap(options={}){closeModal();setScreen('map');const model=renderMap(),focusIndex=Number.isInteger(options.focusIndex)?Math.max(0,Math.min(boards.length-1,options.focusIndex)):model.markerIndex;requestAnimationFrame(()=>{if(screen!=='map')return;if(Number.isFinite(options.restoreScroll)){restoreMapScroll(options.restoreScroll);}else if(Number.isInteger(options.focusGate)){const gate=document.querySelector('.world-gate[data-gate-index="'+options.focusGate+'"]');if(gate){gate.scrollIntoView({block:'center',behavior:'auto'});gate.querySelector('button')?.focus({preventScroll:true});}else focusMapNode(focusIndex);}else if(options.advance)animateJourney(options.advance);else focusMapNode(focusIndex);});}
function showHelp(){modal('<div class="how-to-play"><h2>How To Play</h2><ul><li>Find every listed word. Words run across or down, in either direction.</li><li>Shift rows or columns with the arrows. Letters wrap around; found letters stay locked.</li><li>Swipe a word or tap its first and last letters. Locked letters can be reused. Tap the first letter again to cancel.</li><li>Fewer moves earn more stars. Total stars unlock new areas.</li></ul><p class="help-note">Every shift counts, including moving back. There is no timer or move limit.</p><button class="primary" id="help-done">Got It</button></div>');$('help-done').onclick=closeModal;}
function showStarTargets(){modal('<h2>Star Targets</h2><p class="star-target-level">Level '+(levelIndex()+1)+'</p><div class="star-target-list">'+thresholdRows(levelIndex()+1,true)+'</div><button class="primary" id="targets-back">Back To Settings</button>');$('targets-back').onclick=showSettings;}
function showSettings(){
  modal('<h2>Settings</h2><div class="settings-list"><label class="settings-row"><strong>Sound Effects</strong><input type="checkbox" id="setting-sound" '+(sound?'checked':'')+'></label><label class="settings-row"><strong>Reduce Motion</strong><input type="checkbox" id="setting-motion" '+(reduced()?'checked ':'')+(systemReduced()?'disabled title="Enabled By Device"':'')+'></label></div><button class="secondary settings-star-targets" id="settings-star-targets">Star Targets</button><button class="primary" id="settings-done">Done</button>');
  $('setting-sound').onchange=e=>{sound=e.target.checked;render();if(sound)tone('find');};
  $('setting-motion').onchange=e=>{reducedMotion=e.target.checked;applyMotion();save();};
  $('settings-star-targets').onclick=showStarTargets;$('settings-done').onclick=closeModal;
}
function showGameMenu(){
  modal('<h2>Game Menu</h2><nav class="game-menu-list" aria-label="Game Menu"><button class="secondary" id="menu-home">Home</button><button class="secondary" id="menu-map">Level Map</button><button class="secondary" id="menu-help">How To Play</button><button class="secondary" id="menu-settings">Settings</button></nav>');
  $('menu-home').onclick=goHome;$('menu-map').onclick=()=>showMap();$('menu-help').onclick=showHelp;$('menu-settings').onclick=showSettings;
}
$('game-menu')?.addEventListener('click',showGameMenu);$('brand-home').onclick=goHome;
$('home-continue').onclick=resumeGame;$('home-play').onclick=resumeGame;$('home-map').onclick=()=>showMap();$('home-help').onclick=showHelp;$('home-settings').onclick=showSettings;
$('map-home').onclick=goHome;$('map-settings').onclick=showSettings;
$('restart').tabIndex=-1;$('view-results').tabIndex=-1;
$('view-results').onclick=()=>{if(state.finished){resultShown=false;showResults({recordCompletion:false,animateStars:true});}};
$('restart').onclick=()=>{if(!state.history.length){newPuzzle(state.boardId);return;}modal('<span class="eyebrow">A Fresh Start</span><h2>Restart This Level?</h2><p>Reset the letters, found words, and move count.</p><button class="primary" id="confirm-restart">Restart Level</button><button class="secondary" id="cancel-restart">Keep Playing</button>');$('confirm-restart').onclick=()=>newPuzzle(state.boardId);$('cancel-restart').onclick=closeModal;};

// Scroll events already cache the last visible position; teardown can report zero.
function saveView(){clearFeedback();clearWordMotions();settleCompletionMotion();SR.settle();if(pointer)clearDraft();save();}
$('map-scroll').addEventListener('scroll',()=>{if(screen!=='map'||$('map-screen').hidden||document.hidden||$('map-scroll').clientWidth<=0||$('map-scroll').clientHeight<=0)return;mapScroll=$('map-scroll').scrollTop;clearTimeout(viewSaveTimer);viewSaveTimer=setTimeout(save,120);},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveView();if(audio?.state==='running')audio.suspend();}});
window.addEventListener('pagehide',saveView);
window.addEventListener('pageshow',()=>{if(screen==='game')scheduleBoardFit();});
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',applyMotion);
restore();applyMotion();render();renderHome();if(restoredScreen==='map')showMap({restoreScroll:mapScroll});else{setScreen(restoredScreen);if(restoredScreen==='game'&&state.finished)showResults();}restoring=false;save();
if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleBoardFit).observe(document.querySelector('.play-area'));
window.addEventListener('resize',scheduleBoardFit);window.visualViewport?.addEventListener('resize',scheduleBoardFit);
window.addEventListener('resize',()=>{settleCompletionMotion();SR.settle();});window.visualViewport?.addEventListener('resize',()=>{settleCompletionMotion();SR.settle();});
window.addEventListener('resize',()=>{clearFeedback();clearWordMotions();});
})();
