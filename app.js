'use strict';
(() => {
const KEY='petit-french-progress-v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let course, steps=[], byId=new Map(), state, route='home', current, revealed=false, hidden=false, reviewing=false;
let readingObserver;
let sessionCount=0, sessionSeen=new Set(), voices=[], speechToken=0, speechActive=false, speechPaused=false, utterance, toastTimer;
const defaults=()=>({version:1,completed:[],bookmarks:[],cursor:'1-1',notes:{},trackNotes:{},settings:{size:5,rate:.9,en:'',fr:'',focus:false,mode:'read'}});
function validate(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.completed)||!Array.isArray(raw.bookmarks))throw Error('This is not a compatible progress backup.');
 const out=defaults();
 for(const key of ['completed','bookmarks'])out[key]=[...new Set(raw[key].filter(id=>typeof id==='string'&&byId.has(id)))];
 if(byId.has(raw.cursor))out.cursor=raw.cursor;
 if(raw.notes&&typeof raw.notes==='object')for(const [id,note] of Object.entries(raw.notes))if(byId.has(id)&&typeof note==='string')out.notes[id]=note.slice(0,4000);
 if(raw.trackNotes&&typeof raw.trackNotes==='object')for(const t of course.tracks)if(typeof raw.trackNotes[t.id]==='string')out.trackNotes[t.id]=raw.trackNotes[t.id].slice(0,12000);
 const s=raw.settings||{};
 if([5,10,20].includes(s.size))out.settings.size=s.size;
 if(typeof s.rate==='number'&&s.rate>=.65&&s.rate<=1.2)out.settings.rate=s.rate;
 for(const lang of ['en','fr'])if(typeof s[lang]==='string')out.settings[lang]=s[lang].slice(0,300);
 out.settings.focus=s.focus===true;
 out.settings.mode=s.mode==='practice'?'practice':'read';
 return out;
}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(state));$('#storage-warning').hidden=true;$('#save-status').textContent='Saved on this device';}
 catch{$('#storage-warning').hidden=false;$('#save-status').textContent='Backup recommended';}
 $('#review-count').textContent=state.bookmarks.length;
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function progress(track){return track.steps.filter(s=>state.completed.includes(s.id)).length;}
function percent(done,total){return done===0?0:done===total?100:Math.max(.1,Math.floor(done/total*1000)/10);}
function bar(done,total){return `<div class="progress" role="progressbar" aria-label="Learning progress" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><span style="width:${done/total*100}%"></span></div>`;}
function trackFor(id){return course.tracks[Number(id.split('-')[0])-1];}
function resumeStep(track){return track.steps.find(s=>!state.completed.includes(s.id))||track.steps[0];}
function navigate(next,focus=true){
 readingObserver?.disconnect();stopSpeech();route=next;reviewing=false;
 document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===next));
 $('#breadcrumb').textContent=next==='library'?'THE COMPLETE COURSE':next==='review'?'ROOM TO PRACTISE':'YOUR OWN PACE';
 if(next==='home')renderHome();else if(next==='library')renderLibrary();else renderReview();
 if(focus){window.scrollTo(0,0);$('#main').focus({preventScroll:true});}
}
const MILESTONES=[
 [1,'First thought','You made a start. That counts.','✦'],
 [5,'First five','Five small moments of attention, all yours.','✿'],
 [10,'Finding a rhythm','Ten steps. Your effort is adding up.','❋'],
 [25,'Growing roots','Twenty-five steps explored, one thought at a time.','♧'],
 [50,'Taking shape','Fifty steps of listening, thinking and trying.','❖'],
 [100,'A hundred thoughts','Look how many times you have shown up for yourself.','✺'],
 [250,'Steady explorer','Two hundred and fifty steps explored.','✧'],
 [500,'A growing journey','Five hundred small steps make a real journey.','✹'],
 [1000,'A thousand moments','A thousand steps of attention and curiosity.','✷'],
 [1535,'The whole conversation','You explored all forty tracks. What a journey.','★']
];
function rewardPanel(compact=false){
 const count=state.completed.length, completeTracks=course.tracks.filter(t=>progress(t)===t.steps.length).length;
 const next=MILESTONES.find(m=>m[0]>count),unlocked=MILESTONES.filter(m=>m[0]<=count),last=unlocked.at(-1);
 if(compact)return `<div class="momentum-strip"><span><strong>${count*10} learning points</strong> · ${count} steps explored</span><button class="plain" data-action="achievements">My milestones ↗</button></div>`;
 const base=last?last[0]:0;
 return `<section class="reward-panel" aria-label="Your learning progress"><div class="row"><div><p class="eyebrow">LOOK HOW FAR YOU HAVE COME</p><h2>Your effort is adding up.</h2></div><button class="plain" data-action="achievements">My milestones ↗</button></div><div class="reward-stats"><div><strong>${count*10}</strong><span>learning points</span></div><div><strong>${count}<small> / ${steps.length}</small></strong><span>steps explored · ${percent(count,steps.length)}%</span></div><div><strong>${completeTracks}<small> / 40</small></strong><span>tracks fully explored</span></div></div>${next?`<div class="next-milestone"><span aria-hidden="true">${next[3]}</span><div><strong>${next[0]-count} more ${next[0]-count===1?'step':'steps'} to “${next[1]}”</strong>${bar(count-base,next[0]-base)}</div></div>`:'<p class="milestone-complete">★ Every course milestone unlocked. Your practice space is always here.</p>'}<p class="reward-note">${last?`${last[3]} Latest milestone: ${last[1]}. `:''}10 points per new step. No lost points, no streak to protect. These celebrate effort, not a test score.</p></section>`;
}
function showAchievements(){
 const count=state.completed.length;
 modal(`<p class="eyebrow">EVERY SMALL STEP COUNTS</p><h2 id="modal-title">Your milestones</h2>${rewardPanel()}<div class="milestone-grid">${MILESTONES.map(m=>`<article class="milestone-badge ${count>=m[0]?'earned':''}"><span aria-hidden="true">${m[3]}</span><h3>${m[1]}</h3><p>${count>=m[0]?m[2]:`${m[0]-count} more steps to explore.`}</p><small>${count>=m[0]?'Unlocked ✓':`${m[0]} steps`}</small></article>`).join('')}</div><p>Your previous progress already counts. Revisiting a step is useful practice, but does not award the same points twice.</p>`);
}
function celebrateStep(count){
 const milestone=MILESTONES.find(m=>m[0]===count);
 if(milestone){
  $('#main').insertAdjacentHTML('afterbegin',`<section class="celebration" role="status"><span class="celebration-symbol" aria-hidden="true">${milestone[3]}</span><div><small>MILESTONE UNLOCKED · +10 POINTS</small><strong>${milestone[1]}</strong><p>${milestone[2]}</p></div><button class="plain" data-action="dismiss-reward" aria-label="Dismiss milestone celebration">×</button></section>`);
 }else toast(`+10 learning points · ${count} steps explored. A little further.`);
}
function languageText(audio,fallback){return audio?.length?audio.map(run=>`<span lang="${run.lang}" class="${run.lang==='fr'?'french-phrase':''}">${esc(run.text)}</span>`).join(''):esc(fallback);}

function renderHome(){
 const step=byId.get(state.cursor)||steps[0], track=trackFor(step.id), done=progress(track), all=state.completed.length;
 $('#main').innerHTML=`<section class="hero"><div><span class="pill">✦ &nbsp; FRENCH, ONE THOUGHT AT A TIME</span><h1>Make room for<br>a little <em>French.</em></h1><p class="intro">Listen. Think it through. Say it out loud.<br>You don’t need to learn it all today. Just take the next small step.</p></div><div><div class="hero-art" aria-hidden="true"><div class="art-oval"></div><div class="art-line"></div><span class="art-star">✳</span><div class="word-card">bonjour.<small>LET’S BEGIN HERE</small></div><div class="word-card second">petit à petit<small>LITTLE BY LITTLE</small></div><span class="art-dot">↗</span></div><p class="hero-caption">A LITTLE CURIOSITY GOES A LONG WAY</p></div></section>
 <section class="dashboard-grid"><div class="continue-card"><div class="row"><span class="eyebrow" style="margin:0">${all?'PICK UP WHERE YOU LEFT OFF':'YOUR FIRST SMALL STEP'}</span><span class="subtle">${percent(all,steps.length)}% of course</span></div><h2>Track ${track.id.toString().padStart(2,'0')}</h2><p>A continuous reading space, with optional speaking practice.<br>${done} of ${track.steps.length} steps explored in this track.</p>${bar(done,track.steps.length)}<div class="row subtle"><span>Introduction to French</span><span>40 tracks · Your pace</span></div><button class="primary wide" data-action="begin">${all?'Continue learning':'Begin a small session'} <span aria-hidden="true">→</span></button></div>
 <div class="rhythm-card"><span class="eyebrow">MAKE IT MANAGEABLE</span><h3>Find your rhythm.</h3><p>For speaking practice, choose a small group of steps.<br>Continuous reading has no forced pauses.</p><div class="segmented" aria-label="Session size">${[5,10,20].map(n=>`<button data-size="${n}" class="${state.settings.size===n?'selected':''}" aria-pressed="${state.settings.size===n}">${n} steps</button>`).join('')}</div><p class="footnote">No timer. You can pause whenever you need.</p></div></section>
 ${rewardPanel()}<section><div class="section-title"><h2>Your path through French</h2><button class="plain" data-route="library">Explore all 40 tracks &nbsp; ↗</button></div><div class="path-grid">${course.tracks.slice(Math.min(Math.max(track.id-1,0),36),Math.min(Math.max(track.id-1,0),36)+4).map(t=>`<button class="path-card ${t.id===track.id?'current':''}" data-track="${t.id}"><span class="track-number">${String(t.id).padStart(2,'0')}</span><h3>Track ${t.id}</h3><p>${progress(t)===t.steps.length?'Explored ✓':progress(t)?`${progress(t)} / ${t.steps.length} steps`:`${t.steps.length} small steps`}</p></button>`).join('')}</div></section>`;
}
function renderLibrary(){
 $('#main').innerHTML=`<section class="section-header"><p class="eyebrow">EVERY CONVERSATION, IN ORDER</p><h1>A whole course.<br><em>One small step at a time.</em></h1><p class="intro">All 40 tracks, in the original English and French. Start anywhere, or follow the conversation from the beginning.</p></section><label for="search" class="sr-only">Search all original course text or track numbers</label><input class="search" id="search" type="search" placeholder="Find a phrase, a word, or a track…" autocomplete="off"><div id="library-results"></div>`;
 renderSearch('');$('#search').addEventListener('input',e=>renderSearch(e.target.value));
}
function excerpt(text,q){let p=text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());if(p<0)p=0;const start=Math.max(0,p-65);return (start?'…':'')+text.slice(start,start+220)+(text.length>start+220?'…':'');}
function renderSearch(query){
 const q=query.trim(), container=$('#library-results');
 if(!q){container.innerHTML=`<div class="library-grid">${course.tracks.map(t=>`<button class="library-card" data-track="${t.id}"><div class="row"><span class="track-number">${String(t.id).padStart(2,'0')}</span><span class="subtle">SOURCE p. ${t.page}</span></div><h3>Track ${t.id}</h3><p>${esc(excerpt(t.steps[0].text,'').slice(0,115))}…</p>${bar(progress(t),t.steps.length)}<span class="subtle">${progress(t)} / ${t.steps.length} steps explored</span></button>`).join('')}</div>`;return;}
 const number=/^(?:track\s*)?(\d+)$/i.exec(q);
 const matches=steps.filter(s=>number?trackFor(s.id).id===+number[1]:(s.text+' '+s.responses.map(r=>r.text).join(' ')).toLocaleLowerCase().includes(q.toLocaleLowerCase()));
 container.innerHTML=`<p class="subtle" role="status">${matches.length} matching steps${matches.length>100?' · Showing the first 100. Refine your search for more.':''}</p>`+matches.slice(0,100).map(s=>`<button class="search-result" data-step="${s.id}"><strong>Track ${trackFor(s.id).id} · Step ${s.index+1}</strong><span>${esc(excerpt(s.text.toLocaleLowerCase().includes(q.toLocaleLowerCase())?s.text:s.responses.map(r=>r.text).join(' ')||s.text,q))}</span></button>`).join('')+(!matches.length?'<div class="empty">No matching passages. Try a shorter phrase or a track number.</div>':'');
}
function renderReview(){
 const saved=state.bookmarks.map(id=>byId.get(id));
 $('#main').innerHTML=`<section class="section-header"><p class="eyebrow">A LITTLE MORE PRACTICE</p><h1>Give it <em>another thought.</em></h1><p class="intro">Save any step with “Keep in practice”. Come back, think it through, and remove it when you feel ready.</p></section>${saved.length?`<p class="subtle">${saved.length} saved ${saved.length===1?'step':'steps'} · No deadlines</p>`+saved.map(s=>`<button class="search-result" data-review="${s.id}"><strong>Track ${trackFor(s.id).id} · Step ${s.index+1}</strong><span>${esc(excerpt(s.text,''))}</span></button>`).join(''):'<div class="empty"><h2>A little room to return to.</h2><p>Your saved steps will appear here.<br>There’s no need to get everything on the first try.</p><button class="primary" data-action="begin">Start learning &nbsp; →</button></div>'}`;
}
function begin(id=state.cursor,review=false,reset=true){
 if(!byId.has(id))id=steps[0].id;
 reviewing=review;if(reset){sessionCount=0;sessionSeen=new Set();}
 openStep(id);
}
function openStep(id){
 readingObserver?.disconnect();stopSpeech();current=byId.get(id);revealed=false;hidden=false;route='lesson';
 if(!reviewing){state.cursor=id;save();}
 document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===(reviewing?'review':'home')));
 $('#breadcrumb').textContent=`${reviewing?'PRACTICE':'YOUR CONVERSATION'} / TRACK ${trackFor(id).id}`;
 renderLesson();window.scrollTo(0,0);if(!reviewing&&state.settings.mode==='read'&&current.index>0)document.getElementById('reading-'+id)?.scrollIntoView({block:'start'});$('#main').focus({preventScroll:true});
}
// Paragraphs follow complete expressions and questions, not speaker turn length.
// Offsets retain every original character and its language for playback.
function readingBlocks(step){
 const runs=step.audio?.length?step.audio:[{lang:'en',text:step.text}];
 const text=runs.map(r=>r.text).join('');
 let at=0;
 const spans=runs.map(run=>{const start=at;at+=run.text.length;return {...run,start,end:at};});
 const cuts=new Set([0,text.length]);
 for(const match of text.matchAll(/[.!?]+[”’"']*(?:\s+|$)/g))cuts.add(match.index+match[0].length);
 // An expression introduced by a dash is an example, rather than an inline term.
 for(const span of spans)if(span.lang==='fr'&&/[–—:]\s*$/.test(text.slice(0,span.start)))cuts.add(span.start);
 const offsets=[...cuts].sort((a,b)=>a-b),blocks=[];
 const slice=(start,end)=>spans.flatMap(run=>{const value=text.slice(Math.max(start,run.start),Math.min(end,run.end));return Math.max(start,run.start)<Math.min(end,run.end)?[{lang:run.lang,text:value}]:[];});
 for(let i=0;i<offsets.length-1;i++){
  const start=offsets[i],end=offsets[i+1],audio=slice(start,end);
  const first=audio.find(r=>r.text.trim()),kind=first?.lang==='fr'?'expression':/\?\s*$/.test(text.slice(start,end))?'question':'explanation';
  const last=blocks.at(-1);
  if(last&&kind==='explanation'&&last.kind===kind&&last.text.length<320){last.text+=text.slice(start,end);last.audio.push(...audio);}
  else blocks.push({kind,text:text.slice(start,end),audio});
 }
 return blocks;
}
function readingParagraphs(step){
 return readingBlocks(step).map((block,index)=>`<div class="reading-line ${block.kind}"><p>${languageText(block.audio,block.text)}</p><button class="line-listen" data-read-audio="${step.id}" data-read-block="${index}" aria-label="Listen to paragraph ${index+1} of step ${step.index+1}">▷ Listen</button></div>`).join('');
}
function showTrackNotes(){
 const track=trackFor(current.id),oldNotes=track.steps.filter(s=>state.notes[s.id]);
 modal(`<p class="eyebrow">YOUR LEARNING NOTES</p><h2 id="modal-title">Track ${track.id} notes</h2><label for="track-note">One place for this lesson’s ideas and expressions</label><textarea id="track-note" maxlength="12000" placeholder="What would you like to remember?">${esc(state.trackNotes[track.id]||'')}</textarea>${oldNotes.length?`<details><summary>Saved practice & earlier passage notes (${oldNotes.length})</summary>${oldNotes.map(s=>`<h3>Step ${s.index+1}</h3><p class="saved-note">${esc(state.notes[s.id])}</p>`).join('')}</details>`:''}`);
 $('#track-note').addEventListener('input',e=>{state.trackNotes[track.id]=e.target.value;save();});
}
function readingGroups(track){
 const groups=[];
 for(let i=0;i<track.steps.length;i+=6)groups.push(track.steps.slice(i,i+6));
 return groups;
}
function readerTitle(group,index){
 const phrases=group.flatMap(s=>(s.audio||[]).filter(r=>r.lang==='fr').flatMap(r=>r.text.split(/[.,;!?]+/)).map(t=>t.trim()).filter(t=>t.length>2&&t.length<50));
 const seen=new Set(),unique=phrases.filter(t=>{const key=t.toLocaleLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
 return unique.length?unique.slice(0,2).join(' · '):`Reading ${index+1}`;
}
function renderReader(){
 const track=trackFor(current.id),groups=readingGroups(track);
 $('#main').innerHTML=`<section class="lesson-heading"><div class="row"><p class="eyebrow">READ AT YOUR OWN PACE</p><button class="plain" data-route="home">Save & leave ↗</button></div><h1>Track ${String(track.id).padStart(2,'0')} <span class="subtle">/ Reading</span></h1><p class="intro">Follow the ideas. Keep scrolling when you’re ready.</p><div class="reader-toolbar"><button class="secondary" data-action="practice-mode">Switch to speaking practice</button><button class="secondary" data-action="track-notes">Lesson notes</button><button class="plain" data-action="transcript">Original transcript ↗</button></div><p class="reader-help">Explanations appear once. Student attempts are optional references, not answer keys. Mark a section explored when you choose; scrolling only saves your place.</p><div class="reading-legend"><span class="teacher-key">Teacher · explanations & examples</span><span class="student-key">Student · optional attempts</span></div><p id="reader-progress" role="status">${progress(track)} / ${track.steps.length} steps explored</p></section>
 <div class="reading-layout"><nav class="reading-outline" aria-label="Reading sections"><p class="eyebrow">IN THIS TRACK</p>${groups.map((g,i)=>`<a href="#reading-${g[0].id}">${String(i+1).padStart(2,'0')} · ${esc(readerTitle(g,i))}</a>`).join('')}</nav><div class="reading-stream">${groups.map((group,i)=>`<section class="reading-section" aria-labelledby="section-${i}"><header><p class="eyebrow">${String(i+1).padStart(2,'0')} / ${String(groups.length).padStart(2,'0')} · STEPS ${group[0].index+1}–${group.at(-1).index+1}</p><h2 id="section-${i}">${esc(readerTitle(group,i))}</h2></header>${group.map(step=>`<article class="reading-passage" id="reading-${step.id}" data-reading-id="${step.id}"><div class="reading-copy">${readingParagraphs(step)}</div><button class="passage-save plain" data-read-bookmark="${step.id}" aria-label="${state.bookmarks.includes(step.id)?'Remove step from practice':'Save step for practice'}" aria-pressed="${state.bookmarks.includes(step.id)}">${state.bookmarks.includes(step.id)?'✓ Saved':'+ Practice'}</button></article>`).join('')}
 ${group.some(s=>s.responses.length)?`<details class="student-reference"><summary>Student attempts · optional reference</summary><p class="subtle">These may contain mistakes. Corrections remain in the main reading, in source order.</p>${group.filter(s=>s.responses.length).map(s=>`<div class="student-attempt"><small>Student · after step ${s.index+1}</small>${s.responses.map(r=>`<p>${languageText(r.audio,r.text)}</p>`).join('')}</div>`).join('')}</details>`:''}
 <button class="secondary section-complete" data-read-complete="${i}" aria-pressed="${group.every(s=>state.completed.includes(s.id))}">${group.every(s=>state.completed.includes(s.id))?'✓ Section explored':'Mark this section explored'}</button></section>`).join('')}
 <footer class="reading-end"><h2>A good place to pause.</h2><p>Your reading place is saved. Continue whenever you feel ready.</p>${course.tracks[track.id]?`<button class="primary" data-track="${track.id+1}">Next track →</button>`:''}<button class="secondary" data-route="home">Save & leave</button></footer></div></div>
 <div class="reader-audio"><button class="audio-button" data-action="pause-speech">Ⅱ Pause</button><button class="audio-button" data-action="stop-speech">□ Stop</button><button class="audio-button" data-action="speak-selection">▷ Selected French</button><span class="audio-status" role="status"></span></div>`;
 readingObserver=new IntersectionObserver(entries=>{
  if(route!=='lesson'||state.settings.mode!=='read')return;
  const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
  if(visible.length){current=byId.get(visible[0].target.dataset.readingId);state.cursor=current.id;save();}
 },{rootMargin:'-15% 0px -55% 0px',threshold:0});
 document.querySelectorAll('[data-reading-id]').forEach(el=>readingObserver.observe(el));
 updateAudioButtons();
}
function completeReadingSection(button){
 const track=trackFor(current.id),group=readingGroups(track)[Number(button.dataset.readComplete)];
 for(const step of group)if(!state.completed.includes(step.id))state.completed.push(step.id);
 save();button.textContent='✓ Section explored';button.setAttribute('aria-pressed','true');
 $('#reader-progress').textContent=`${progress(track)} / ${track.steps.length} steps explored`;
}
function renderLesson(){
 if(!reviewing&&state.settings.mode==='read'){renderReader();return;}
 const t=trackFor(current.id),s=current,bookmarked=state.bookmarks.includes(s.id),hasResponse=s.responses.length>0;
 $('#main').innerHTML=`<section class="lesson-heading"><div class="row"><p class="eyebrow" style="margin:0">${reviewing?'BACK FOR ANOTHER LOOK':'INTRODUCTION TO FRENCH'}</p><button class="plain" data-route="${reviewing?'review':'home'}">Save & leave ↗</button></div><h1>Track ${String(t.id).padStart(2,'0')} <span class="subtle">/ ${reviewing?'Practice':`Step ${s.index+1} of ${t.steps.length}`}</span></h1>${bar(progress(t),t.steps.length)}<div class="row subtle"><span>${progress(t)} steps explored in this track</span><span>${sessionCount} / ${state.settings.size} in this session</span></div></section>
 ${reviewing?'':'<button class="secondary mode-switch" data-action="reading-mode">Continuous reading ↗</button>'}${rewardPanel(true)}<div class="lesson-layout"><article class="lesson-card"><div class="lesson-card-header"><span class="eyebrow">${hasResponse?'LISTEN → THINK → SPEAK':'LISTEN & NOTICE'}</span><button class="bookmark" data-action="bookmark" aria-pressed="${bookmarked}">${bookmarked?'✓ Saved for practice':'+ Keep in practice'}</button></div><div class="lesson-content"><div class="row"><span class="speaker-label">THE TEACHER · ORIGINAL TRANSCRIPT${s.parts>1?` · passage ${s.part}/${s.parts}`:''}</span><button class="plain" data-action="hide-text">Hide text</button></div>
 <div class="audio-bar"><button class="audio-button" data-speak="teacher" data-lang="en">▷ Read passage · English + French</button><button class="audio-button" data-action="pause-speech" aria-label="Pause or resume speech">Ⅱ Pause</button><button class="audio-button" data-action="stop-speech">□ Stop</button></div><p class="audio-status" role="status">English + French voices · Language switches follow the original PDF. French phrases are underlined.</p>
 <p class="teacher-text" id="teacher-text">${languageText(s.audio,s.text)}</p><div class="step-hidden" id="hidden-text" hidden>Take your time.<br>Keep the thought in your mind.</div><button class="audio-button" data-action="speak-selection">▷ Read selected text in French</button>
 ${hasResponse?`<section class="think-panel"><h3>Your turn. Pause before you peek.</h3><p>Think it through, then say your response out loud. Some turns ask a question; others invite you to repeat a sound.</p><label for="note">Optional scratchpad · Your words, not a graded test</label><textarea id="note" maxlength="4000" placeholder="You can think out loud instead…">${esc(state.notes[s.id]||'')}</textarea></section><button class="secondary wide" data-action="reveal" aria-expanded="false" aria-controls="answer">I’ve tried — show the conversation ↓</button><section class="answer-box" id="answer" hidden><h3>What the student said</h3><p class="answer-note">Original student response — it may contain mistakes. Follow the teacher’s feedback below; this is not an answer key.</p><div class="original-response">${s.responses.map(r=>`<p>${esc(r.text)}</p>`).join('')}</div><button class="audio-button" data-speak="response" data-lang="fr">▷ Read student response · French voice</button>${s.followup?`<h3 style="margin-top:23px">The teacher’s follow-up</h3><p class="followup">${languageText(s.followupAudio,s.followup)}</p><button class="audio-button" data-speak="followup" data-lang="en">▷ Read teacher’s follow-up · English + French</button>`:'<p class="subtle">The conversation continues in the next track.</p>'}</section>`:''}
 ${!hasResponse?`<label for="note">Practice notes</label><textarea id="note" maxlength="4000">${esc(state.notes[s.id]||'')}</textarea>`:''}<button class="plain" data-action="track-notes">Lesson notes ↗</button><div class="lesson-controls"><button class="secondary" data-action="previous" ${s.index===0?'disabled':''}>← Back</button><button class="primary" data-action="next" ${hasResponse?'disabled':''}>${reviewing?'Finish this practice':hasResponse?'I’m ready — continue':'I’ve read this — continue'} &nbsp; →</button></div><button class="source-link plain" data-action="transcript">Open full transcript · passage starts on PDF p. ${s.page}</button></div></article>
 <aside class="session-panel" aria-label="Session guidance"><p class="eyebrow">JUST A SMALL SESSION</p><h3>A little is enough.</h3><div class="session-dots" aria-hidden="true">${Array.from({length:state.settings.size},(_,i)=>`<span class="${i<sessionCount?'done':''}"></span>`).join('')}</div><p>${state.settings.size-sessionCount} steps until a gentle pause. There is no timer to beat.</p><hr><p>“DO NOT LOOK AT THE TRANSCRIPTS WHILST YOU ARE BUILDING YOUR SENTENCES.”</p><p class="subtle">— Original course guidance</p><button class="plain" data-action="break">Take a break now ↗</button><button class="plain" data-action="settings">Audio & preferences ↗</button></aside></div>`;
 const note=$('#note');if(note)note.addEventListener('input',()=>{state.notes[s.id]=note.value;save();});
 updateAudioButtons();
}
function next(){
 if(current.responses.length&&!revealed)return;
 stopSpeech();
 if(reviewing){toast('Practice complete. Your place in the course is unchanged.');navigate('review');return;}
 const isNew=!state.completed.includes(current.id);
 if(isNew)state.completed.push(current.id);
 if(!sessionSeen.has(current.id)){sessionCount++;sessionSeen.add(current.id);}
 const t=trackFor(current.id),next=t.steps[current.index+1];
 if(next){state.cursor=next.id;save();if(sessionCount>=state.settings.size)renderBreak();else openStep(next.id);}
 else{
  const nextTrack=course.tracks[t.id];state.cursor=nextTrack?resumeStep(nextTrack).id:current.id;save();renderTrackEnd(t,nextTrack);
 }
 if(isNew)celebrateStep(state.completed.length);
}
function renderBreak(){
 stopSpeech();route='break';
 $('#main').innerHTML=`<section class="lesson-end"><div class="end-symbol" aria-hidden="true">✳</div><p class="eyebrow">A GOOD PLACE TO PAUSE</p><h1>You made a little <em>space.</em></h1><p>${sessionCount?`You explored ${sessionCount} ${sessionCount===1?'step':'steps'} in this session.`:'Your place is saved.'}<br>Look away from the screen. Stretch. Let your thoughts settle.</p><p class="break-note">You can come back exactly where you left off.</p>${rewardPanel()}<div class="button-row"><button class="primary" data-action="begin">Another small session →</button><button class="secondary" data-route="home">Done for now</button></div></section>`;
 window.scrollTo(0,0);$('#main').focus();
}
function renderTrackEnd(t,nextTrack){
 route='track-end';const complete=progress(t)===t.steps.length;
 $('#main').innerHTML=`<section class="lesson-end"><div class="end-symbol" aria-hidden="true">✳</div><p class="eyebrow">${complete?'TRACK EXPLORED':'END OF THIS TRACK'}</p><h1>A little <em>further.</em></h1><p>${complete?`You explored every step in Track ${t.id}.`:`You reached the end of Track ${t.id}. ${t.steps.length-progress(t)} earlier steps are still unexplored.`}<br>${state.completed.length===steps.length?'You have explored all 40 tracks. Congratulations. Return to your saved practice whenever you like.':'Take a breath. Your progress is saved.'}</p>${rewardPanel()}<div class="button-row">${!complete?`<button class="primary" data-step="${resumeStep(t).id}">Return to unexplored steps →</button>`:nextTrack?`<button class="primary" data-track="${nextTrack.id}">Continue to Track ${nextTrack.id} →</button>`:''}<button class="secondary" data-route="home">Done for now</button><button class="secondary" data-route="review">My practice</button></div></section>`;
 window.scrollTo(0,0);$('#main').focus();
}
function modal(html){stopSpeech();$('#modal-body').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function showTranscript(){
 const t=trackFor(current.id);
 modal(`<p class="eyebrow">ORIGINAL COURSE · REFERENCE VIEW</p><h2 id="modal-title">Track ${t.id} transcript</h2><p>Includes the original student’s attempts, mistakes, and teacher corrections. Use this for reference after thinking through your own response.</p><p><a href="${encodeURI(course.source)}#page=${current.page}" target="_blank" rel="noopener">Open original PDF at page ${current.page} ↗</a></p>${t.turns.map(turn=>`<div class="transcript-turn"><strong>${turn.speaker==='teacher'?'Teacher':'Student'} · p. ${turn.page}</strong>${esc(turn.text)}</div>`).join('')}`);
}
function showAbout(){modal(`<p class="eyebrow">THE ORIGINAL CONVERSATION</p><h2 id="modal-title">Think your way into French.</h2><p>This independent study companion contains all 40 tracks of <strong>Language Transfer’s Introduction to French</strong>, from your supplied 157-page transcript. Course text stays in its original English and French. Only whitespace and step boundaries have been adjusted; transcription errors and the student’s mistakes are retained.</p><p>Continuous reading presents each explanation once, with optional student references. Switch to speaking practice to think and speak before revealing a response. Progress means “explored”, not “mastered”.</p><p><strong>Audio:</strong> this app uses your device’s speech synthesis, not the original recordings. Teacher passages and follow-ups switch between English and French using language markings recovered from the PDF. Missing or inconsistent source formatting can be overridden by selecting a phrase and using the French voice button. A missing French voice is reported instead of using an English voice. Synthesized pronunciation and phonetic notation may be imperfect. For the original course recordings, visit <a href="https://www.languagetransfer.org/french" target="_blank" rel="noopener">Language Transfer ↗</a>.</p><p><strong>On iPad:</strong> open the hosted app in Safari. For a home-screen app, choose Share → Add to Home Screen. Offline caching requires HTTPS (or localhost for development), a successful initial load, and available browser storage. Device voices may need to be downloaded in iPad settings.</p><p><strong>Your data:</strong> no account, microphone, analytics, or uploaded answers. Progress stays in this browser. Clearing website data, private browsing, a new device, or changing the site address can remove or separate it. Use Audio & preferences to export a backup. iPad may evict website storage.</p><p><a href="${encodeURI(course.source)}" target="_blank" rel="noopener">Read the original PDF ↗</a> · <button class="plain" data-action="settings">Audio & preferences</button></p><details><summary>Original introduction, editor notes & contents</summary><div class="front-matter">${esc(course.frontMatter)}</div></details><p class="subtle">Independent companion; not affiliated with or endorsed by Language Transfer. The course and transcript remain credited to their original creators.</p>`);}
function loadVoices(){voices='speechSynthesis'in window?speechSynthesis.getVoices():[];if($('#voice-en'))fillVoiceSelects();}
function fillVoiceSelects(){
 for(const lang of ['en','fr']){
  const select=$('#voice-'+lang);if(!select)continue;
  const matching=voices.filter(v=>voiceLanguage(v)===lang);
  select.innerHTML='<option value="">'+(matching.length?'Auto-select '+(lang==='en'?'English':'French')+' voice':'No '+(lang==='en'?'English':'French')+' voice available')+'</option>'+matching.map(v=>`<option value="${esc(v.voiceURI)}">${esc(v.name)} · ${esc(v.lang)}${v.localService?' · on device':''}</option>`).join('');
  select.value=matching.some(v=>v.voiceURI===state.settings[lang])?state.settings[lang]:'';
 }
}
function showSettings(){
 modal(`<p class="eyebrow">MAKE THIS SPACE YOURS</p><h2 id="modal-title">Audio & preferences</h2><p>Voices come from your browser and device. Teacher passages automatically switch voices for English and French. A French voice must be available: the app will never substitute an English voice for it. Nothing plays automatically.</p><div class="field"><label for="voice-en">English narration</label><select id="voice-en"></select></div><div class="field"><label for="voice-fr">French pronunciation</label><select id="voice-fr"></select></div><div class="button-row"><button class="secondary" data-action="test-en">Test English voice</button><button class="secondary" data-action="test-fr">Test French voice</button><button class="secondary" data-action="stop-speech">Stop audio</button></div><p id="voice-status" class="subtle" role="status"></p><div class="field"><label for="rate">Speaking speed <output id="rate-value">${state.settings.rate.toFixed(2)}×</output></label><input type="range" id="rate" min="0.65" max="1.2" step="0.05" value="${state.settings.rate}"></div><div class="field"><label for="session-size">Steps before a gentle pause</label><select id="session-size">${[5,10,20].map(n=>`<option value="${n}" ${state.settings.size===n?'selected':''}>${n} steps</option>`).join('')}</select></div><hr class="dialog-separator"><h3>Your progress, safely in your hands.</h3><p>${state.completed.length} of ${steps.length} steps explored. ${state.bookmarks.length} saved for practice. Export a backup before clearing browser data or switching devices. Backups include your scratchpad notes.</p><div class="button-row"><button class="secondary" data-action="export">Export progress</button><button class="secondary" data-action="import">Import progress</button></div><input id="import-file" type="file" accept="application/json,.json" hidden><hr class="dialog-separator"><p id="offline-status" role="status">Checking offline availability…</p><p class="subtle">An installed app still uses this device’s storage. Keep a backup of anything you want to keep.</p><button class="plain danger" data-action="reset">Reset all progress on this device</button>`);
 loadVoices();
 audioStatus(voices.some(v=>voiceLanguage(v)==='fr')?'French voice available. Use Test French voice to check pronunciation.':'French voice unavailable. On iPad, download a French voice in Settings → Accessibility → Read & Speak (or Spoken Content) → Voices. Reopen Safari, then tap Play again.');
 for(const lang of ['en','fr'])$('#voice-'+lang).addEventListener('change',e=>{state.settings[lang]=e.target.value;save();});
 $('#rate').addEventListener('input',e=>{state.settings.rate=Number(e.target.value);$('#rate-value').textContent=state.settings.rate.toFixed(2)+'×';save();});
 $('#session-size').addEventListener('change',e=>{state.settings.size=Number(e.target.value);save();});
 $('#import-file').addEventListener('change',importProgress);
 checkOffline();
}
async function checkOffline(){
 let message='Offline installation needs an HTTPS website. The standalone HTML can be used without a server in a compatible browser.';
 if('caches'in window&&window.isSecureContext){try{const keys=await caches.keys();message=keys.some(k=>k.startsWith('petit-french-'))?'Course cached for offline use on this device. Voice availability depends on iPad settings.':'Offline cache is not ready yet. Stay online and reload once before using the app offline.';}catch{message='Offline storage is unavailable. You can keep learning while online.';}}
 if($('#offline-status'))$('#offline-status').textContent=message;
}
function audioStatus(message){document.querySelectorAll('.audio-status,#voice-status').forEach(e=>e.textContent=message);}
function updateAudioButtons(){document.querySelectorAll('[data-action="pause-speech"]').forEach(b=>{b.disabled=!speechActive;b.textContent=speechPaused?'▷ Resume':'Ⅱ Pause';});}
function stopSpeech(){speechToken++;if('speechSynthesis'in window)speechSynthesis.cancel();speechActive=false;speechPaused=false;utterance=null;updateAudioButtons();}
function voiceLanguage(voice){return voice.lang.toLowerCase().replace(/_/g,'-').split('-')[0];}
function chooseVoice(lang){
 const matches=voices.filter(v=>voiceLanguage(v)===lang);
 return matches.find(v=>v.voiceURI===state.settings[lang])||matches.find(v=>v.localService&&v.lang.replace(/_/g,'-').toLowerCase()===(lang==='fr'?'fr-fr':'en-gb'))||matches.find(v=>v.localService)||matches[0];
}
function speak(text,lang){speakSegments([{text,lang}]);}
function speakSegments(segments){
 stopSpeech();
 if(!('speechSynthesis'in window)){audioStatus('Speech is unavailable in this browser. Text learning still works.');toast('This browser has no speech synthesis. Try Safari on iPad.');return;}
 // Refresh on every gesture: Safari often exposes its voices after initial load.
 loadVoices();
 const queue=[];
 for(const segment of segments){
  const cleaned=segment.text.replace(/_/g,' ').trim();if(!cleaned)continue;
  const pieces=cleaned.match(/[^.!?]+[.!?]*\s*/g)||[cleaned];
  for(const piece of pieces){let rest=piece;while(rest.length>230){let cut=rest.lastIndexOf(' ',220);if(cut<1)cut=220;queue.push({text:rest.slice(0,cut),lang:segment.lang});rest=rest.slice(cut).trim();}if(rest.trim())queue.push({text:rest,lang:segment.lang});}
 }
 if(!queue.length)return;
 const selected=new Map();
 for(const {lang} of queue){
  if(selected.has(lang))continue;
  const voice=chooseVoice(lang);
  if(!voice){
   const name=lang==='fr'?'French':'English';
   audioStatus(`${name} voice unavailable. On iPad, download a ${name} voice in Settings → Accessibility → Read & Speak (or Spoken Content) → Voices. Reopen Safari, then tap Play again.`);
   toast(`${name} voice not ready. Open Audio for voice setup; no substitute voice will be played.`);return;
  }
  selected.set(lang,voice);
 }
 const token=speechToken;let index=0;speechActive=true;
 const play=()=>{
  if(token!==speechToken)return;
  if(index>=queue.length){speechActive=false;speechPaused=false;utterance=null;updateAudioButtons();audioStatus('Finished. Take a moment to think, then continue when you’re ready.');return;}
  const part=queue[index++],voice=selected.get(part.lang);
  utterance=new SpeechSynthesisUtterance(part.text);utterance.voice=voice;utterance.lang=voice.lang.replace(/_/g,'-');utterance.rate=state.settings.rate;
  audioStatus(`${part.lang==='fr'?'French':'English'} · ${voice.name} · ${state.settings.rate.toFixed(2)}×`);
  utterance.onend=play;
  utterance.onerror=()=>{if(token!==speechToken)return;speechActive=false;speechPaused=false;updateAudioButtons();audioStatus('Voice playback was interrupted or unavailable. Try again, or choose a downloaded voice in Audio.');};
  speechSynthesis.speak(utterance);
 };
 updateAudioButtons();play();
}
function exportProgress(){
 const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='petit-a-petit-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Progress backup prepared. Save it in Files.');
}
async function importProgress(e){
 const file=e.target.files[0];if(!file)return;
 try{if(file.size>3_000_000)throw Error('That file is too large for a progress backup.');const imported=validate(JSON.parse(await file.text()));if(!confirm(`Replace current progress with this backup (${imported.completed.length} explored steps)? Export your current progress first if you want to keep it.`))return;state=imported;save();applyFocus();$('#modal').close();navigate('home');toast('Progress restored. Welcome back.');}
 catch(error){toast('Could not import: '+error.message);}finally{e.target.value='';}
}
function applyFocus(){document.body.classList.toggle('focus',state.settings.focus);$('#focus-toggle').setAttribute('aria-pressed',state.settings.focus);$('#focus-toggle').textContent=state.settings.focus?'Exit focus mode':'Focus mode';}
function reveal(){if(!current||!current.responses.length)return;revealed=true;$('#answer').hidden=false;const button=$('[data-action="reveal"]');button.textContent='Conversation revealed';button.setAttribute('aria-expanded','true');$('[data-action="next"]').disabled=false;$('#answer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
async function handleAction(action){
 if(action==='begin')begin();
 else if(action==='reading-mode'||action==='practice-mode'){state.settings.mode=action==='reading-mode'?'read':'practice';save();openStep(current.id);}
 else if(action==='track-notes')showTrackNotes();
 else if(action==='achievements')showAchievements();
 else if(action==='dismiss-reward')$('.celebration')?.remove();
 else if(action==='settings')showSettings();
 else if(action==='about')showAbout();
 else if(action==='close-dialog'){$('#modal').close();}
 else if(action==='bookmark'){const i=state.bookmarks.indexOf(current.id);if(i<0)state.bookmarks.push(current.id);else state.bookmarks.splice(i,1);save();const b=$('[data-action="bookmark"]');b.setAttribute('aria-pressed',i<0);b.textContent=i<0?'✓ Saved for practice':'+ Keep in practice';toast(i<0?'Saved for another thought.':'Removed from practice.');}
 else if(action==='hide-text'){hidden=!hidden;$('#teacher-text').hidden=hidden;$('#hidden-text').hidden=!hidden;$('[data-action="hide-text"]').textContent=hidden?'Show text':'Hide text';}
 else if(action==='reveal')reveal();
 else if(action==='next')next();
 else if(action==='previous'){const t=trackFor(current.id);if(current.index>0)openStep(t.steps[current.index-1].id);}
 else if(action==='break')renderBreak();
 else if(action==='transcript')showTranscript();
 else if(action==='stop-speech'){stopSpeech();audioStatus('Audio stopped. Play again whenever you’re ready.');}
 else if(action==='pause-speech'){if(!speechActive)return;speechPaused=!speechPaused;if(speechPaused)speechSynthesis.pause();else speechSynthesis.resume();updateAudioButtons();audioStatus(speechPaused?'Audio paused.':'Audio resumed.');}
 else if(action==='speak-selection'){const selected=window.getSelection()?.toString().trim();if(selected)speak(selected.slice(0,8000),'fr');else toast('Select a French phrase in the passage, then tap this button.');}
 else if(action==='test-en')speak('Take your time. Think it through, then say it out loud.','en');
 else if(action==='test-fr')speak('Bonjour. Je veux le café. Petit à petit.','fr');
 else if(action==='export')exportProgress();
 else if(action==='import')$('#import-file').click();
 else if(action==='reset'){if(confirm('Delete all explored steps, practice bookmarks and notes on this device? Export a backup first if you want to keep them.')){state=defaults();save();applyFocus();$('#modal').close();navigate('home');toast('A fresh start.');}}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,a.brand');if(!b||!state)return;
 if(b.matches('a.brand')){e.preventDefault();navigate('home');}
 else if(b.dataset.route)navigate(b.dataset.route);
 else if(b.dataset.size){state.settings.size=Number(b.dataset.size);save();renderHome();}
 else if(b.dataset.track)begin(resumeStep(course.tracks[Number(b.dataset.track)-1]).id);
 else if(b.dataset.step)begin(b.dataset.step);
 else if(b.dataset.review)begin(b.dataset.review,true);
 else if(b.dataset.readComplete!==undefined)completeReadingSection(b);
 else if(b.dataset.readAudio){const step=byId.get(b.dataset.readAudio);speakSegments(b.dataset.readBlock!==undefined?readingBlocks(step)[Number(b.dataset.readBlock)].audio:step.audio);}
 else if(b.dataset.readBookmark){const id=b.dataset.readBookmark,i=state.bookmarks.indexOf(id);if(i<0)state.bookmarks.push(id);else state.bookmarks.splice(i,1);save();b.setAttribute('aria-pressed',i<0);b.textContent=i<0?'✓ Saved':'+ Practice';b.setAttribute('aria-label',i<0?'Remove step from practice':'Save step for practice');}
 else if(b.dataset.speak){const segments=b.dataset.speak==='teacher'?current.audio:b.dataset.speak==='response'?current.responses.flatMap(r=>r.audio):current.followupAudio;speakSegments(segments);}
 else if(b.dataset.action)handleAction(b.dataset.action);
});
$('#focus-toggle').addEventListener('click',()=>{if(!state)return;state.settings.focus=!state.settings.focus;applyFocus();save();});
$('#modal').addEventListener('close',()=>{stopSpeech();if(route==='home')renderHome();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();});
window.addEventListener('pagehide',()=>{stopSpeech();});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)toast('Progress changed in another tab. Reload before continuing here.');});
if('speechSynthesis'in window)speechSynthesis.addEventListener('voiceschanged',loadVoices);
async function init(){
 try{
 course=window.EMBEDDED_COURSE||await fetch('assets/course.json').then(r=>{if(!r.ok)throw Error('Course data could not be loaded.');return r.json();});
 for(const t of course.tracks)t.steps.forEach((s,index)=>{s.index=index;steps.push(s);byId.set(s.id,s);});
 let damaged=false;try{const saved=localStorage.getItem(KEY);state=saved?validate(JSON.parse(saved)):defaults();}catch{state=defaults();damaged=true;}
 applyFocus();save();navigate('home',false);loadVoices();
 if(damaged)toast('Saved progress could not be read. Import a backup if you have one.');
 if('serviceWorker'in navigator&&window.isSecureContext&&!window.EMBEDDED_COURSE){navigator.serviceWorker.register('./sw.js').catch(()=>{toast('Offline setup unavailable; online learning still works.');});}
 }catch(error){$('#main').innerHTML=`<section class="empty"><h1>Let’s try that again.</h1><p>${esc(error.message)}</p><p>Serve this folder over HTTP, or open the generated standalone HTML. If offline, reconnect once to download the course.</p><button class="primary" onclick="location.reload()">Try again</button></section>`;}
}
init();
})();
