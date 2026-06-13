
var currentModalId=null;




// ============================================================
// STATE VARIABLES
// ============================================================
var apiKey = '', trText = '', huText = '', selWords = new Set();
var selectedLevel = 'B1', genDir = 'en', trOutLang = 'en';
var writingDir = 'en-hu', genSelectedTopic = '';
var writingType = 'general', emailTone = 'formal';
var allCards = JSON.parse(localStorage.getItem('anki_cards') || '[]');
var oxWords = [], oxPhrases = [];
var exState = 'idle';
var currentExIdx = 0, exScore = {correct:0, total:0}, exerciseQueue = [];
var selectedTenses = new Set();
var compQuestions = [];
var convoLevel = 'B1', convoHistory = [], convoSystemPrompt = '';
// TTS minden betöltéskor bekapcsolva indul; a 🔊 gomb csak az adott munkamenetre kapcsolja ki
var convoErrors = [], convoRecog = null, convoListening = false;
var convoTTSEnabled = true;
var convoSelectedTopic = '';
var phrasePageIdx = 0, PHRASE_PAGE_SIZE = 50;
var phraseRunning = false, phraseQueue = [], phraseIdx = 0;
var phraseStats = {uploaded:0, failed:0, total:0};
var bulkQueue = [], bulkIdx = 0, bulkRunning = false;
var bulkStats = {uploaded:0, skipped:0, failed:0, total:0};
var oxPage = 0, OX_PAGE_SIZE = 50;

// ============================================================
// SZINKRON TÁROLÓ — localStorage cache + Cloudflare D1 write-through
// ============================================================
var Store = (function(){
  var _timers = {};
  var DEBOUNCE = 1500;

  function _token(){ return localStorage.getItem('sync_token') || ''; }

  function get(key, fallback){
    var raw = localStorage.getItem(key);
    if(raw === null) return fallback !== undefined ? fallback : null;
    try { return JSON.parse(raw); } catch(e){ return fallback !== undefined ? fallback : null; }
  }

  function set(key, val){
    localStorage.setItem(key, JSON.stringify(val));
    localStorage.setItem(key + '__ts', String(Date.now()));
    clearTimeout(_timers[key]);
    _timers[key] = setTimeout(function(){ _push(key, val); }, DEBOUNCE);
  }

  function _push(key, val){
    var token = _token();
    if(!token) return;
    fetch('/api/store', {
      method: 'PUT',
      headers: {'Content-Type':'application/json','Authorization':'Bearer ' + token},
      body: JSON.stringify({key: key, value: JSON.stringify(val), updated_at: Date.now()})
    }).catch(function(){});
  }

  // Induláskor lekéri a szerver adatait; ha újabb a helyi verziónál, felülírja localStorage-ban
  function pull(){
    var token = _token();
    if(!token) return Promise.resolve();
    return fetch('/api/store', {headers:{'Authorization':'Bearer ' + token}})
      .then(function(r){ return r.json(); })
      .then(function(rows){
        rows.forEach(function(row){
          var localTs = parseInt(localStorage.getItem(row.key + '__ts') || '0', 10);
          if(row.updated_at > localTs){
            localStorage.setItem(row.key, row.value);
            localStorage.setItem(row.key + '__ts', String(row.updated_at));
          }
        });
      })
      .catch(function(){});
  }

  // Az összes fontos kulcs azonnali (nem debounced) D1 push-ja
  function pushAll(onDone){
    var token = _token();
    if(!token){ if(onDone) onDone(0); return; }
    var keys = ['oxford_words','oxford_phrases','anki_cards',
                'practice_hard_mode','active_main','active_tense_tab'];
    var pending = 0;
    keys.forEach(function(k){
      var raw = localStorage.getItem(k);
      if(raw === null) return;
      pending++;
      fetch('/api/store', {
        method: 'PUT',
        headers: {'Content-Type':'application/json','Authorization':'Bearer ' + token},
        body: JSON.stringify({key: k, value: raw, updated_at: Date.now()})
      }).then(function(){ pending--; if(pending===0 && onDone) onDone(keys.length); })
        .catch(function(){ pending--; if(pending===0 && onDone) onDone(keys.length); });
    });
    if(pending===0 && onDone) onDone(0);
  }

  return {get: get, set: set, pull: pull, pushAll: pushAll};
})();

// ============================================================
// CORE UTILITIES
// ============================================================

// ============================================================
// HALADÁSOM PANEL
// ============================================================

// Default document contents

// Load documents from localStorage
function docLoad() {
  Object.keys(DOC_DEFAULTS).forEach(function(key) {
    var stored = localStorage.getItem('doc_' + key);
    var el = document.getElementById('doc-' + key + '-text');
    if (el) el.value = stored || DOC_DEFAULTS[key];
  });
}

function docSave(key) {
  var el = document.getElementById('doc-' + key + '-text');
  if (el) localStorage.setItem('doc_' + key, el.value);
}

function showDoc(key, el) {
  document.querySelectorAll('.doc-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.doc-tab').forEach(function(b) { b.classList.remove('active'); });
  var panel = document.getElementById('doc-' + key);
  if (panel) panel.classList.add('active');
  if (el) el.classList.add('active');
}

function docExportAll() {
  var all = '';
  Object.keys(DOC_DEFAULTS).forEach(function(key) {
    var el = document.getElementById('doc-' + key + '-text');
    if (el) all += el.value + '\n\n---\n\n';
  });
  var blob = new Blob([all], { type: 'text/markdown;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'angol_tanulas_dokumentumok.md';
  a.click();
}

// ============================================================
// OVERVIEW / STATISTICS
// ============================================================

function renderOverviewDonut(active, total){
  var svg = document.getElementById('overview-donut-svg');
  var pctEl = document.getElementById('overview-donut-pct');
  if(!svg) return;
  var pct = total ? Math.round(active/total*100) : 0;
  if(pctEl) pctEl.textContent = total ? active : '—';

  // Draw donut segments: active=green, rest=faint
  var r=22, cx=28, cy=28, strokeW=8;
  var circ = 2*Math.PI*r;
  var activeDash = total ? (active/total)*circ : 0;

  // Remove old paths
  svg.innerHTML = '';
  // Background circle
  var bg = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bg.setAttribute('cx',cx); bg.setAttribute('cy',cy); bg.setAttribute('r',r);
  bg.setAttribute('fill','none'); bg.setAttribute('stroke','var(--border)');
  bg.setAttribute('stroke-width',strokeW);
  svg.appendChild(bg);

  if(total > 0){
    // Active segment
    var seg = document.createElementNS('http://www.w3.org/2000/svg','circle');
    seg.setAttribute('cx',cx); seg.setAttribute('cy',cy); seg.setAttribute('r',r);
    seg.setAttribute('fill','none'); seg.setAttribute('stroke','#22c55e');
    seg.setAttribute('stroke-width',strokeW);
    seg.setAttribute('stroke-dasharray', activeDash+' '+(circ-activeDash));
    seg.setAttribute('stroke-dashoffset', circ/4);
    seg.setAttribute('stroke-linecap','round');
    svg.appendChild(seg);
  }

  // Center text
  var txt = document.createElementNS('http://www.w3.org/2000/svg','text');
  txt.setAttribute('x',cx); txt.setAttribute('y',cy+4);
  txt.setAttribute('text-anchor','middle');
  txt.setAttribute('font-size', active > 999 ? '8' : '10');
  txt.setAttribute('fill','var(--accent)');
  txt.setAttribute('font-family',"'Inter',sans-serif");
  txt.textContent = total ? active : '—';
  svg.appendChild(txt);

  // Label below
  var sub = document.createElementNS('http://www.w3.org/2000/svg','text');
  sub.setAttribute('x',cx); sub.setAttribute('y',cx+14);
  sub.setAttribute('text-anchor','middle');
  sub.setAttribute('font-size','6');
  sub.setAttribute('fill','var(--muted)');
  sub.textContent = total ? 'aktív' : '';
  svg.appendChild(sub);
}

// ============================================================
// NEHÉZ MÓD — igeidő neve rejtett + hint elérhető a Gyakorlás fülön
// ============================================================
var hardMode = Store.get('practice_hard_mode', false);

function toggleHardMode(){
  hardMode = !hardMode;
  Store.set('practice_hard_mode', hardMode);
  updateHardModeBtn();
}

function updateHardModeBtn(){
  var btn = document.getElementById('hard-mode-btn');
  var desc = document.getElementById('hard-mode-desc');
  if(btn) btn.classList.toggle('active', hardMode);
  if(desc) desc.textContent = hardMode
    ? 'Az igeidő neve rejtett — döntsd el magad'
    : 'Az igeidő neve és szintje látható';
}

function toggleGrHint(){
  var body = document.getElementById('gr-hint-body');
  var icon = document.getElementById('gr-hint-icon');
  if(!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if(icon) icon.textContent = open ? '▶' : '▼';
}



// ============================================================
// OXFORD-READY ROADMAP ITEM RENDERER
// ============================================================
function renderRoadmapItem(item, compact){
  var html = '';

  // USE
  if(item.use){
    html += '<div class="rm-section">';
    html += '<div class="rm-section-label">Mikor használjuk</div>';
    html += '<div class="rm-section-body">'+item.use+'</div>';
    html += '</div>';
  }

  // FORM (képzési séma)
  if(item.form && item.form.length){
    html += '<div class="rm-section">';
    html += '<div class="rm-section-label">Képzési séma</div>';
    html += '<div class="rm-form-table">';
    item.form.forEach(function(row){
      var cls = '';
      if(row.indexOf('(+)') === 0) cls = 'rm-form-pos';
      else if(row.indexOf('(-)') === 0) cls = 'rm-form-neg';
      else if(row.indexOf('(?)') === 0) cls = 'rm-form-q';
      html += '<div class="rm-form-row '+cls+'">'+row+'</div>';
    });
    html += '</div></div>';
  }

  // SIGNALS
  if(item.signals && item.signals.length && !compact){
    html += '<div class="rm-section">';
    html += '<div class="rm-section-label">Jellemző szavak / jelzők</div>';
    html += '<div class="rm-signals">';
    item.signals.forEach(function(s){ html += '<span class="rm-signal-chip">'+s+'</span>'; });
    html += '</div></div>';
  }

  // EXAMPLES
  if(item.examples && item.examples.length){
    var exCount = compact ? 2 : 3;
    html += '<div class="rm-section">';
    html += '<div class="rm-section-label">Példák</div>';
    item.examples.slice(0, exCount).forEach(function(ex){
      html += '<div class="modal-example"><div class="ex-en">'+ex.en+'</div><div class="ex-hu">'+ex.hu+'</div></div>';
    });
    html += '</div>';
  }

  // WARNING
  if(item.warning){
    html += '<div class="modal-warning">⚠️ '+item.warning+'</div>';
  }

  // CONTRAST
  if(item.contrast && !compact){
    html += '<div class="rm-section">';
    html += '<div class="rm-section-label">Különbség / összehasonlítás</div>';
    html += '<div class="rm-contrast">'+item.contrast+'</div>';
    html += '</div>';
  }

  return html;
}

function renderGrReference(){
  var list = document.getElementById('gr-reference-list');
  if(!list) return;
  var fLevel = (document.getElementById('ref-filter-level')||{value:''}).value;
  var fCat = (document.getElementById('ref-filter-cat')||{value:''}).value;

  var html = '';
  ROADMAP.forEach(function(band){
    if(fLevel && band.level !== fLevel) return;
    var itemsHtml = '';
    band.items.forEach(function(rmItem){
      var id = rmItem.id;
      var exItem = GRAMMAR_EXERCISES[id];
      if(!exItem) return;
      if(fCat === 'tense' && exItem.category !== 'tense') return;
      if(fCat === 'grammar' && exItem.category === 'tense') return;
      var st = itemMastery(id).state;
      var dot = st==='green'?'ref-dot-done':st==='orange'?'ref-dot-learning':'ref-dot-todo';
      itemsHtml += '<div class="ref-row" data-refid="'+id+'">'
        + '<span class="ref-dot '+dot+'"></span>'
        + '<div class="ref-row-text">'
        + '<div class="ref-row-en">'+rmItem.en+'</div>'
        + '<div class="ref-row-hu">'+rmItem.title+'</div>'
        + '</div></div>';
    });
    if(itemsHtml){
      html += '<div class="ref-group-label">'+band.level+'</div>' + itemsHtml;
    }
  });
  list.innerHTML = html || '<div style="padding:1rem;color:var(--faint);font-size:.82rem">Nincs találat.</div>';

  list.onclick = function(e){
    var row = e.target.closest('.ref-row[data-refid]');
    if(!row) return;
    var id = row.getAttribute('data-refid');
    toggleRefPanel(row, id);
  };
}

function toggleRefPanel(row, id){
  var panels = document.getElementById('ref-panels');
  if(!panels) return;

  var existing = document.getElementById('refp-'+id);
  if(existing){
    existing.remove();
    row.classList.remove('active');
    return;
  }

  var rmItem = null;
  ROADMAP.forEach(function(band){ band.items.forEach(function(i){ if(i.id===id) rmItem=i; }); });
  if(!rmItem) return;

  var panel = document.createElement('div');
  panel.className = 'ref-open-panel';
  panel.id = 'refp-'+id;

  var header = document.createElement('div');
  header.className = 'ref-open-header';
  var titleWrap = document.createElement('div');
  var titleEl = document.createElement('div');
  titleEl.className = 'ref-open-title';
  titleEl.textContent = rmItem.en;
  var subEl = document.createElement('div');
  subEl.className = 'ref-open-sub';
  subEl.textContent = rmItem.title;
  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subEl);
  var closeBtn = document.createElement('button');
  closeBtn.className = 'ref-open-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = function(){ panel.remove(); row.classList.remove('active'); };
  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var bodyEl = document.createElement('div');
  bodyEl.innerHTML = renderRoadmapItem(rmItem, false);
  panel.appendChild(bodyEl);

  var footer = document.createElement('div');
  footer.style.cssText = 'margin-top:1rem;padding-top:.8rem;border-top:1px solid var(--border)';
  var pracBtn = document.createElement('button');
  pracBtn.className = 'btn btn-outline btn-sm';
  pracBtn.textContent = '▶ Gyakorolj most';
  pracBtn.onclick = function(){ quickPractice(id); };
  footer.appendChild(pracBtn);
  panel.appendChild(footer);

  panels.appendChild(panel);
  row.classList.add('active');
}

function toggleRefBox(el, id){
  var expand = document.getElementById('ref-expand-'+id);
  if(!expand) return;
  var isOpen = expand.style.display !== 'none';
  document.querySelectorAll('.ref-expand').forEach(function(e){ e.style.display='none'; });
  document.querySelectorAll('.ref-box').forEach(function(b){ b.classList.remove('active'); });
  if(!isOpen){
    expand.style.display = 'block';
    if(el) el.classList.add('active');
  }
}

function toggleRefCard(id){
  var body = document.getElementById('ref-body-'+id);
  var arrow = document.getElementById('ref-arrow-'+id);
  if(!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if(arrow) arrow.textContent = open ? '▼' : '▲';
}

function quickPractice(id){
  selectedTenses.clear(); selectedTenses.add(id);
  showTenseTab('practice', document.querySelector('.tense-tab'));
  startExercises();
}

function renderProgressOverview() {
  var activeWords = oxWords.filter(function(w){ return w.s==='active'; }).length;
  var el = document.getElementById('stat-active-words');
  if(el) el.textContent = activeWords || '—';

  // Roadmap %
  var total = 0, done = 0;
  ROADMAP.forEach(function(band) {
    band.items.forEach(function(item) {
      total++;
      if (itemMastery(item.id).state === 'green') done++;
    });
  });
  var pct = total ? Math.round(done / total * 100) : 0;
  var rmEl = document.getElementById('stat-roadmap-pct');
  if (rmEl) rmEl.textContent = pct + '%';

  // Active error patterns
  var errors = JSON.parse(localStorage.getItem('error_patterns') || '[]');
  var activeErrors = errors.filter(function(e) { return e.status === 'active'; }).length;
  var errEl = document.getElementById('stat-errors');
  if (errEl) errEl.textContent = activeErrors || '0';

  // Elmúlt 7 nap tanulási perceinek összesítése (a 3 kategória együtt)
  var timeData = JSON.parse(localStorage.getItem('learning_time') || '{}');
  var weekSec = 0;
  for(var i = 0; i < 7; i++){
    var wd = new Date(); wd.setHours(0,0,0,0); wd.setDate(wd.getDate() - i);
    var cs = dayCategorySecs(timeData[localDateStr(wd)]);
    weekSec += cs.input + cs.output + cs.deliberate;
  }
  var sessEl = document.getElementById('stat-sessions');
  if(sessEl) sessEl.textContent = Math.round(weekSec / 60) || '0';

  // Heti egyensúly-navigátor
  renderWeekNavigator();
  // Heti szint-visszajelzés (auto, ha esedékes; különben a meglévőt rajzolja)
  maybeAutoLevelReport();
}

// Lokális dátum YYYY-MM-DD formátumban — a toISOString() UTC-t ad, ami magyar
// időzónában éjfél és hajnali 1-2 óra között egy nappal eltolná a dátumot
function localDateStr(d) {
  var p = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Tanulási idő mentése (másodperc) — kategóriánként: 'input' | 'output' | 'deliberate'
// (Az 'anki' kulcsot a szinkron írja külön, felülírással — lásd ankiFetchReviewTimes.)
function addLearningTime(category, seconds) {
  if(seconds < 5 || seconds > 7200) return; // 5mp alatt / 2 óra felett ignoráljuk
  if(!category) return;
  var today = localDateStr(new Date());
  var data = JSON.parse(localStorage.getItem('learning_time') || '{}');
  if(!data[today]) data[today] = {};
  data[today][category] = (data[today][category] || 0) + seconds;
  localStorage.setItem('learning_time', JSON.stringify(data));
}

// Egy nap idő-bontása másodpercben, a 3 navigátor-kategóriára.
// Tudatos = appon belüli 'deliberate' + Anki review idő. (A régi 'app' kulcs
// nem bontható kategóriákra, ezért az új nézetben nem jelenik meg.)
function dayCategorySecs(entry) {
  entry = entry || {};
  return {
    input:      entry.input || 0,
    output:     entry.output || 0,
    deliberate: (entry.deliberate || 0) + (entry.anki || 0)
  };
}

// ============================================================
// EGYSÉGES EREDMÉNY-RÉTEG — minden gyakorlás eredménye ide fut be.
//  - skill_results: minden értékelt tevékenység naplója (trend, heti visszajelzés)
//  - item_evidence: roadmap-elemenkénti helyes/hibás használat (élő tudásszint)
// ============================================================

// Roadmap-elemek indexe id → {item, level} (lustán épül, mert a ROADMAP külön fájlból tölt)
var _roadmapIndex = null;
function roadmapItem(id){
  if(!_roadmapIndex){
    _roadmapIndex = {};
    if(typeof ROADMAP !== 'undefined'){
      ROADMAP.forEach(function(b){ b.items.forEach(function(it){
        _roadmapIndex[it.id] = {item:it, level:b.level};
      }); });
    }
  }
  return _roadmapIndex[id] || null;
}

// Minden értékelt tevékenység eredménye: type='reading'|'writing'|'speaking'|'grammar',
// score 0–1, count = hány elemből (kérdés/forduló). Trendekhez és a heti visszajelzéshez.
function logSkillResult(type, score, count){
  var arr = JSON.parse(localStorage.getItem('skill_results')||'[]');
  arr.push({date:getTodayStr(), ts:Date.now(), type:type,
            score:Math.max(0, Math.min(1, score||0)), count:count||1});
  if(arr.length > 1000) arr = arr.slice(-1000);
  localStorage.setItem('skill_results', JSON.stringify(arr));
}

// Roadmap-elem szintű bizonyíték: helyes/hibás használat egy nyelvtani témán.
// A friss esemény többet nyom (lásd itemMastery), naptári kopás nincs — csak hiba ront.
// weight: a feladat típusa szerinti súly (felismerés kevesebbet, produkció többet).
function addItemEvidence(roadmapId, correct, wrong, weight){
  if(!roadmapId || !roadmapItem(roadmapId)) return; // csak valós roadmap-elem
  correct = correct||0; wrong = wrong||0;
  if(!correct && !wrong) return;
  weight = weight || 1;
  var ev = JSON.parse(localStorage.getItem('item_evidence')||'{}');
  var e = ev[roadmapId] || {correct:0, wrong:0, events:[], lastSeen:null};
  e.correct += correct; e.wrong += wrong; e.lastSeen = getTodayStr();
  // esemény-napló a recency-súlyozáshoz: {o:helyes?1:0, w:súly} — csak az utolsó 40 marad
  var k;
  for(k=0; k<correct; k++) e.events.push({o:1, w:weight});
  for(k=0; k<wrong; k++) e.events.push({o:0, w:weight});
  if(e.events.length > 40) e.events = e.events.slice(-40);
  ev[roadmapId] = e;
  localStorage.setItem('item_evidence', JSON.stringify(ev));
}

// Feladattípus-súlyok az előrehaladáshoz (felismerés < irányított < produkció)
var EX_WEIGHT = {choice:0.5, banked:0.75, matching:0.75, fill:1, error:1, wordform:1, cloze:1.5, transform:1.5, keyword:1.5, build:2};
function exWeight(type){ return EX_WEIGHT[type] || 1; }

// Kompakt roadmap-témalista a produkciós értékelő promptokhoz ("id = English name (Level)")
function roadmapTopicsForPrompt(){
  roadmapItem(''); // index felépítése
  var lines = [];
  Object.keys(_roadmapIndex).forEach(function(id){
    var r = _roadmapIndex[id];
    lines.push(id+' = '+(r.item.en||r.item.title)+' ('+r.level+')');
  });
  return lines.join('; ');
}

// Az AI által visszaadott attribúció rögzítése: {topics_ok:[id...], topics_wrong:[id...]}
function recordAttribution(attr){
  if(!attr) return;
  // Éles produkció (fordítás/írás/társalgás) — erős jel, súly 2
  if(Array.isArray(attr.topics_ok))    attr.topics_ok.forEach(function(id){ addItemEvidence(id, 1, 0, 2); });
  if(Array.isArray(attr.topics_wrong)) attr.topics_wrong.forEach(function(id){ addItemEvidence(id, 0, 1, 2); });
}

// Élő tudásszint egy roadmap-elemre az összes eredményből (item_evidence).
//  - A pontszám recency-súlyozott pontosság (újabb esemény többet nyom, naptári kopás nincs).
//  - A mennyiség csak belépő-kapu a zöldhöz; helyes éles használat teljes értékű.
//  - Csak hiba ront (zöld→narancs). Adat híján a kézi státuszt tükrözi.
var MASTERY_GATE = 6;     // ennyi esemény kell a zöld jogosultsághoz
var MASTERY_GREEN = 0.8;  // recency-súlyozott pontosság küszöbe a zöldhöz
var MASTERY_DECAY = 0.85; // recency-súly: a legutolsó esemény súlya 1, a régebbiek fakulnak
function itemMastery(id){
  var ev = (JSON.parse(localStorage.getItem('item_evidence')||'{}'))[id];
  var events = (ev && ev.events) ? ev.events : [];
  if(events.length){
    // Súlyozott, recency-súlyozott pontosság; a kapu súlyozott mennyiség.
    // A régi események sima 0/1 számok (súly=1), az újak {o,w} — mindkettőt kezeljük.
    var n=events.length, denom=0, acc=0, vol=0;
    for(var i=0;i<n;i++){
      var e0=events[i];
      var o=(typeof e0==='object')?(e0.o||0):e0;
      var w=(typeof e0==='object')?(e0.w||1):1;
      var d=Math.pow(MASTERY_DECAY, n-1-i);
      denom+=d*w; acc+=d*w*o; vol+=w;
    }
    var accuracy = denom ? acc/denom : 0;
    var count = (ev.correct||0) + (ev.wrong||0);
    return {state:(vol>=MASTERY_GATE && accuracy>=MASTERY_GREEN)?'green':'orange', score:Math.round(accuracy*100), count:count, lastSeen:ev.lastSeen};
  }
  // élő bizonyíték híján a korábbi nyelvtani gyakorlás előzménye (pre-evidence adat)
  var hist=JSON.parse(localStorage.getItem('ex_history')||'[]').filter(function(h){ return h.roadmapId===id; });
  if(hist.length){
    var m=hist.length, ws=0, a=0, cnt=0;
    for(var j=0;j<m;j++){ var w2=Math.pow(MASTERY_DECAY, m-1-j); ws+=w2; a+=w2*((hist[j].pct||0)/100); cnt+=hist[j].total||0; }
    var ac=ws?a/ws:0;
    return {state:(cnt>=MASTERY_GATE && ac>=MASTERY_GREEN)?'green':'orange', score:Math.round(ac*100), count:cnt, lastSeen:hist[hist.length-1].date};
  }
  return {state:'grey', score:0, count:0, lastSeen:null};
}

// Egységes jelzők (egyetlen forrás: itemMastery)
function masteryIcon(state){ return state==='green'?'🟢':state==='orange'?'🟠':'⚪'; }
function masteryStatusClass(state){ return state==='green'?'done':state==='orange'?'learning':'todo'; }

function masteryTip(m){
  if(m.state==='grey') return 'Még nem gyakoroltad';
  return m.count+'× gyakorolva · '+m.score+'% pontosság'+(m.lastSeen?' · utoljára: '+m.lastSeen:'');
}

function masteryBarHtml(id){
  var m = itemMastery(id);
  var colors = {grey:'var(--border2)', orange:'#f59e0b', green:'#22c55e'};
  var w = m.state==='grey' ? 0 : Math.max(8, m.score);
  return '<div class="mastery-bar" title="'+masteryTip(m)+'"><div class="mastery-fill" style="width:'+w+'%;background:'+colors[m.state]+'"></div></div>';
}

// A modál tetején: "milyen a tudásom ott" — szöveges állapot + sáv
function masteryModalHtml(id){
  var m = itemMastery(id);
  var labels = {grey:'Még nem foglalkoztál vele', orange:'Gyakorlod — még (vagy már megint) nem megy elég jól', green:'Eleget gyakoroltad és jól megy'};
  var colors = {grey:'var(--muted)', orange:'#f59e0b', green:'#22c55e'};
  return '<div class="mastery-modal">'
    + '<div class="mastery-modal-head"><span style="color:'+colors[m.state]+';font-weight:600">'+labels[m.state]+'</span>'
    + (m.state!=='grey' ? '<span class="mastery-modal-sub">'+m.count+'× gyakorolva · '+m.score+'% pontosság'+(m.lastSeen?' · utoljára: '+m.lastSeen:'')+'</span>' : '')
    + '</div>'
    + masteryBarHtml(id)
    + '</div>';
}

// A jelenleg aktív fő panel és Fordítás-aldfül — az időmérő kategóriájához kell
var _activeMain = 'roadmap', _activeTranslateSub = 'text';

// Az aktuális tevékenység kategóriája az időméréshez: 'input' | 'output' |
// 'deliberate' | null (nem mért). Csak a 4 egyértelmű tevékenység számít.
function activityCategory() {
  if(_activeMain === 'convo')  return 'output';      // Társalgás
  if(_activeMain === 'tenses') return 'deliberate';  // Igeidők
  if(_activeMain === 'translate') {
    if(_activeTranslateSub === 'comprehension') return 'input';      // Szövegértés
    if(_activeTranslateSub === 'writing' || _activeTranslateSub === 'uzleti') return 'output'; // Fordítás, Írás
    if(_activeTranslateSub === 'grammar') return 'deliberate';       // Nyelvtani elemző
    return null; // Szöveg generálás — nem mért
  }
  return null; // Szótár, Haladás — nem mért
}

// Kategória-alapú időmérő — csak a tanulási tevékenységek idejét méri
var _panelTimer = {
  cat: null, start: null, idle: false,
  // Újraszámolja az aktuális kategóriát; ha váltott, flushöli az eddigit és újraindít
  sync: function() {
    var c = activityCategory();
    if(c === this.cat) return;
    this.stop();
    this.cat = c;
    this.start = (c && !document.hidden) ? Date.now() : null;
  },
  stop: function() {
    if(this.cat && this.start) {
      addLearningTime(this.cat, Math.floor((Date.now() - this.start) / 1000));
    }
    this.cat = null; this.start = null; this.idle = false;
  },
  // endMs: meddig számoljuk az időt (inaktivitásnál az utolsó aktivitás pillanatáig)
  pause: function(endMs) {
    if(this.cat && this.start) {
      addLearningTime(this.cat, Math.floor(((endMs || Date.now()) - this.start) / 1000));
      this.start = null;
    }
  },
  // csak akkor indítjuk újra, ha tényleg áll — különben elveszne a futó szakasz
  resume: function() { if(this.cat && !this.start) this.start = Date.now(); }
};

// Inaktivitás-figyelés: ha 3 percig nincs egér/billentyű/érintés aktivitás, az
// időmérés szünetel, és csak az utolsó aktivitásig eltelt idő számít. A felolvasás
// (TTS) hallgatása aktivitásnak számít, hogy hallás utáni gyakorlásnál ne álljon le.
var IDLE_LIMIT_MS = 3 * 60 * 1000;
var _lastActivity = Date.now();
function _activityPing() {
  _lastActivity = Date.now();
  if(_panelTimer.idle) {
    _panelTimer.idle = false;
    if(!document.hidden) _panelTimer.resume();
  }
}
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(function(ev) {
  document.addEventListener(ev, _activityPing, {passive: true});
});
setInterval(function() {
  if(window.speechSynthesis && window.speechSynthesis.speaking) { _lastActivity = Date.now(); return; }
  if(!_panelTimer.idle && _panelTimer.start && Date.now() - _lastActivity >= IDLE_LIMIT_MS) {
    _panelTimer.pause(_lastActivity);
    _panelTimer.idle = true;
  }
}, 30000);

// Heti egyensúly-navigátor: input/output/tudatos arány + napi 1 óra teljesülése
// az elmúlt 7 napra. Cél: 50/25/25 (±5%), napi 60 perc, heti 7 óra.
var NAV_TARGET = {input:0.50, output:0.25, deliberate:0.25};
var NAV_TOL = 0.05;            // ±5 százalékpont
var NAV_DAY_GOAL = 60*60;      // napi cél: 60 perc (mp)
var NAV_WEEK_GOAL = 7*60*60;   // heti cél: 7 óra (mp)
var NAV_COLORS = {input:'#3b82f6', output:'#22c55e', deliberate:'#f59e0b'};

function renderWeekNavigator() {
  var sumEl = document.getElementById('week-nav-summary');
  var wrap = document.getElementById('weekly-activity');
  if(!wrap) return;
  var dayNames = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']; // getDay() szerinti index
  var timeData = JSON.parse(localStorage.getItem('learning_time') || '{}');

  // Gördülő 7 napos ablak: a mai nap a jobb szélen
  var days = [];
  for(var i = 6; i >= 0; i--){
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    var cs = dayCategorySecs(timeData[localDateStr(d)]);
    cs.total = cs.input + cs.output + cs.deliberate;
    cs.date = d; cs.isToday = (i === 0);
    days.push(cs);
  }

  // Heti összesítés
  var wk = {input:0, output:0, deliberate:0};
  var daysMet = 0, maxMin = 0;
  days.forEach(function(c){
    wk.input += c.input; wk.output += c.output; wk.deliberate += c.deliberate;
    if(c.total >= NAV_DAY_GOAL) daysMet++;
    var m = Math.round(c.total / 60); if(m > maxMin) maxMin = m;
  });
  var wkTotal = wk.input + wk.output + wk.deliberate;
  var p = {
    input:      wkTotal ? wk.input/wkTotal : 0,
    output:     wkTotal ? wk.output/wkTotal : 0,
    deliberate: wkTotal ? wk.deliberate/wkTotal : 0
  };
  var pct = function(x){ return Math.round(x*100); };
  var inOk  = wkTotal>0 && Math.abs(p.input - NAV_TARGET.input)   <= NAV_TOL;
  var outOk = wkTotal>0 && Math.abs(p.output - NAV_TARGET.output) <= NAV_TOL;
  var delOk = wkTotal>0 && Math.abs(p.deliberate - NAV_TARGET.deliberate) <= NAV_TOL;
  var timeOk = wkTotal >= NAV_WEEK_GOAL;

  // --- Összegző kártya ---
  if(sumEl){
    var hrs = (wkTotal/3600).toFixed(1).replace('.', ',');
    var timeBarPct = Math.min(100, Math.round(wkTotal / NAV_WEEK_GOAL * 100));
    var ico = function(ok){ return ok ? '<span class="nav-ok">✓</span>' : '<span class="nav-warn">!</span>'; };

    // Arány-sáv szegmensei (csak ha van adat)
    var ratioSeg = '';
    if(wkTotal>0){
      ['input','output','deliberate'].forEach(function(k){
        var w = p[k]*100;
        if(w>0) ratioSeg += '<div style="width:'+w+'%;background:'+NAV_COLORS[k]+'"></div>';
      });
    } else {
      ratioSeg = '<div style="width:100%;background:var(--border2)"></div>';
    }

    // Verdikt
    var verdict, vClass;
    if(wkTotal===0){ verdict='Még nincs mért gyakorlás az elmúlt 7 napban.'; vClass='nav-verdict-neutral'; }
    else {
      var issues=[];
      if(!timeOk) issues.push('kevés az összidő ('+hrs+'/7 ó)');
      if(!inOk)  issues.push(p.input<NAV_TARGET.input?'kevés az input':'sok az input');
      if(!outOk) issues.push(p.output<NAV_TARGET.output?'kevés az output':'sok az output');
      if(!delOk) issues.push(p.deliberate<NAV_TARGET.deliberate?'kevés a tudatos gyakorlás':'sok a tudatos gyakorlás');
      if(!issues.length){ verdict='Remek egyensúly — tartsd így!'; vClass='nav-verdict-ok'; }
      else { verdict='Javítanivaló: '+issues.join(' · '); vClass='nav-verdict-warn'; }
    }

    sumEl.innerHTML =
      '<div class="nav-total-row">'
        + '<span class="nav-total-num">'+hrs+'</span><span class="nav-total-goal"> / 7 óra</span>'
        + '<span class="nav-days-met">'+ico(daysMet>0)+' '+daysMet+'/7 nap megvolt az 1 óra</span>'
      + '</div>'
      + '<div class="nav-time-track"><div class="nav-time-fill" style="width:'+timeBarPct+'%"></div></div>'
      + '<div class="nav-ratio-track">'+ratioSeg
        + '<span class="nav-tick" style="left:50%"></span><span class="nav-tick" style="left:75%"></span>'
      + '</div>'
      + '<div class="nav-ratio-legend">'
        + '<span>Tény: <b style="color:'+NAV_COLORS.input+'">'+pct(p.input)+'%</b> / '
          + '<b style="color:'+NAV_COLORS.output+'">'+pct(p.output)+'%</b> / '
          + '<b style="color:'+NAV_COLORS.deliberate+'">'+pct(p.deliberate)+'%</b></span>'
        + '<span class="nav-target-txt">Cél: 50 / 25 / 25</span>'
      + '</div>'
      + '<div class="nav-chips">'
        + '<span class="nav-chip '+(inOk?'nav-chip-ok':'nav-chip-warn')+'">'+ico(inOk)+' Input '+pct(p.input)+'%</span>'
        + '<span class="nav-chip '+(outOk?'nav-chip-ok':'nav-chip-warn')+'">'+ico(outOk)+' Output '+pct(p.output)+'%</span>'
        + '<span class="nav-chip '+(delOk?'nav-chip-ok':'nav-chip-warn')+'">'+ico(delOk)+' Tudatos '+pct(p.deliberate)+'%</span>'
      + '</div>'
      + '<div class="nav-verdict '+vClass+'">'+verdict+'</div>';
  }

  // --- Napi bontás (3 színű halmozott oszlopok + 60 perces célvonal) ---
  var BAR_MAX = 56; // px
  // A skála teteje legalább 60 perc, + ~25% ráhagyás, hogy a célvonal soha ne a
  // legtetőre (és az overflow:hidden alá) essen, hanem jól láthatóan a sávok között
  var scaleMax = Math.ceil(Math.max(maxMin, 60) * 1.25);
  var goalY = Math.round(NAV_DAY_GOAL/60 / scaleMax * BAR_MAX);
  var html = '';
  days.forEach(function(c){
    var isToday = c.isToday;
    var seg = function(k){
      var m = Math.round(c[k]/60);
      if(m<=0) return '';
      var h = Math.max(2, Math.round(m / scaleMax * BAR_MAX));
      return '<div class="nav-bar-fill" style="height:'+h+'px;background:'+NAV_COLORS[k]+';opacity:'+(isToday?'1':'.75')+'"></div>';
    };
    var totalMin = Math.round(c.total/60);
    var met = c.total >= NAV_DAY_GOAL;
    var tip = totalMin>0
      ? totalMin+' p — Input: '+Math.round(c.input/60)+'p, Output: '+Math.round(c.output/60)+'p, Tudatos: '+Math.round(c.deliberate/60)+'p'
      : 'Nincs gyakorlás';
    html += '<div class="weekly-day-bar" title="'+tip+'">'
      + '<div class="weekly-bar-stack" style="height:'+BAR_MAX+'px">'
        + '<div class="nav-goal-line" style="bottom:'+goalY+'px">'+(isToday?'<span class="nav-goal-tag">1 ó</span>':'')+'</div>'
        // column-reverse → input alul, tudatos felül
        + (c.total>0 ? seg('input')+seg('output')+seg('deliberate')
                     : '<div class="nav-bar-fill" style="height:2px;background:var(--border2);opacity:.5"></div>')
      + '</div>'
      + '<div class="weekly-day-label'+(isToday?' wdl-today':'')+'">'
        + (met?'<span class="nav-day-check">✓</span>':'')
        + (isToday?'Ma':dayNames[c.date.getDay()])
      + '</div>'
    + '</div>';
  });
  wrap.innerHTML = html;
}

// ============================================================
// HETI SZINT-VISSZAJELZÉS (adatvezérelt, hetente frissül)
// ============================================================

function getTodayStr() {
  return localDateStr(new Date());
}

var CEFR = ['A1','A2','B1','B2','C1','C2'];
function cefrLabel(idx){ return CEFR[Math.max(0, Math.min(CEFR.length-1, Math.round(idx)))]; }

// Tömör adatkép minden jelből — ez megy a szint-becsléshez és a visszajelzéshez
function buildProgressSnapshot(){
  var snap={};
  // Idő-egyensúly (elmúlt 7 nap, perc)
  var timeData=JSON.parse(localStorage.getItem('learning_time')||'{}');
  var t={input:0,output:0,deliberate:0};
  for(var i=0;i<7;i++){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    var cs=dayCategorySecs(timeData[localDateStr(d)]); t.input+=cs.input; t.output+=cs.output; t.deliberate+=cs.deliberate; }
  var totMin=Math.round((t.input+t.output+t.deliberate)/60);
  snap.time={input_min:Math.round(t.input/60), output_min:Math.round(t.output/60), deliberate_min:Math.round(t.deliberate/60), total_hours:+(totMin/60).toFixed(1)};
  // Nyelvtan roadmap szintenként (zöld = jól megy, narancs = gyakorolja)
  roadmapItem('');
  var gl={}, weak=[];
  ROADMAP.forEach(function(b){
    if(!gl[b.level]) gl[b.level]={green:0,orange:0,total:0};
    b.items.forEach(function(it){
      var m=itemMastery(it.id); gl[b.level].total++;
      if(m.state==='green') gl[b.level].green++;
      else if(m.state==='orange'){ gl[b.level].orange++; if(m.count>0 && m.score<70) weak.push((it.en||it.title)+' ('+b.level+', '+m.score+'%)'); }
    });
  });
  snap.grammar=gl;
  snap.weak_grammar=weak.slice(0,8);
  // Szókincs lefedettség
  var cov=vocabCoverage();
  snap.vocab={b2_pct:cov.b2.pct, b2_known:cov.b2.known, b2_total:cov.b2.total, c1_pct:cov.c1.pct, c1_known:cov.c1.known, c1_total:cov.c1.total, weekly_new:cov.delta};
  // Készség-eredmények (utolsó 21 nap átlaga)
  var sr=JSON.parse(localStorage.getItem('skill_results')||'[]');
  var since=Date.now()-21*24*3600*1000, agg={};
  sr.forEach(function(x){ if(x.ts<since) return; if(!agg[x.type]) agg[x.type]={sum:0,n:0}; agg[x.type].sum+=x.score; agg[x.type].n++; });
  var skills={};
  Object.keys(agg).forEach(function(k){ skills[k]={avg_pct:Math.round(agg[k].sum/agg[k].n*100), n:agg[k].n}; });
  snap.skills=skills;
  // Top aktív hibaminták
  var errs=JSON.parse(localStorage.getItem('error_patterns')||'[]').filter(function(e){ return e.status==='active'; });
  errs.sort(function(a,b){ return (b.count||1)-(a.count||1); });
  snap.top_errors=errs.slice(0,6).map(function(e){ return {wrong:e.wrong, right:e.right, count:e.count||1, type:e.type}; });
  return snap;
}

// Determinisztikus alap-szint a szókincs-lefedettségből — az AI ebből indul, nem találgat
function estimateLevels(snap){
  var v=snap.vocab, idx;
  if(v.c1_pct>=70) idx=4; else if(v.b2_pct>=85) idx=3; else if(v.b2_pct>=60) idx=2; else if(v.b2_pct>=35) idx=1; else idx=0;
  return {anchorIdx:idx, anchor:cefrLabel(idx)};
}

var _levelReportRunning=false;
async function generateLevelReport(manual){
  if(_levelReportRunning) return;
  _levelReportRunning=true;
  var content=document.getElementById('level-content');
  show('level-loading');
  try{
    var snap=buildProgressSnapshot();
    var est=estimateLevels(snap);
    var reports=JSON.parse(localStorage.getItem('level_reports')||'[]');
    var prev=reports[0];
    var prevTxt=prev ? ('Previous report ('+prev.date+'): '+JSON.stringify(prev.levels)) : 'No previous report (this is the first).';
    var r=await claude(
      'You are an expert CEFR examiner and coach for a Hungarian English learner (around B1, heading to C1). Estimate CEFR levels from the DATA only and give concise, actionable Hungarian feedback aimed at the FASTEST purposeful progress. Do NOT inflate: stay within one CEFR step of what the data supports. The vocabulary coverage anchor is ~'+est.anchor+'. If a skill has little data, say so and estimate conservatively. Return ONLY valid JSON, no markdown: {"levels":{"reading":"A1..C2","production":"A1..C2","grammar":"A1..C2","vocab":"A1..C2","overall":"A1..C2"},"summary":"3-5 Hungarian sentences on the current situation","priorities":[{"what":"concrete Hungarian action","why":"short Hungarian reason"}],"changes":"1-2 Hungarian sentences comparing to the previous report"}. Max 3 priorities.',
      'DATA (JSON):\n'+JSON.stringify(snap)+'\n\n'+prevTxt,
      1500
    );
    var d=safeParseJSON(r);
    if(!d || !d.levels) throw new Error('Hiányos válasz az AI-tól.');
    reports.unshift({date:getTodayStr(), ts:Date.now(), levels:d.levels, summary:d.summary||'', priorities:d.priorities||[], changes:d.changes||''});
    if(reports.length>40) reports=reports.slice(0,40);
    localStorage.setItem('level_reports', JSON.stringify(reports));
    renderLevelPanel();
  }catch(e){
    if(content) content.innerHTML='<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('level-loading');
  _levelReportRunning=false;
}

// Hetente automatikus: ha nincs friss (7 napon belüli) jelentés és van miből dolgozni
function maybeAutoLevelReport(){
  if(_levelReportRunning) return;
  var reports=JSON.parse(localStorage.getItem('level_reports')||'[]');
  var last=reports[0];
  var due = !last || (Date.now()-(last.ts||0) >= 7*24*3600*1000);
  var hasData = JSON.parse(localStorage.getItem('skill_results')||'[]').length>0
             || Object.keys(JSON.parse(localStorage.getItem('item_evidence')||'{}')).length>0
             || (oxWords && oxWords.length>0);
  if(due && hasData) generateLevelReport(false);
  else renderLevelPanel();
}

function renderLevelPanel(){
  var content=document.getElementById('level-content');
  var hist=document.getElementById('level-history');
  if(!content) return;
  var reports=JSON.parse(localStorage.getItem('level_reports')||'[]');
  if(!reports.length){
    content.innerHTML='<div class="level-empty">Még nincs heti visszajelzés. A gyakorlásaid alapján készítek egyet.<br>'
      + '<button class="btn btn-gold btn-sm" style="margin-top:.7rem" onclick="generateLevelReport(true)">🎓 Visszajelzés készítése</button></div>';
    if(hist) hist.innerHTML='';
    return;
  }
  var r=reports[0], L=r.levels||{};
  function chip(label,val){ return '<div class="lvl-chip"><div class="lvl-chip-val">'+(val||'—')+'</div><div class="lvl-chip-label">'+label+'</div></div>'; }
  var html='<div class="lvl-overall"><span class="lvl-overall-val">'+(L.overall||'—')+'</span>'
    + '<span class="lvl-overall-label">becsült összesített szint · '+r.date+'</span></div>';
  html+='<div class="lvl-chips">'+chip('Olvasás / hallás',L.reading)+chip('Beszéd / írás',L.production)+chip('Nyelvtan',L.grammar)+chip('Szókincs',L.vocab)+'</div>';
  if(r.summary) html+='<div class="lvl-summary">'+r.summary+'</div>';
  if(r.priorities && r.priorities.length){
    html+='<div class="lvl-prio-title">Mire koncentrálj — leggyorsabb haladás</div>';
    r.priorities.forEach(function(p){ html+='<div class="lvl-prio"><div class="lvl-prio-what">→ '+(p.what||'')+'</div>'+(p.why?'<div class="lvl-prio-why">'+p.why+'</div>':'')+'</div>'; });
  }
  if(r.changes) html+='<div class="lvl-changes">📈 '+r.changes+'</div>';
  content.innerHTML=html;
  if(hist){
    if(reports.length>1){
      var items=reports.slice(1,13).map(function(x){
        return '<div class="lvl-hist-item"><span class="lvl-hist-date">'+x.date+'</span>'
          + '<span class="lvl-hist-lvl">'+((x.levels&&x.levels.overall)||'—')+'</span>'
          + '<span class="lvl-hist-sum">'+((x.summary||'').substring(0,140))+'…</span></div>';
      }).join('');
      hist.innerHTML='<details class="lvl-hist"><summary>Korábbi visszajelzések ('+(reports.length-1)+')</summary>'+items+'</details>';
    } else hist.innerHTML='';
  }
}

// ============================================================
// HIBAMINTÁK
// ============================================================
function addErrorPattern(wrong, right, type, explanation) {
  var patterns = JSON.parse(localStorage.getItem('error_patterns') || '[]');
  // Check if already exists
  var existing = patterns.find(function(p) { return p.wrong === wrong; });
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.lastSeen = getTodayStr();
  } else {
    patterns.push({
      id: Date.now(),
      wrong: wrong,
      right: right,
      type: type || 'grammar',
      explanation: explanation || '',
      status: 'active',
      count: 1,
      firstSeen: getTodayStr(),
      lastSeen: getTodayStr()
    });
  }
  localStorage.setItem('error_patterns', JSON.stringify(patterns));
}

function renderErrorPatterns() {
  var patterns = JSON.parse(localStorage.getItem('error_patterns') || '[]');
  var wrap = document.getElementById('error-patterns-list');
  var empty = document.getElementById('error-patterns-empty');
  if (!wrap) return;
  if (!patterns.length) {
    if (empty) empty.style.display = 'block';
    wrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  // Sort by count desc, then by date
  patterns.sort(function(a, b) { return (b.count || 1) - (a.count || 1); });
  var statusLabels = { active: '🔴 Aktív', improving: '🟡 Javul', solved: '🟢 Megoldva' };
  wrap.innerHTML = patterns.map(function(p) {
    return '<div class="error-pattern-item">'
      + '<div class="error-pattern-header">'
      + '<span class="corr-type corr-type-' + p.type + '">' + (p.type === 'grammar' ? 'Nyelvtan' : p.type === 'typo' ? 'Elütés' : 'Stílus') + '</span>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + '<span class="error-pattern-count">' + (p.count || 1) + '×</span>'
      + '<select class="ox-status-select" onchange="updateErrorStatus(' + p.id + ',this.value)" style="font-size:.75rem;padding:3px 6px">'
      + '<option value="active"' + (p.status==='active'?' selected':'') + '>🔴 Aktív</option>'
      + '<option value="improving"' + (p.status==='improving'?' selected':'') + '>🟡 Javul</option>'
      + '<option value="solved"' + (p.status==='solved'?' selected':'') + '>🟢 Megoldva</option>'
      + '</select>'
      + '</div>'
      + '</div>'
      + '<div class="error-pattern-wrong">✗ ' + p.wrong + '</div>'
      + '<div class="error-pattern-right">✓ ' + p.right + '</div>'
      + (p.explanation ? '<div class="error-pattern-exp">' + p.explanation + '</div>' : '')
      + '<div style="font-size:.7rem;color:var(--faint);margin-top:.3rem">Utoljára: ' + p.lastSeen + '</div>'
      + '</div>';
  }).join('');
}

function updateErrorStatus(id, status) {
  var patterns = JSON.parse(localStorage.getItem('error_patterns') || '[]');
  var p = patterns.find(function(p) { return p.id === id; });
  if (p) { p.status = status; localStorage.setItem('error_patterns', JSON.stringify(patterns)); }
  renderProgressOverview();
}

// Hook into doCheck to auto-collect errors
var _origDoCheck = null;
function hookErrorCollection() {
  // After doCheck runs, collect grammar errors
  var origCheckResult = document.getElementById('check-result');
  // We'll hook by overriding the innerHTML setter - actually simpler:
  // just call addErrorPattern from within doCheck results
}

// ============================================================
// INIT
// ============================================================

function renderVocabDashboard(){
  if(!oxWords.length){
    var nd=document.getElementById('vocab-no-data');
    var dc=document.getElementById('vocab-dashboard-content');
    if(nd) nd.style.display='block';
    if(dc) dc.style.display='none';
    return;
  }
  document.getElementById('vocab-no-data').style.display='none';
  document.getElementById('vocab-dashboard-content').style.display='block';
  renderVocabCoverage();
  var wordCharts=vocabChartsHtml(oxWords,'szó');
  var sr=document.getElementById('vocab-summary-row'); if(sr) sr.innerHTML=wordCharts.sum;
  var lb=document.getElementById('vocab-level-bars'); if(lb) lb.innerHTML=wordCharts.bars;
  // Kifejezések (phrases) blokk — csak akkor látszik, ha van betöltött kifejezés
  var hasPhrases=oxPhrases.length>0;
  ['vocab-phrase-label','vocab-phrase-summary','vocab-phrase-bars'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.style.display=hasPhrases?'':'none';
  });
  if(hasPhrases){
    var phraseCharts=vocabChartsHtml(oxPhrases,'kifejezés');
    var ps=document.getElementById('vocab-phrase-summary'); if(ps) ps.innerHTML=phraseCharts.sum;
    var pb=document.getElementById('vocab-phrase-bars'); if(pb) pb.innerHTML=phraseCharts.bars;
  }
  var activeWords=oxWords.filter(function(w){return w.s==='active';}).length;
  var el=document.getElementById('stat-active-words'); if(el) el.textContent=activeWords||'—';
}

// Egységes szókincs-lefedettség: ismert (active+passive) szó+kifejezés a B2-ig és
// a C1-ig terjedő szinteken, plusz a heti változás (ox_snapshots pillanatképekből).
function vocabCoverage(){
  function tally(items){
    var by={};
    items.forEach(function(w){
      if(!by[w.l]) by[w.l]={known:0,total:0};
      by[w.l].total++;
      if(w.s==='active'||w.s==='passive') by[w.l].known++;
    });
    return by;
  }
  var wb=tally(oxWords), pb=tally(oxPhrases);
  function cum(levels){
    var known=0,total=0;
    levels.forEach(function(l){
      known += (wb[l]?wb[l].known:0)+(pb[l]?pb[l].known:0);
      total += (wb[l]?wb[l].total:0)+(pb[l]?pb[l].total:0);
    });
    return {known:known, total:total, pct: total?Math.round(known/total*100):0};
  }
  return {
    b2: cum(['A1','A2','B1','B2']),
    c1: cum(['A1','A2','B1','B2','C1']),
    delta: vocabWeeklyDelta()
  };
}

// Ismert szavak változása az utolsó heti pillanatkép óta (csak szavak — a snapshot azt tárolja)
function vocabWeeklyDelta(){
  var snaps=JSON.parse(localStorage.getItem('ox_snapshots')||'[]');
  if(!snaps.length) return null;
  var c=snaps[snaps.length-1].counts;
  var prev=0;
  if(c && c.byLevel) Object.keys(c.byLevel).forEach(function(l){ prev += (c.byLevel[l].active||0)+(c.byLevel[l].passive||0); });
  var now=oxWords.filter(function(w){ return w.s==='active'||w.s==='passive'; }).length;
  return now - prev;
}

function renderVocabCoverage(){
  var el=document.getElementById('vocab-coverage'); if(!el) return;
  var c=vocabCoverage();
  var deltaTxt = (c.delta!=null && c.delta!==0) ? '<span class="vcov-delta">'+(c.delta>0?'+':'')+c.delta+' szó/hét</span>' : '';
  function card(title, g, cls, extra){
    return '<div class="vcov-card '+cls+'">'
      + '<div class="vcov-title">'+title+'</div>'
      + '<div class="vcov-pct">'+g.pct+'%</div>'
      + '<div class="vcov-track"><div class="vcov-fill" style="width:'+g.pct+'%"></div></div>'
      + '<div class="vcov-sub">'+g.known.toLocaleString('hu')+' / '+g.total.toLocaleString('hu')+' ismert'+(extra||'')+'</div>'
      + '</div>';
  }
  el.innerHTML = '<div class="section-label" style="margin-bottom:.8rem">Szókincs-lefedettség (ismert = aktív + passzív)</div>'
    + '<div class="vcov-row">'
    + card('B2-ig — rövid távú cél', c.b2, 'vcov-b2', deltaTxt?(' · '+deltaTxt):'')
    + card('C1-ig — végcél', c.c1, 'vcov-c1', '')
    + '</div>';
}

// Szint-fánkok és státusz-sávok HTML-je egy szókészletre (szavak vagy kifejezések)
function vocabChartsHtml(items, noun){
  var byLevel={};
  items.forEach(function(w){
    if(!byLevel[w.l]) byLevel[w.l]={new:0,'under learning':0,active:0,passive:0,total:0};
    byLevel[w.l][w.s]=(byLevel[w.l][w.s]||0)+1;
    byLevel[w.l].total++;
  });
  var levels=['A1','A2','B1','B2','C1'];
  Object.keys(byLevel).forEach(function(l){ if(levels.indexOf(l)===-1) levels.push(l); });
  var sumHtml='', barsHtml='';
  levels.forEach(function(l){
    var c=byLevel[l];
    if(!c||!c.total) return;
    var pA=c.active/c.total,pL=(c['under learning']||0)/c.total,pP=c.passive/c.total,pN=c.new/c.total;
    var pctKnown=Math.round((c.active+c.passive)/c.total*100);
    var cx=40,cy=40,r=34,ri=20;
    var segments=[{val:pA,color:'#22c55e'},{val:pL,color:'#f59e0b'},{val:pP,color:'#3b82f6'},{val:pN,color:'#e2e8f0'}];
    var svgPath='',angle=-Math.PI/2;
    segments.forEach(function(seg){
      if(seg.val<=0) return;
      var sweep=seg.val*2*Math.PI;
      var x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
      var x2=cx+r*Math.cos(angle+sweep),y2=cy+r*Math.sin(angle+sweep);
      var xi1=cx+ri*Math.cos(angle),yi1=cy+ri*Math.sin(angle);
      var xi2=cx+ri*Math.cos(angle+sweep),yi2=cy+ri*Math.sin(angle+sweep);
      var large=sweep>Math.PI?1:0;
      svgPath+='<path d="M'+xi1+','+yi1+' L'+x1+','+y1+' A'+r+','+r+' 0 '+large+',1 '+x2+','+y2+' L'+xi2+','+yi2+' A'+ri+','+ri+' 0 '+large+',0 '+xi1+','+yi1+' Z" fill="'+seg.color+'"/>';
      angle+=sweep;
    });
    sumHtml+='<div class="ox-pie-box"><div class="ox-pie-level">'+l+'</div><div class="ox-pie-wrap"><svg width="80" height="80" viewBox="0 0 80 80">'+svgPath+'</svg><div class="ox-pie-center">'+pctKnown+'%</div></div><div class="ox-pie-total">'+c.total+' '+noun+'</div><div class="ox-pie-mini"><span class="ox-mini-badge ox-active">A:'+c.active+'</span><span class="ox-mini-badge ox-learning">L:'+(c['under learning']||0)+'</span><span class="ox-mini-badge ox-passive">P:'+c.passive+'</span><span class="ox-mini-badge ox-new">N:'+c.new+'</span></div></div>';
    var bA=(pA*100).toFixed(1),bL=(pL*100).toFixed(1),bP=(pP*100).toFixed(1),bN=(pN*100).toFixed(1);
    barsHtml+='<div class="ox-level-bar-row"><div class="ox-level-bar-label"><span><strong>'+l+'</strong> — '+c.total+' '+noun+'</span><span style="font-size:.72rem"><span style="color:var(--success)">Active: '+bA+'%</span> · <span style="color:var(--accent)">Learning: '+bL+'%</span> · <span style="color:#3b82f6">Passive: '+bP+'%</span> · <span style="color:var(--faint)">New: '+bN+'%</span></span></div><div class="ox-bar-track"><div class="ox-bar-active" style="width:'+bA+'%"></div><div class="ox-bar-learning" style="width:'+bL+'%"></div><div class="ox-bar-passive" style="width:'+bP+'%"></div><div class="ox-bar-new" style="width:'+bN+'%"></div></div></div>';
  });
  return {sum:sumHtml, bars:barsHtml};
}

function initProgressPanel() {
  docLoad();
  renderProgressOverview();
  renderErrorPatterns();
  ankiRefreshActivity(); // friss Anki review-idők a háttérben (ha fut az Anki)
}

function show(id){ var e=document.getElementById(id); if(e) e.style.display='block'; }
function hide(id){ var e=document.getElementById(id); if(e) e.style.display='none'; }
function dis(id, v){ var e=document.getElementById(id); if(e) e.disabled=v; }

function safeParseJSON(text){
  if(!text) return {};
  var t = text.trim();
  if(t.startsWith('\uFEFF')) t = t.slice(1);
  // Strip code fences
  t = t.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  // Find JSON boundaries
  var start = t.search(/[\[{]/);
  var end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if(start !== -1 && end !== -1) t = t.slice(start, end+1);
  // Try parse, if fail try to fix common issues
  try {
    return JSON.parse(t);
  } catch(e1) {
    try {
      // Fix unescaped control characters inside strings
      var fixed = t.replace(/("(?:[^"\\]|\\.)*")/g, function(m){
        return m.replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t');
      });
      return JSON.parse(fixed);
    } catch(e2) {
      try {
        // More aggressive: remove all actual newlines outside strings
        var stripped = t.replace(/([^\\])\n/g, '$1 ').replace(/([^\\])\r/g, '$1 ');
        return JSON.parse(stripped);
      } catch(e3) {
        try {
          // Legagreszívebb: escapeletlen " karakterek javítása string értékeken belül
          // Minden :"..." pattern-ben a belső " karaktereket \"-re cseréljük
          var fixed2 = t.replace(/:\s*"([\s\S]*?)(?<!\\)"(?=\s*[,}\]])/g, function(m, inner){
            return ': "' + inner.replace(/(?<!\\)"/g, '\\"') + '"';
          });
          return JSON.parse(fixed2);
        } catch(e4) {
          throw new Error('JSON parse failed: ' + e1.message);
        }
      }
    }
  }
}

async function claude(system, user, maxTokens){
  if(!apiKey) { alert('Adj meg belépési kódot!'); throw new Error('No sync token'); }
  var r = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 1000,
      system: system,
      messages: [{role:'user', content:user}]
    })
  });
  var d = await r.json();
  if(d.error) throw new Error(d.error.message);
  return d.content.map(function(c){ return c.text||''; }).join('');
}

// ============================================================
// API KEY & LAUNCH
// ============================================================
async function saveKey(){
  var k = document.getElementById('api-input').value.trim();
  if(!k){ alert('Adj meg egy belépési kódot!'); return; }
  var btn = document.querySelector('#api-screen .btn-gold');
  btn.disabled = true; btn.textContent = 'Ellenőrzés...';
  try {
    var r = await fetch('/api/ping', { headers: { 'Authorization': 'Bearer ' + k } });
    if(r.status === 401){
      document.getElementById('key-err').style.display = 'block';
      return;
    }
  } catch(e) {
    alert('Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot.'); return;
  } finally {
    btn.disabled = false; btn.textContent = 'Belépés';
  }
  apiKey = k;
  localStorage.setItem('sync_token', k);
  document.getElementById('api-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  launchApp();
}

function changeKey(){
  localStorage.removeItem('sync_token');
  location.reload();
}

// Nav gomb ID-k térképe (active_main értékhez)
var NAV_BTN_IDS = {translate:'nav-translate', roadmap:'nav-roadmap', oxford:'nav-vocab-btn', convo:'nav-convo', tenses:'nav-tenses'};

function launchApp(){
  Store.pull().then(function(){
    var mainName = Store.get('active_main', 'roadmap');
    if(mainName !== 'roadmap'){
      var navBtn = document.getElementById(NAV_BTN_IDS[mainName] || 'nav-roadmap');
      showMain(mainName, navBtn);
    }
    if(mainName === 'tenses'){
      var savedTab = Store.get('active_tense_tab', 'practice');
      // 'tenses' fül eltávolítva — fallback 'practice'-re
      var tabName = (savedTab === 'tenses') ? 'practice' : savedTab;
      var tabBtn = document.getElementById('tense-tab-' + tabName);
      showTenseTab(tabName, tabBtn);
    }
    // Oxford adatok + allCards D1-ből szinkronizált értékek betöltése a memóriába
    oxLoad();
    oxPhraseLoad();
    allCards = Store.get('anki_cards', []);
    renderVocabDashboard();
    renderOxWordlist();
    renderPhrases();
  });
  updateHardModeBtn();
  // Társalgás TTS: mentett állapot visszatöltése (kapcsoló + tempó)
  var ttsBtn=document.getElementById('convo-tts-btn');
  if(ttsBtn) ttsBtn.classList.toggle('active', convoTTSEnabled);
  var ttsRate=document.getElementById('convo-tts-rate');
  if(ttsRate) ttsRate.value = localStorage.getItem('convo_tts_rate') || '1';
  // Böngésző háttérbe kerüléskor a timer megáll, előtérbe jövéskor folytatódik
  document.addEventListener('visibilitychange', function(){
    // A fülre visszaváltás aktivitásnak számít (az idle állapotot is feloldja)
    if(document.hidden) _panelTimer.pause(); else { _activityPing(); _panelTimer.resume(); }
  });
  // Oldal bezárásakor is elmentjük az eltelt időt
  window.addEventListener('beforeunload', function(){ _panelTimer.stop(); });
  oxLoad();
  initProgressPanel();
  renderRoadmap();
  updateRoadmapProgress();
  renderTenseSelector();
  renderTopicPicker();
  updateCounters();
  document.addEventListener('keydown', function(e){
    if(e.key==='Enter' && !e.shiftKey && document.activeElement && document.activeElement.id==='convo-input'){
      e.preventDefault(); convoSend();
    }
    if(e.key==='Enter' && document.getElementById('panel-tenses') && document.getElementById('panel-tenses').classList.contains('active')){
      // Általános gyakorló (tpanel-practice)
      var wrap = document.getElementById('ex-card-wrap');
      if(!wrap || !wrap.innerHTML) return;
      e.preventDefault();
      if(grExState.phase==='question'){ checkGrAnswer(); }
      else if(grExState.phase==='checked'){ nextGrExercise(); }
    }
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest('.nav-dropdown')) closeDropdowns();
  });
}

window.onload = function(){
  var stored = localStorage.getItem('sync_token');
  if(stored){
    apiKey = stored;
    document.getElementById('api-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    launchApp();
  }
};

// ============================================================
// NAVIGATION
// ============================================================
function closeDropdowns(){
  document.querySelectorAll('.nav-dropdown-menu').forEach(function(m){ m.style.display='none'; });
}

function toggleDropdown(id){
  var menu = document.getElementById(id).querySelector('.nav-dropdown-menu');
  var isOpen = menu.style.display === 'block';
  closeDropdowns();
  menu.style.display = isOpen ? 'none' : 'block';
}

function showMain(name, el){
  _activeMain = name;
  _panelTimer.sync(); // tanulási idő kategóriájának frissítése panelváltáskor
  if(name!=='translate' && compSpeaking) compSpeakPause(); // felolvasás szüneteltetése panelváltáskor (a pozíció megmarad)
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-btn,.nav-dropdown-btn,.nav-sub-btn').forEach(function(b){ b.classList.remove('active'); });
  var panel = document.getElementById('panel-'+name);
  if(panel) panel.classList.add('active');
  if(el) el.classList.add('active');
  Store.set('active_main', name);
  if(name==='roadmap'){ initProgressPanel(); }
  if(name==='translate'){ renderGenTopics(); updateGenActionBtn(); }
  if(name==='oxford'){ oxLoad(); oxPhraseLoad(); oxPage=0; renderOxWordlist(); }
  if(name==='convo'){ renderTopicPicker(); }
  if(name==='tenses'){ renderTenseSelector(); }
}

function showSub(panel, sub, el){
  if(compSpeaking && !(panel==='translate'&&sub==='comprehension')) compSpeakPause(); // felolvasás szüneteltetése alfülváltáskor (a pozíció megmarad)
  if(panel==='translate'){ _activeTranslateSub = sub; _panelTimer.sync(); } // időmérés kategóriája Fordítás-aldfül szerint
  var prefix = 'sub-'+panel+'-';
  document.querySelectorAll('[id^="'+prefix+'"]').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('#panel-'+panel+' .sub-tab').forEach(function(b){ b.classList.remove('active'); });
  var target = document.getElementById(prefix+sub);
  if(target) target.classList.add('active');
  if(el) el.classList.add('active');
  if(panel==='translate' && sub==='writing'){
    updateWritingLabels();
    var src = document.getElementById('writing-source');
    if(src && !src.value.trim()){
      if(genDir==='en' && trText) src.value = trText;
      else if(genDir==='hu' && huText) src.value = huText;
    }
  }
  if(panel==='translate' && sub==='comprehension') compInit();
  if(panel==='translate' && sub==='uzleti'){}
  if(panel==='translate' && sub==='text'){ renderGenTopics(); updateGenActionBtn(); }
  if(panel==='roadmap' && sub==='overview'){ renderProgressOverview(); ankiRefreshActivity(); }
  if(panel==='roadmap' && sub==='vocab'){ oxLoad(); oxPhraseLoad(); renderVocabDashboard(); }
  if(panel==='roadmap' && sub==='map'){ renderRoadmap(); updateRoadmapProgress(); }
  if(panel==='roadmap' && sub==='errors') renderErrorPatterns();
  if(panel==='roadmap' && sub==='docs') docLoad();
}

function showOxTab(name, el){
  document.querySelectorAll('.ox-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.ox-panel').forEach(function(p){ p.classList.remove('active'); });
  var panel = document.getElementById('ox-'+name);
  if(panel) panel.classList.add('active');
  if(el) el.classList.add('active');
  if(name==='wordlist'){ oxPage=0; renderOxWordlist(); }
  if(name==='phrases'){ phrasePageIdx=0; renderPhrases(); }
}

function showTenseTab(name, el){
  document.querySelectorAll('.tense-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.tpanel').forEach(function(p){ p.classList.remove('active'); });
  var panel = document.getElementById('tpanel-'+name);
  if(panel) panel.classList.add('active');
  if(el) el.classList.add('active');
  Store.set('active_tense_tab', name);
  if(name==='builder'){ initBuilderTenseSelect(); }
  if(name==='reference') renderGrReference();
}

// ============================================================
// TRANSLATION PANEL
// ============================================================
function getInputText(){
  return (document.getElementById('hu-in').value || '').trim();
}

function doClear(){
  document.getElementById('hu-in').value = '';
  trText = ''; huText = '';
  hide('tr-result');
  document.getElementById('gr-result') && (document.getElementById('gr-result').innerHTML = '');
  updateGenActionBtn();
}

function selectLevel(level, el){
  selectedLevel = level;
  document.querySelectorAll('.lvl-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  updateGenActionBtn();
}

function setTrOutLang(lang, el){
  trOutLang = lang;
  ['tr-out-en','tr-out-hu'].forEach(function(id){
    var b = document.getElementById(id);
    if(b) b.classList.remove('active');
  });
  if(el) el.classList.add('active');
  updateGenActionBtn();
}

// A gomb szövege a bemenettől függ: van szöveg → fordítás, nincs → generálás
function updateGenActionBtn(){
  var btn = document.getElementById('btn-tr');
  if(!btn) return;
  var hasText = ((document.getElementById('hu-in')||{}).value || '').trim().length > 0;
  var langTxt = trOutLang==='en' ? 'EN' : 'HU';
  btn.textContent = hasText ? ('Átalakítás '+selectedLevel+' '+langTxt+'-re') : ('Generálás '+selectedLevel+' '+langTxt);
}

// Egyetlen, kontextusfüggő művelet: ha van bemásolt szöveg → fordítás (téma/utasítás
// szerint módosítva), ha nincs → generálás (kiválasztott téma vagy véletlenszerű).
function doTextAction(){
  var hasText = ((document.getElementById('hu-in')||{}).value || '').trim().length > 0;
  if(hasText) doTranslate();
  else doGenText();
}

async function doTranslate(){
  var inp = getInputText();
  if(!inp) return;
  var lvl = selectedLevel;
  // Ha van téma/utasítás is, a fordítást aszerint módosítjuk
  var ctx = (document.getElementById('gen-context')||{}).value || '';
  var mod = [genSelectedTopic, ctx.trim()].filter(Boolean).join('. ');
  var modNote = mod ? ' Then adapt/rewrite the content according to these instructions: "'+mod+'", while keeping it natural at the level.' : '';
  dis('btn-tr', true); show('tr-loading'); hide('tr-result');
  try{
    var sysPrompt, userPrompt;
    if(trOutLang==='en'){
      sysPrompt='You are an English teacher. The input may be Hungarian OR English. If Hungarian, translate to English. If already English, rewrite at exactly '+lvl+' CEFR level keeping ALL meaning.'+modNote+' Output ONLY the resulting English text.';
      userPrompt='Output '+lvl+' English:\n\n'+inp;
      huText = inp;
    } else {
      sysPrompt='You are a Hungarian teacher. The input may be English OR Hungarian. If English, translate to Hungarian. If already Hungarian, rewrite at exactly '+lvl+' CEFR level keeping ALL meaning.'+modNote+' Output ONLY the resulting Hungarian text.';
      userPrompt='Output '+lvl+' Hungarian:\n\n'+inp;
    }
    var r = await claude(sysPrompt, userPrompt);
    trText = r.trim();
    if(trOutLang==='hu') huText = trText;
    genDir = trOutLang;
    renderTrText(trText);
    var langLabel = trOutLang==='en' ? lvl+' angol' : lvl+' magyar';
    document.getElementById('tr-result-label').innerHTML = langLabel+' — <span style="text-transform:none;letter-spacing:0;color:var(--faint)">kattints egy szóra</span>';
    document.getElementById('gr-result').innerHTML = '';
    show('tr-result');
  } catch(e){
    document.getElementById('tr-text').innerHTML = '<div class="err">Hiba: '+e.message+'</div>';
    show('tr-result');
  }
  hide('tr-loading'); dis('btn-tr', false);
}

function renderTrText(text){
  var words = text.split(/(\s+)/);
  var html = words.map(function(w, i){
    if(/^\s+$/.test(w)) return w;
    var clean = w.replace(/[^a-zA-Z'-]/g,'').toLowerCase();
    var sel = selWords.has(clean);
    return '<span class="tr-word'+(sel?' selected':'')+'" data-word="'+clean+'" onclick="toggleWord(this)">'+w+'</span>';
  }).join('');
  document.getElementById('tr-text').innerHTML = html;
}

function toggleWord(el){
  var w = el.getAttribute('data-word');
  if(!w) return;
  if(selWords.has(w)){ selWords.delete(w); el.classList.remove('selected'); }
  else { selWords.add(w); el.classList.add('selected'); }
  updateSelBar();
}

function updateSelBar(){
  var bar = document.getElementById('sel-bar');
  var btn = document.getElementById('btn-gen');
  if(selWords.size===0){
    bar.innerHTML = '<span class="hint-text">Kattints szavakra fent...</span>';
    if(btn) btn.style.display='none';
  } else {
    var words = Array.from(selWords);
    bar.innerHTML = words.map(function(w){ return '<span class="sel-chip" onclick="removeWord(\''+w+'\')">'+w+' ✕</span>'; }).join(' ');
    if(btn) btn.style.display='inline-block';
  }
}

function removeWord(w){
  selWords.delete(w);
  document.querySelectorAll('.tr-word').forEach(function(el){ if(el.getAttribute('data-word')===w) el.classList.remove('selected'); });
  updateSelBar();
}

async function doGenCards(){
  if(!selWords.size) return;
  var words = Array.from(selWords);
  dis('btn-gen', true); show('gen-loading');
  try{
    var r = await claude(
      'Create Anki flashcards for an English learner. Return JSON array: [{"english":"word","hungarian":"HU meaning","example":"B1 sentence","collocations":"3 collocations with HU · format"}]. Output ONLY the JSON array.',
      'Create cards for: '+words.join(', ')
    );
    var cards = safeParseJSON(r);
    if(!Array.isArray(cards)) cards = [cards];
    cards.forEach(function(c){ allCards.push(c); });
    saveCards();
    updateCounters();
    selWords.clear();
    updateSelBar();
    document.getElementById('gen-loading').insertAdjacentHTML('afterend', '<div class="ok-box">'+cards.length+' kártya generálva!</div>');
  } catch(e){
    document.getElementById('gen-loading').insertAdjacentHTML('afterend', '<div class="err">Hiba: '+e.message+'</div>');
  }
  hide('gen-loading'); dis('btn-gen', false);
}

async function doGrammar(){
  var text = trText;
  if(!text){ document.getElementById('gr-result').innerHTML='<div class="err">Először fordíts le egy szöveget.</div>'; return; }
  document.getElementById('gr-result').innerHTML='<div class="loading"><div class="dots"><span></span><span></span><span></span></div> Elemzés...</div>';
  try{
    var r = await claude(
      'You are an English grammar teacher. Analyze the grammar patterns in the given text. Identify: 1) tenses used 2) notable structures 3) B1 learner tips. Reply in Hungarian.',
      'Analyze this text:\n'+text
    );
    document.getElementById('gr-result').innerHTML = '<div style="font-size:.88rem;line-height:1.8">'+r.replace(/\n/g,'<br>')+'</div>';
  } catch(e){
    document.getElementById('gr-result').innerHTML = '<div class="err">Hiba: '+e.message+'</div>';
  }
}

// ============================================================
// WRITING PANEL (Fordítás fül)
// ============================================================

function setWritingType(type, el){
  writingType = type;
  document.querySelectorAll('.writing-type-btn').forEach(function(b){
    if(b.getAttribute('onclick') && b.getAttribute('onclick').indexOf('setWritingType') > -1)
      b.classList.remove('active');
  });
  if(el) el.classList.add('active');
  var emailGroup = document.getElementById('email-tone-group');
  if(emailGroup) emailGroup.style.display = type === 'email' ? 'flex' : 'none';
}

function setEmailTone(tone, el){
  emailTone = tone;
  document.querySelectorAll('.writing-type-btn').forEach(function(b){
    if(b.getAttribute('onclick') && b.getAttribute('onclick').indexOf('setEmailTone') > -1)
      b.classList.remove('active');
  });
  if(el) el.classList.add('active');
}

function getWritingTypePrompt(){
  var typePrompts = {
    'general': 'Analyze this translation/writing. Evaluate grammar, vocabulary, and naturalness.',
    'email': 'Analyze this business email in English. Evaluate: 1) Register/tone ('+(emailTone === 'formal' ? 'should be formal' : emailTone === 'neutral' ? 'neutral tone' : 'informal/friendly')+'), 2) Structure (greeting, body, closing), 3) Grammar, 4) Professional vocabulary.',
    'report': 'Analyze this business report/text in English. Evaluate: 1) Formal register, 2) Nominalisation and professional vocabulary, 3) Logical structure, 4) Grammar accuracy.',
    'presentation': 'Analyze this presentation text in English. Evaluate: 1) Clear structure, 2) Persuasive language, 3) Transition phrases, 4) Grammar.'
  };
  return typePrompts[writingType] || typePrompts['general'];
}


async function generateWritingTask(){
  var btn = document.querySelector('[onclick="generateWritingTask()"]');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Generálás...'; }

  var taskPrompts = {
    'general': 'Generate a B1-B2 English writing task in Hungarian. Give a concrete situation the student must write about in English (3-5 sentences). Make it realistic and business-related.',
    'email': 'Generate a B1-B2 business email writing task in Hungarian. Describe who to write to, what about, and what tone ('+(emailTone==='formal'?'formal/official':'neutral/friendly')+') (3-4 sentences). Be specific.',
    'report': 'Generate a B1-B2 business report writing task in Hungarian. Describe the report topic, audience, and key points to include (3-4 sentences).',
    'presentation': 'Generate a B1-B2 presentation writing task in Hungarian. Describe the presentation topic, audience, and slide/section to write (3-4 sentences).'
  };

  try {
    var r = await claude(
      'You are a business English teacher. Generate a writing task description in Hungarian only. Be specific and practical. Output only the task description, no title, no extra text.',
      taskPrompts[writingType] || taskPrompts['general']
    );
    var task = r.trim();

    // Show task box
    document.getElementById('task-gen-box').style.display = 'block';
    document.getElementById('task-gen-text').textContent = task;

    // Put task in source, clear target
    var src = document.getElementById('writing-source');
    var tgt = document.getElementById('my-tr');
    if(src) src.value = task;
    if(tgt) tgt.value = '';

    // Set direction to hu→en
    genDir = 'hu';
    updateWritingLabels();

    // Clear previous results
    var cr = document.getElementById('check-result');
    if(cr) cr.innerHTML = '';

  } catch(e) {
    document.getElementById('task-gen-box').style.display = 'block';
    document.getElementById('task-gen-text').textContent = 'Hiba: ' + e.message;
  }

  if(btn){ btn.disabled = false; btn.textContent = '🎯 Feladat generálása'; }
}


// ============================================================
// ÜZLETI ÍRÁS MODUL
// ============================================================
var uzletiType = 'general';
var uzletiTone = 'formal';
var uzletiTask = '';

function setUzletiType(type, el){
  uzletiType = type;
  document.querySelectorAll('[id^="uzl-type-"]').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  var toneGroup = document.getElementById('uzl-tone-group');
  if(toneGroup) toneGroup.style.display = type === 'email' ? 'flex' : 'none';
}

function setUzletiTone(tone, el){
  uzletiTone = tone;
  document.querySelectorAll('[id^="uzl-tone-"]').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
}

async function generateUzletiTask(){
  var btn = document.getElementById('uzl-gen-btn');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Generálás...'; }

  var typePrompts = {
    'general': 'Generate a B1-B2 English writing task in Hungarian. Give a concrete business situation (3-4 sentences). The student must write the English text themselves.',
    'email': 'Generate a B1-B2 business email writing task in Hungarian. Specify: recipient, subject, tone ('+(uzletiTone==='formal'?'formal':'neutral/friendly')+'), key points to include. Be specific (3-4 sentences).',
    'report': 'Generate a B1-B2 business report section writing task in Hungarian. Specify topic, audience, required content (3-4 sentences).',
    'presentation': 'Generate a B1-B2 presentation slide/section writing task in Hungarian. Specify topic, audience, slide type (3-4 sentences).'
  };

  var typeLabels = {
    'general': 'Általános szöveg',
    'email': 'E-mail ('+(uzletiTone==='formal'?'formális':uzletiTone==='neutral'?'semleges':'informális')+')',
    'report': 'Jelentés',
    'presentation': 'Prezentáció'
  };

  try {
    var r = await claude(
      'You are a business English teacher. Generate ONE writing task in Hungarian. Be specific about the situation. Output ONLY the task description (3-4 sentences), no title, no labels.',
      typePrompts[uzletiType] || typePrompts['general']
    );
    uzletiTask = r.trim();

    var taskBox = document.getElementById('uzl-task-box');
    var taskText = document.getElementById('uzl-task-text');
    var writeArea = document.getElementById('uzl-write-area');
    var answer = document.getElementById('uzl-answer');
    var result = document.getElementById('uzl-check-result');

    if(taskBox) taskBox.style.display = 'block';
    if(taskText) taskText.textContent = uzletiTask;
    if(writeArea) writeArea.style.display = 'block';
    if(answer) answer.value = '';
    if(result) result.innerHTML = '';

  } catch(e) {
    var taskBox = document.getElementById('uzl-task-box');
    var taskText = document.getElementById('uzl-task-text');
    if(taskBox) taskBox.style.display = 'block';
    if(taskText) taskText.textContent = 'Hiba: ' + e.message;
  }

  if(btn){ btn.disabled = false; btn.textContent = '🎯 Feladat generálása'; }
}

async function checkUzletiAnswer(){
  var answer = document.getElementById('uzl-answer');
  var my = answer ? answer.value.trim() : '';
  if(!my || !uzletiTask) return;

  dis('uzl-gen-btn', true);
  show('uzl-check-loading');
  document.getElementById('uzl-check-result').innerHTML = '';

  var typeSpecific = {
    'general': 'Evaluate grammar, vocabulary, and naturalness.',
    'email': 'Evaluate: 1) Register/tone ('+(uzletiTone==='formal'?'should be formal':'neutral/friendly')+'), 2) Structure (greeting, body, closing), 3) Grammar, 4) Professional vocabulary.',
    'report': 'Evaluate: 1) Formal register, 2) Nominalisation and professional vocabulary, 3) Logical structure, 4) Grammar.',
    'presentation': 'Evaluate: 1) Clear structure, 2) Persuasive language, 3) Transition phrases, 4) Grammar.'
  };

  try {
    var r = await claude(
      'You are an English teacher for Hungarian B1 learners. The student was given a writing task and wrote an English text. ' + (typeSpecific[uzletiType]||typeSpecific['general']) + ' ALL text fields MUST be in Hungarian. Return ONLY valid JSON (no markdown, no linebreaks inside strings): {"score":1-10,"overall":"HU summary","positives":["HU"],"corrected_text":"improved version of student text","corrections":[{"type":"grammar|style|typo","wrong":"phrase","right":"fix","explanation":"HU"}],"roadmap":{"topics_ok":[],"topics_wrong":[]}}. Include ALL errors. For "roadmap": classify grammar topics from this list — TOPICS: '+roadmapTopicsForPrompt()+'. topics_wrong = ids whose grammar the student got WRONG; topics_ok = ids used CORRECTLY. Use ONLY ids from the list; empty arrays if unsure.',
      'Task (Hungarian): "' + uzletiTask + '"\n\nStudent English text:\n"' + my + '"',
      2000
    );
    var d = safeParseJSON(r);
    if(typeof d.score === 'number'){ logSkillResult('writing', d.score/10, 1); recordAttribution(d.roadmap); }
    var scoreColor = d.score>=8?'var(--success)':d.score>=6?'var(--accent)':'var(--danger)';
    var html = '<div class="score-display"><span class="score-num" style="color:'+scoreColor+'">'+d.score+'</span><span class="score-denom">/10</span><span class="score-msg">'+(d.overall||'')+'</span></div>';

    if(d.corrected_text){
      html += '<div class="corrected-text-box">'
        + '<div class="corrected-text-label">✓ Javított változat</div>'
        + '<div class="corrected-text-content">'+d.corrected_text+'</div>'
        + '</div>';
    }
    if(d.positives && d.positives.length){
      html += '<div class="positive-box">';
      d.positives.forEach(function(p){ html += '<div class="positive-item">✓ '+p+'</div>'; });
      html += '</div>';
    }
    if(d.corrections && d.corrections.length){
      var groups = {'grammar':[], 'style':[], 'typo':[]};
      var groupLabels = {'grammar':'🔴 Nyelvtani hibák', 'style':'🟡 Stílus / regiszter', 'typo':'🔵 Elütések'};
      d.corrections.forEach(function(c, i){ var t = c.type||'grammar'; if(!groups[t]) groups[t]=[]; groups[t].push({c:c,i:i}); });
      html += '<div style="font-size:.78rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:1rem 0 .5rem">Javítások ('+d.corrections.length+')</div>';
      ['grammar','style','typo'].forEach(function(type){
        if(!groups[type].length) return;
        html += '<div class="corr-group-header">'+groupLabels[type]+'</div>';
        groups[type].forEach(function(item){
          var c = item.c, i = item.i;
          html += '<div class="corr-item '+type+'">';
          html += '<div class="corr-wrong">✗ '+c.wrong+'</div>';
          html += '<div class="corr-right">✓ '+c.right+'</div>';
          html += '<div class="corr-exp">'+c.explanation+'</div>';
          html += '</div>';
        });
      });
    } else {
      html += '<div class="ok-box">Nem találtam lényeges hibát. Kiváló munka!</div>';
    }
    if(d.corrections && d.corrections.length){
      d.corrections.forEach(function(c){ if(c.wrong&&c.right) addErrorPattern(c.wrong,c.right,c.type||'grammar',c.explanation||''); });
    }
    document.getElementById('uzl-check-result').innerHTML = html;
  } catch(e) {
    document.getElementById('uzl-check-result').innerHTML = '<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('uzl-check-loading');
  dis('uzl-gen-btn', false);
}


// ============================================================
// TANULÁSI ASSZISZTENS
// ============================================================
var tutorHistory = [];

function tutorSend(){
  var inp = document.getElementById('tutor-input');
  var msg = inp ? inp.value.trim() : '';
  if(!msg) return;
  inp.value = '';

  tutorAddBubble('user', msg);
  tutorHistory.push({role:'user', content: msg});
  tutorGetReply(msg);
}

// Mini markdown → HTML renderer (csak asszisztens válaszokhoz)
function renderMd(text){
  var s = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); // XSS védelem
  // Headings → félkövér blokk
  s = s.replace(/^### (.+)$/gm,'<strong class="md-h3">$1</strong>');
  s = s.replace(/^## (.+)$/gm,'<strong class="md-h2">$1</strong>');
  s = s.replace(/^# (.+)$/gm,'<strong class="md-h1">$1</strong>');
  // Bold + italic kombináció előbb
  s = s.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+?)\*/g,'<em>$1</em>');
  // Inline code
  s = s.replace(/`([^`\n]+)`/g,'<code class="md-code">$1</code>');
  // Listaelemek
  s = s.replace(/^[-*]\s+(.+)$/gm,'<li>$1</li>');
  s = s.replace(/(<li>.*<\/li>(\n|$))+/g,'<ul class="md-ul">$&</ul>');
  // Bekezdések (kettős újsor)
  s = s.split('\n\n').map(function(p){ return '<p class="md-p">'+p+'</p>'; }).join('');
  // Maradék újsor
  s = s.replace(/\n/g,'<br>');
  return s;
}

function tutorAddBubble(role, text){
  var wrap = document.getElementById('tutor-messages');
  if(!wrap) return;
  var div = document.createElement('div');
  div.className = 'tutor-bubble tutor-bubble-' + role;
  div.innerHTML = role === 'assistant' ? renderMd(text) : text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

async function tutorGetReply(msg){
  tutorAddBubble('thinking', '...');

  // Build context from app state
  var activeWords = oxWords.filter(function(w){ return w.s==='active'; }).length;
  var errors = JSON.parse(localStorage.getItem('error_patterns')||'[]');
  var activeErrors = errors.filter(function(e){ return e.status==='active'; }).slice(0,5).map(function(e){ return e.wrong+' → '+e.right; }).join(', ');
  var roadmapDone = 0, roadmapTotal = 0;
  ROADMAP.forEach(function(band){ band.items.forEach(function(item){ roadmapTotal++; if(itemMastery(item.id).state==='green') roadmapDone++; }); });
  var recentLog = localStorage.getItem('doc_log') || '';
  recentLog = recentLog.slice(-500);

  var systemPrompt = 'You are a friendly English learning coach for a Hungarian B1 learner targeting C1. '
    + 'Current stats: active vocabulary: '+activeWords+' words, roadmap progress: '+roadmapDone+'/'+roadmapTotal+' topics done. '
    + (activeErrors ? 'Active error patterns: '+activeErrors+'. ' : '')
    + (recentLog ? 'Recent log excerpt: "'+recentLog+'". ' : '')
    + 'Answer in Hungarian. Be specific, practical, encouraging. Max 4-5 sentences unless asked for more.';

  var messages = tutorHistory.slice(-10).map(function(m){
    return {role: m.role==='user'?'user':'assistant', content: m.content};
  });

  try {
    var r = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages
      })
    });
    var d = await r.json();
    if(d.error) throw new Error(d.error.message);
    var reply = d.content[0].text.trim();
    tutorHistory.push({role:'assistant', content: reply});

    // Remove thinking bubble
    var wrap = document.getElementById('tutor-messages');
    var thinking = wrap ? wrap.querySelector('.tutor-bubble-thinking') : null;
    if(thinking) thinking.remove();

    tutorAddBubble('assistant', reply);
  } catch(e) {
    var wrap = document.getElementById('tutor-messages');
    var thinking = wrap ? wrap.querySelector('.tutor-bubble-thinking') : null;
    if(thinking) thinking.remove();
    tutorAddBubble('assistant', 'Hiba: ' + e.message);
  }
}

// Enter to send in tutor
document.addEventListener('keydown', function(e){
  if(e.key==='Enter' && !e.shiftKey && document.activeElement && document.activeElement.id==='tutor-input'){
    e.preventDefault();
    tutorSend();
  }
});


// ============================================================
// MONDATSZERKESZTÉS MODUL
// ============================================================
var bldSentType = 'any';     // 'positive' | 'negative' | 'question' | 'any'
var bldCurrentTask = null;   // {hu, answer, tense, type, words}

function toggleBldTenseDropdown(){
  var picker = document.getElementById('bld-tense-picker');
  var arrow  = document.getElementById('bld-tense-arrow');
  if(!picker) return;
  var open = picker.style.display !== 'none';
  picker.style.display = open ? 'none' : 'block';
  if(arrow) arrow.textContent = open ? '▾' : '▴';
}

function updateBldTenseSummary(){
  var el = document.getElementById('bld-tense-summary');
  if(!el) return;
  el.textContent = bldSelectedTenses.size === 0
    ? 'Igeidő: Véletlenszerű (összes)'
    : 'Igeidő: ' + bldSelectedTenses.size + ' kiválasztva';
}

function setBldType(type, el){
  bldSentType = type;
  document.querySelectorAll('[id^="bld-type-"]').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  Store.set('bld_sent_type', type);
}

function toggleBldMeta(){
  var meta = document.getElementById('bld-task-meta');
  var btn = document.getElementById('bld-meta-toggle');
  if(!meta) return;
  var visible = meta.style.display !== 'none';
  meta.style.display = visible ? 'none' : 'flex';
  if(btn) btn.textContent = visible ? '▾ Igeidő / Típus' : '▴ Igeidő / Típus';
}

var bldSelectedTenses = new Set();

function initBuilderTenseSelect(){
  var wrap = document.getElementById('bld-tense-picker');
  if(!wrap || wrap.dataset.built) return;
  wrap.dataset.built = '1';

  // Mentett szelekció visszaállítása
  var saved = Store.get('bld_selected_tenses', []);
  bldSelectedTenses = new Set(saved);

  // Szintenként csoportosított igeidők
  ROADMAP.forEach(function(band){
    var tenses = band.items.filter(function(item){
      return GRAMMAR_EXERCISES[item.id] && GRAMMAR_EXERCISES[item.id].category === 'tense';
    });
    if(!tenses.length) return;

    var group = document.createElement('div');
    group.style.cssText = 'margin-bottom:.7rem';

    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px';
    lbl.textContent = band.level + ' — ' + band.title.replace(/^[A-Z0-9]+ — /, '');
    group.appendChild(lbl);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';

    tenses.forEach(function(item){
      var chip = document.createElement('div');
      chip.className = 'tense-chip chip-tense' + (bldSelectedTenses.has(item.id) ? ' selected' : '');
      chip.setAttribute('data-id', item.id);
      chip.innerHTML = '<div class="tc-name">' + item.en + '</div>';
      chip.onclick = function(){
        if(bldSelectedTenses.has(item.id)){
          bldSelectedTenses.delete(item.id);
          chip.classList.remove('selected');
        } else {
          bldSelectedTenses.add(item.id);
          chip.classList.add('selected');
        }
        Store.set('bld_selected_tenses', Array.from(bldSelectedTenses));
        updateBldTenseSummary();
      };
      row.appendChild(chip);
    });

    group.appendChild(row);
    wrap.appendChild(group);
  });

  // Mindet / Törlés gombok
  var actions = document.createElement('div');
  actions.style.cssText = 'margin-top:.5rem;display:flex;gap:6px;border-top:1px solid var(--border);padding-top:.5rem';
  actions.innerHTML = '<button class="btn btn-outline btn-sm" onclick="bldSelectAllTenses()">Mindet</button>'
    + '<button class="btn btn-outline btn-sm" onclick="bldClearTenses()">Törlés</button>';
  wrap.appendChild(actions);

  updateBldTenseSummary();

  // Mentett típus visszaállítása
  var savedSentType = Store.get('bld_sent_type', null);
  if(savedSentType){
    var typeMap = {positive:'pos', negative:'neg', question:'q', any:'any'};
    var sBtn = document.getElementById('bld-type-' + (typeMap[savedSentType] || 'any'));
    setBldType(savedSentType, sBtn);
  }
}

function bldSelectAllTenses(){
  document.querySelectorAll('#bld-tense-picker [data-id]').forEach(function(c){
    var id = c.getAttribute('data-id');
    if(id){ bldSelectedTenses.add(id); c.classList.add('selected'); }
  });
  Store.set('bld_selected_tenses', Array.from(bldSelectedTenses));
  updateBldTenseSummary();
}

function bldClearTenses(){
  bldSelectedTenses.clear();
  document.querySelectorAll('#bld-tense-picker [data-id]').forEach(function(c){
    c.classList.remove('selected');
  });
  Store.set('bld_selected_tenses', []);
  updateBldTenseSummary();
}

async function builderGenerate(){
  var btn = document.getElementById('bld-gen-btn');
  if(btn){ btn.disabled = true; }
  show('bld-loading');
  document.getElementById('bld-result').innerHTML = '';
  document.getElementById('bld-task-card').style.display = 'none';
  var metaEl = document.getElementById('bld-task-meta');
  if(metaEl) metaEl.style.display = 'none';
  var metaBtn = document.getElementById('bld-meta-toggle');
  if(metaBtn) metaBtn.textContent = '▾ Igeidő / Típus';

  // Pick tense — ha van kiválasztva, abból véletlenszerű; ha nincs, az összes közül
  var pool = bldSelectedTenses.size > 0
    ? Array.from(bldSelectedTenses)
    : Object.keys(GRAMMAR_EXERCISES).filter(function(id){ return GRAMMAR_EXERCISES[id].category === 'tense'; });
  var tenseId = pool[Math.floor(Math.random() * pool.length)];

  var rmItem = null;
  ROADMAP.forEach(function(band){ band.items.forEach(function(i){ if(i.id===tenseId) rmItem=i; }); });
  var tenseName = rmItem ? rmItem.en : tenseId;
  var tenseLevel = GRAMMAR_EXERCISES[tenseId] ? GRAMMAR_EXERCISES[tenseId].level : 'B1';

  // Pick sentence type
  var types = ['positive', 'negative', 'question'];
  var sentType = bldSentType === 'any' ? types[Math.floor(Math.random() * 3)] : bldSentType;

  var typeLabels = {'positive': 'Állítás (+)', 'negative': 'Tagadás (−)', 'question': 'Kérdés (?)'};

  try {
    // Komplexitás a FELHASZNÁLÓ B1→C1 szintjéhez igazodik, nem az igeidő CEFR szintjéhez.
    // Az igeidő szintje (tenseLevel) csak kontextus a Claude-nak — a mondat mindig B1+ összetettségű.
    var bldComplexity = tenseLevel === 'C1'
      ? 'Write a sophisticated sentence with multiple clauses (14+ words).'
      : tenseLevel === 'B2'
        ? 'Write a complex sentence with a subordinate clause (12+ words).'
        : 'Write a moderately complex sentence (9–13 words) — avoid overly short or simple sentences.';
    var bldWordCount = (tenseLevel === 'B2' || tenseLevel === 'C1') ? '6-8' : '5-7';
    var bldTopics = ['everyday life', 'travel', 'social situations', 'technology'];
    var bldTopic = Math.random() < 0.5
      ? 'business English'
      : bldTopics[Math.floor(Math.random() * bldTopics.length)];

    var bldSys = 'Output ONLY a JSON object with these exact keys: hu, answer, words. No markdown, no extra text. Do not repeat any sentence.';
    var bldMsg = 'Tense: ' + tenseName + '. Sentence type: ' + sentType + '. Level: ' + tenseLevel + '.'
      + ' Generate a sentence building exercise in the context of ' + bldTopic + '. ' + bldComplexity
      + ' Return JSON only: hu (Hungarian translation), answer (correct English sentence),'
      + ' words (array of ' + bldWordCount + ' base-form content words, no articles or auxiliaries).';
    var r = await claude(bldSys, bldMsg, 500);
    console.log('Builder raw:', r);
    var d = safeParseJSON(r);
    if(!d || !d.hu || !d.answer || !d.words) throw new Error('Hiányzó mezők: ' + JSON.stringify(Object.keys(d||{})));

    bldCurrentTask = {
      hu: d.hu,
      answer: d.answer,
      tense: tenseName,
      tenseId: tenseId,
      type: sentType,
      words: d.words
    };

    // Render task card
    document.getElementById('bld-hu-text').textContent = d.hu;
    document.getElementById('bld-tense-label').textContent = tenseName;
    document.getElementById('bld-type-label').textContent = typeLabels[sentType] || sentType;

    // Igeidő képzése — csak az aktuális típus sora
    var typePrefix = {positive:'(+)', negative:'(-)', question:'(?)'}[sentType];
    var schemaLine = rmItem && rmItem.form
      ? (rmItem.form.find(function(f){ return f.startsWith(typePrefix); }) || '')
      : '';
    var schemaEl = document.getElementById('bld-schema-line');
    if(schemaEl) schemaEl.textContent = schemaLine;
    var useEl = document.getElementById('bld-tense-use');
    if(useEl) useEl.textContent = rmItem ? (rmItem.use || '') : '';

    var chipsHtml = d.words.map(function(w){
      return '<span class="bld-word-chip">'+w+'</span>';
    }).join('');
    document.getElementById('bld-word-chips').innerHTML = chipsHtml;

    document.getElementById('bld-answer').value = '';
    document.getElementById('bld-result').innerHTML = '';
    document.getElementById('bld-task-card').style.display = 'block';

    // Focus
    setTimeout(function(){ var a = document.getElementById('bld-answer'); if(a) a.focus(); }, 100);

  } catch(e) {
    document.getElementById('bld-task-card').style.display = 'block';
    document.getElementById('bld-result').innerHTML = '<div class="err">'
      + 'Hiba: ' + e.message
      + '<br><small>apiKey: ' + (apiKey ? apiKey.substring(0,8)+'...' : 'ÜRES!') + '</small>'
      + '<br><small>tenseName: ' + tenseName + '</small>'
      + '<br><small>sentType: ' + sentType + '</small>'
      + '</div>';
  }

  hide('bld-loading');
  if(btn){ btn.disabled = false; }
}

async function builderCheck(){
  if(!bldCurrentTask) return;
  var ans = document.getElementById('bld-answer').value.trim();
  if(!ans) return;

  show('bld-check-loading');
  document.getElementById('bld-result').innerHTML = '';

  try {
    var r = await claude(
      'You are an English grammar teacher for a Hungarian B1 learner. Evaluate this sentence building exercise. Return ONLY valid JSON on a single line. CRITICAL: never use double quotes inside string values — use single quotes instead. Schema: {"correct":true/false,"score":1-10,"feedback":"HU explanation","corrected":"correct English sentence","errors":[{"wrong":"phrase","right":"fix","explanation":"HU"}]}.',
      'Tense: ' + bldCurrentTask.tense + '. Type: ' + bldCurrentTask.type + '.\nHungarian: ' + bldCurrentTask.hu + '\nExpected: ' + bldCurrentTask.answer + '\nStudent: ' + ans,
      600
    );
    var d = safeParseJSON(r);
    var isCorrect = d.correct || d.score >= 8;
    var scoreColor = isCorrect ? 'var(--success)' : d.score >= 6 ? 'var(--accent)' : 'var(--danger)';

    var html = '<div class="score-display">'
      + '<span class="score-num" style="color:'+scoreColor+'">' + (d.score||'—') + '</span>'
      + '<span class="score-denom">/10</span>'
      + (isCorrect ? '<span class="score-msg">✓ Helyes!</span>' : '<span class="score-msg">' + (d.feedback||'') + '</span>')
      + '</div>';

    if(!isCorrect && d.corrected){
      html += '<div class="corrected-text-box">'
        + '<div class="corrected-text-label">✓ Helyes mondat</div>'
        + '<div class="corrected-text-content">' + d.corrected + '</div>'
        + '</div>';
    }

    if(d.errors && d.errors.length){
      d.errors.forEach(function(e){
        html += '<div class="corr-item grammar">'
          + '<div class="corr-wrong">✗ ' + e.wrong + '</div>'
          + '<div class="corr-right">✓ ' + e.right + '</div>'
          + '<div class="corr-exp">' + e.explanation + '</div>'
          + '</div>';
        if(e.wrong && e.right) addErrorPattern(e.wrong, e.right, 'grammar', e.explanation||'');
      });
    }

    if(isCorrect){
      html += '<div class="ok-box">Kiváló! Próbálj egy másik mondatot.</div>';
    }

    document.getElementById('bld-result').innerHTML = html;

    // Save to error patterns if wrong
    if(!isCorrect && bldCurrentTask.answer){
      addErrorPattern(ans.substring(0,60), bldCurrentTask.answer, 'grammar', bldCurrentTask.tense + ' — ' + bldCurrentTask.type);
    }

  } catch(e) {
    document.getElementById('bld-result').innerHTML = '<div class="err">Ellenőrzési hiba: ' + e.message + '</div>';
  }

  hide('bld-check-loading');
}

function builderShowAnswer(){
  if(!bldCurrentTask) return;
  document.getElementById('bld-result').innerHTML =
    '<div class="corrected-text-box">'
    + '<div class="corrected-text-label">Helyes mondat</div>'
    + '<div class="corrected-text-content">' + bldCurrentTask.answer + '</div>'
    + '</div>';
  var ans = document.getElementById('bld-answer');
  if(ans){ ans.value = bldCurrentTask.answer; }
}

function setWritingDir(dir, el){
  writingDir = dir;
  document.querySelectorAll('.writing-dir-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
}

function renderGenTopics(){
  var container = document.getElementById('gen-topic-chips');
  if(!container) return;
  if(container.querySelectorAll('.gen-topic-chip').length) return;
  var html = '';
  CONVO_TOPICS.forEach(function(g){
    g.topics.forEach(function(t){
      html += '<button class="gen-topic-chip" onclick="selectGenTopic(\''+t.replace(/'/g,"\\'")+'\')" data-topic="'+t.replace(/"/g,'&quot;')+'">'+t+'</button>';
    });
  });
  container.innerHTML = html;
}

function selectGenTopic(topic){
  genSelectedTopic = topic;
  document.querySelectorAll('.gen-topic-chip').forEach(function(c){ c.classList.toggle('selected', c.getAttribute('data-topic')===topic); });
  var sel = document.getElementById('gen-topic-selected');
  var lbl = document.getElementById('gen-topic-selected-label');
  if(sel) sel.style.display='block';
  if(lbl) lbl.textContent = '📌 '+topic;
}

function genClearTopic(){
  genSelectedTopic = '';
  document.querySelectorAll('.gen-topic-chip').forEach(function(c){ c.classList.remove('selected'); });
  var sel = document.getElementById('gen-topic-selected');
  if(sel) sel.style.display='none';
}

async function doGenText(){
  var context = ((document.getElementById('gen-context')||{}).value || '').trim();
  var lvl = selectedLevel, outLang = trOutLang; // közös szint + kimeneti nyelv
  dis('btn-tr', true); show('tr-loading'); hide('tr-result');
  var topicStr = genSelectedTopic || context || (outLang==='en' ? 'business communication' : 'üzleti kommunikáció');
  var extraNote = (genSelectedTopic && context) ? ' Additional notes: '+context : '';
  try{
    var r = await claude(
      outLang==='en'
        ? 'Generate a natural English text at '+lvl+' CEFR level. Topic: "'+topicStr+'".'+extraNote+' Length: 60-100 words. Output ONLY the English text, no title, no explanation.'
        : 'Generate a natural Hungarian text at '+lvl+' CEFR level difficulty. Topic: "'+topicStr+'".'+extraNote+' Length: 60-100 words. Output ONLY the Hungarian text, no title, no explanation.',
      'Generate the text.'
    );
    var generated = r.trim();
    trText = generated; huText = (outLang==='hu') ? generated : '';
    genDir = outLang;
    renderTrText(generated); // ugyanabba a kattintható dobozba kerül, mint a fordítás
    var langLabel = (outLang==='en' ? lvl+' angol' : lvl+' magyar') + ' (generált)';
    var lbl = document.getElementById('tr-result-label');
    if(lbl) lbl.innerHTML = langLabel+' — <span style="text-transform:none;letter-spacing:0;color:var(--faint)">kattints egy szóra</span>';
    var gr = document.getElementById('gr-result'); if(gr) gr.innerHTML='';
    var src = document.getElementById('writing-source'); if(src) src.value = generated;
    var cr = document.getElementById('check-result'); if(cr) cr.innerHTML='';
    updateWritingLabels();
    show('tr-result');
  } catch(e){
    document.getElementById('tr-text').innerHTML = '<div class="err">Hiba: '+e.message+'</div>';
    show('tr-result');
  }
  hide('tr-loading'); dis('btn-tr', false);
}

async function doCheck(){
  var my = document.getElementById('my-tr').value.trim();
  if(!my) return;
  var sourceEl = document.getElementById('writing-source');
  var sourceText = sourceEl ? sourceEl.value.trim() : '';
  if(!sourceText){ document.getElementById('check-result').innerHTML='<div class="err">Nincs forrásnyelvi szöveg!</div>'; return; }
  // Detect direction from source text (Hungarian chars = HU→EN)
  var isHuEn = detectHungarian(sourceText);
  dis('btn-check', true); show('check-loading');
  document.getElementById('check-result').innerHTML = '';
  try{
    var r = await claude(
      'You are an English teacher for Hungarian B1 learners. ' + getWritingTypePrompt() + ' ALL text fields in Hungarian. Return ONLY a single line of valid JSON, no markdown, no newlines inside strings. Schema: {"score":0,"overall":"","positives":[],"corrected_text":"","corrections":[{"type":"grammar","wrong":"","right":"","explanation":""}],"roadmap":{"topics_ok":[],"topics_wrong":[]}}. Fill all fields. Escape any quotes inside strings. For "roadmap": classify grammar topics from this list — TOPICS: '+roadmapTopicsForPrompt()+'. topics_wrong = ids whose grammar the student got WRONG; topics_ok = ids the student clearly used CORRECTLY. Use ONLY ids from the list; empty arrays if unsure.',
      (isHuEn
        ? 'Source Hungarian text:\n"'+sourceText.substring(0,600)+'"\n\nStudent English translation:\n"'+my+'"'
        : 'Source English text:\n"'+sourceText.substring(0,600)+'"\n\nStudent Hungarian translation:\n"'+my+'"')
    );
    var d = safeParseJSON(r);
    if(typeof d.score === 'number'){ logSkillResult('writing', d.score/10, 1); recordAttribution(d.roadmap); }
    var scoreColor = d.score>=8?'var(--success)':d.score>=6?'var(--accent)':'var(--danger)';
    var html = '<div class="score-display"><span class="score-num" style="color:'+scoreColor+'">'+d.score+'</span><span class="score-denom">/10</span><span class="score-msg">'+(d.overall||'')+' </span></div>';
    if(d.corrected_text){
      html += '<div class="corrected-text-box">'
        + '<div class="corrected-text-label">✓ Helyes fordítás</div>'
        + '<div class="corrected-text-content">'+d.corrected_text+'</div>'
        + '</div>';
    }
    if(d.positives && d.positives.length){
      html += '<div class="positive-box">';
      d.positives.forEach(function(p){ html += '<div class="positive-item">✓ '+p+'</div>'; });
      html += '</div>';
    }
    if(d.corrections && d.corrections.length){
      // Group by type
      var groups = {'grammar':[], 'style':[], 'typo':[]};
      var groupLabels = {'grammar':'🔴 Nyelvtani hibák', 'style':'🟡 Stílus / regiszter', 'typo':'🔵 Elütések'};
      d.corrections.forEach(function(c, i){ var t = c.type||'grammar'; if(!groups[t]) groups[t]=[]; groups[t].push({c:c,i:i}); });
      html += '<div style="font-size:.78rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:1rem 0 .5rem">Javítások ('+d.corrections.length+')</div>';
      ['grammar','style','typo'].forEach(function(type){
        if(!groups[type].length) return;
        html += '<div class="corr-group-header">'+groupLabels[type]+'</div>';
        groups[type].forEach(function(item){
          var c = item.c, i = item.i;
          html += '<div class="corr-item '+type+'" id="corr-'+i+'">';
          html += '<div class="corr-wrong">✗ '+c.wrong+'</div>';
          html += '<div class="corr-right">✓ '+c.right+'</div>';
          html += '<div class="corr-exp">'+c.explanation+'</div>';
          if(c.grammar_rule){
            html += '<button class="grammar-rule-btn" onclick="toggleGrammarRule(\'grule-'+i+'\',this)">📖 '+c.grammar_rule+'</button>';
            html += '<div class="grammar-rule-box" id="grule-'+i+'"></div>';
          }
          html += '</div>';
        });
      });
    } else {
      html += '<div class="ok-box">Nem találtam lényeges hibát. Szép munka!</div>';
    }
    if(d.corrections && d.corrections.length){
      d.corrections.forEach(function(c){ if(c.wrong&&c.right) addErrorPattern(c.wrong,c.right,c.type||'grammar',c.explanation||''); });
    }
    document.getElementById('check-result').innerHTML = html;
  } catch(e){
    document.getElementById('check-result').innerHTML = '<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('check-loading'); dis('btn-check', false);
}

async function toggleGrammarRule(id, btn){
  var box = document.getElementById(id);
  if(!box) return;
  if(box.style.display==='block'){ box.style.display='none'; return; }
  if(box.innerHTML){ box.style.display='block'; return; }
  var ruleName = btn.textContent.replace('📖 Kapcsolódó szabály: ','').trim();
  btn.textContent = '⏳ Betöltés...';
  try{
    var r = await claude(
      'You are an English grammar teacher for Hungarian B1 learners. Explain this grammar rule in Hungarian. Include: 1) rule explanation, 2) formation pattern, 3) 2-3 examples with HU translations, 4) common mistakes. Be practical and focused on business English.',
      'Explain: '+ruleName
    );
    box.innerHTML = r.replace(/\n/g,'<br>');
    box.style.display = 'block';
    btn.textContent = '▲ '+ruleName;
  } catch(e){
    box.innerHTML = '<span style="color:var(--danger)">Hiba: '+e.message+'</span>';
    box.style.display = 'block';
  }
}

// ============================================================
// COMPREHENSION PANEL
// ============================================================
function compInit(){
  // A hanglista betöltése aszinkron — már itt elindítjuk, hogy a Felolvasás gombnál kész legyen
  if(window.speechSynthesis) window.speechSynthesis.getVoices();
  var textEl = document.getElementById('comp-text-display');
  var existingText = textEl ? textEl.value.trim() : '';
  if(!existingText && trText){ textEl.value=trText; existingText=trText; }
  var noText = document.getElementById('comp-no-text');
  if(noText) noText.style.display = existingText?'none':'block';
  if(existingText && (!compQuestions.length || compQuestions._text!==existingText)){
    compGenerate();
  }
}

async function compGenerate(){
  var textEl = document.getElementById('comp-text-display');
  var text = (textEl?textEl.value.trim():'')||trText||'';
  if(!text) return;
  show('comp-loading');
  document.getElementById('comp-questions-wrap').innerHTML='';
  document.getElementById('comp-result').innerHTML='';
  compQuestions = [];
  dis('btn-comp-check',true); dis('btn-comp-new',true);
  try{
    var r = await claude(
      'Generate exactly 5 reading comprehension questions for a Hungarian B1 English learner. Return ONLY JSON array: [{"question":"EN question","answer":"correct EN answer 1-2 sentences"}]. Mix factual, inferential, vocabulary questions. No markdown.',
      'Text:\n'+text.substring(0,1500)+'\n\nGenerate 5 comprehension questions.'
    );
    var parsed = safeParseJSON(r);
    compQuestions = Array.isArray(parsed)?parsed:[parsed];
    compQuestions._text = text;
    renderCompQuestions();
    var noText = document.getElementById('comp-no-text');
    if(noText) noText.style.display='none';
  } catch(e){
    document.getElementById('comp-questions-wrap').innerHTML='<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('comp-loading'); dis('btn-comp-check',false); dis('btn-comp-new',false);
}

function renderCompQuestions(){
  var html='';
  compQuestions.forEach(function(q,i){
    html+='<div class="comp-question-item" id="comp-q-'+i+'">';
    html+='<div class="comp-question-text"><span class="comp-question-num">'+(i+1)+'</span>'+q.question+'</div>';
    html+='<input type="text" class="comp-answer-input" id="comp-ans-'+i+'" placeholder="Your answer..." autocomplete="off"/>';
    html+='<div class="comp-feedback" id="comp-fb-'+i+'"></div>';
    html+='</div>';
  });
  document.getElementById('comp-questions-wrap').innerHTML=html;
  compQuestions.forEach(function(q,i){
    var inp=document.getElementById('comp-ans-'+i);
    if(inp) inp.addEventListener('keydown',function(e){
      if(e.key==='Enter'){ e.preventDefault(); var next=document.getElementById('comp-ans-'+(i+1)); if(next) next.focus(); else compCheck(); }
    });
  });
}

async function compCheck(){
  var answers=compQuestions.map(function(q,i){ return document.getElementById('comp-ans-'+i).value.trim(); });
  if(!answers.filter(Boolean).length) return;
  dis('btn-comp-check',true); show('comp-loading');
  document.getElementById('comp-loading').querySelector('span').textContent='Értékelés...';
  document.getElementById('comp-result').innerHTML='';
  try{
    var qa=compQuestions.map(function(q,i){
      return (i+1)+'. Q: '+q.question+'\n   Correct: '+q.answer+'\n   Student: '+(answers[i]||'(no answer)');
    }).join('\n\n');
    var r=await claude(
      'Evaluate reading comprehension answers. Return ONLY JSON array: [{"correct":true/false,"feedback_en":"1 sentence feedback","score":0-1}]. Accept paraphrases. Be encouraging.',
      'Evaluate:\n'+qa
    );
    var results=safeParseJSON(r);
    if(!Array.isArray(results)) results=[results];
    var totalScore=0;
    results.forEach(function(res,i){
      var inp=document.getElementById('comp-ans-'+i);
      var fb=document.getElementById('comp-fb-'+i);
      if(!inp||!fb) return;
      inp.classList.remove('correct','wrong');
      if(res.correct||res.score>0){ inp.classList.add('correct'); totalScore++; fb.innerHTML='<span style="color:var(--success)">✓ '+(res.feedback_en||'Helyes!')+'</span>'; }
      else { inp.classList.add('wrong'); fb.innerHTML='<span style="color:var(--danger)">✗ '+(res.feedback_en||'Nem pontosan.')+'</span><div style="font-size:.76rem;color:var(--muted);margin-top:2px">Helyes válasz: '+compQuestions[i].answer+'</div>'; }
    });
    var pct=Math.round(totalScore/compQuestions.length*100);
    logSkillResult('reading', pct/100, compQuestions.length); // olvasás/hallás-készség jel
    var msg=pct===100?'Kiváló!':pct>=80?'Szép munka!':pct>=60?'Jól van, de van fejlődési lehetőség.':'Olvasd el újra és próbáld újra.';
    document.getElementById('comp-result').innerHTML='<div class="comp-score-box"><div style="display:flex;align-items:baseline;gap:10px"><span class="comp-score-num">'+totalScore+'/'+compQuestions.length+'</span><span style="font-size:.9rem;color:var(--muted)">'+pct+'% — '+msg+'</span></div></div>';
  } catch(e){
    document.getElementById('comp-result').innerHTML='<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('comp-loading'); dis('btn-comp-check',false);
}

// --- Szövegértés: felolvasás (Web Speech API) ---
// Mondatonként olvasunk fel: így természetesebb a hanglejtés, a Chrome nem némul el
// (hosszú, egyetlen utterance kb. 15 mp után megszakad), és mondatpontossággal
// lehet szüneteltetni, léptetni és a sávon ugrani.
var compSpeaking=false, compPaused=false, compIdx=0, compSentences=[], compSpeakText='', compGen=0;

// A legjobb angol hang kiválasztása: Edge "Natural" online hangjai a legtermészetesebbek,
// utána a Google hangok, végül bármilyen en-US.
function compPickVoice(){
  var voices=window.speechSynthesis.getVoices();
  var en=voices.filter(function(v){ return /^en[-_]/i.test(v.lang); });
  return en.find(function(v){ return /natural/i.test(v.name)&&v.lang==='en-US'; })
      || en.find(function(v){ return /natural/i.test(v.name); })
      || en.find(function(v){ return /google/i.test(v.name)&&v.lang==='en-US'; })
      || en.find(function(v){ return v.lang==='en-US'; })
      || en[0] || null;
}

// Mondatokra bontás — ha a szöveg megváltozott, elölről kezdjük
function compPrepare(){
  var textEl=document.getElementById('comp-text-display');
  var text=textEl?textEl.value.trim():'';
  if(!text){ showToast('Nincs felolvasható szöveg.'); return false; }
  if(text!==compSpeakText){
    compSpeakText=text;
    compSentences=text.replace(/\s+/g,' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)||[text];
    compIdx=0; compPaused=false;
  }
  return true;
}

// Lejátszás az i. mondattól. A compGen generáció-számláló gondoskodik róla, hogy
// a megszakított (cancel-elt) utterance-ek callbackjei ne zavarják az új lejátszást.
function compPlayFrom(i){
  if(!window.speechSynthesis){ showToast('A böngésző nem támogatja a felolvasást.'); return; }
  if(!compPrepare()) return;
  compIdx=Math.max(0,Math.min(i,compSentences.length-1));
  var gen=++compGen;
  window.speechSynthesis.cancel();
  compSpeaking=true; compPaused=false;
  var voice=compPickVoice();
  compUpdateUI();
  (function speakNext(){
    if(gen!==compGen) return;
    if(compIdx>=compSentences.length){ compSpeakStop(); return; }
    compUpdateProgress();
    var rateEl=document.getElementById('comp-speak-rate');
    var utt=new SpeechSynthesisUtterance(compSentences[compIdx].trim());
    utt.lang='en-US'; utt.rate=rateEl?parseFloat(rateEl.value)||1:1; utt.pitch=1;
    if(voice) utt.voice=voice;
    utt.onend=function(){ if(gen===compGen){ compIdx++; speakNext(); } };
    utt.onerror=function(){ if(gen===compGen) compSpeakStop(); };
    window.speechSynthesis.speak(utt);
  })();
}

// Lejátszás / szünet / folytatás egy gombbal
function compSpeakToggle(){
  if(!window.speechSynthesis){ showToast('A böngésző nem támogatja a felolvasást.'); return; }
  if(compSpeaking){ compSpeakPause(); return; }
  compPlayFrom(compPaused?compIdx:0);
}

// Szünet: cancel + mondatindex megőrzése — a natív pause/resume Chrome-ban bugos,
// így a folytatás az aktuális mondat elejétől indul újra
function compSpeakPause(){
  if(!compSpeaking) return;
  compGen++;
  window.speechSynthesis.cancel();
  compSpeaking=false; compPaused=true;
  compUpdateUI();
}

function compSpeakStop(){
  compGen++;
  compSpeaking=false; compPaused=false;
  if(window.speechSynthesis) window.speechSynthesis.cancel();
  compUpdateUI();
}

function compRestart(){ compPlayFrom(0); }

// Egy mondattal előre/hátra
function compStep(d){
  if(!compSentences.length && !compPrepare()) return;
  compPlayFrom(compIdx+d);
}

// Kattintás az előrehaladás-sávra: ugrás a kiválasztott mondatra
function compSeek(e){
  if(!compSentences.length && !compPrepare()) return;
  var bar=document.getElementById('comp-progress-bar');
  var r=bar.getBoundingClientRect();
  var frac=Math.max(0,Math.min(0.999,(e.clientX-r.left)/r.width));
  compPlayFrom(Math.floor(frac*compSentences.length));
}

function compUpdateUI(){
  var b=document.getElementById('btn-comp-speak');
  if(b) b.innerHTML=compSpeaking?'⏸ Szünet':(compPaused?'▶ Folytatás':'🔊 Felolvasás');
  compUpdateProgress();
}

function compUpdateProgress(){
  var row=document.getElementById('comp-progress-row');
  var fill=document.getElementById('comp-progress-fill');
  var label=document.getElementById('comp-progress-label');
  if(!row||!fill||!label) return;
  if(!compSentences.length){ row.style.display='none'; return; }
  row.style.display='flex';
  var len=compSentences.length, cur=Math.min(compIdx,len);
  fill.style.width=Math.round(cur/len*100)+'%';
  label.textContent=Math.min(cur+1,len)+'/'+len;
}

// Szöveg elrejtése/megjelenítése — csak hallás utáni szövegértéshez
function compToggleText(){
  var textEl=document.getElementById('comp-text-display');
  var b=document.getElementById('btn-comp-hide');
  if(!textEl) return;
  var hidden=textEl.classList.toggle('comp-text-hidden');
  if(b) b.innerHTML=hidden?'👁 Szöveg megjelenítése':'🙈 Szöveg elrejtése';
}

// ============================================================
// NYELVFELISMERÉS (az írás-ellenőrzés használja)
// ============================================================
function detectHungarian(text){
  return /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(text)||/\b(és|az|egy|hogy|nem|van|volt|már|még|is|de|ha|mert|csak)\b/i.test(text);
}

// ============================================================
// ROADMAP
// ============================================================
function renderRoadmap(){
  var container=document.getElementById('roadmap-content');
  if(!container) return;
  container.innerHTML=ROADMAP.map(function(band){
    var items=band.items.map(function(item){
      var st=itemMastery(item.id).state;
      return '<div class="grammar-box status-'+masteryStatusClass(st)+'" id="box-'+item.id+'" onclick="openModal(\''+item.id+'\')">'+
        '<div class="grammar-box-status">'+masteryIcon(st)+'</div>'+
        '<div class="grammar-box-title-en">'+(item.en||item.title)+'</div>'+
        (item.en?'<div class="grammar-box-title-hu">'+item.title+'</div>':'')+
        '<div class="grammar-box-sub">'+item.sub+'</div>'+
        masteryBarHtml(item.id)+
        '</div>';
    }).join('');
    return '<div class="roadmap-band cefr-band-'+band.level.toLowerCase()+'">'+'<div class="band-label"><span class="cefr-pill">'+band.level+'</span><span class="band-sub">'+band.sub+'</span></div>'+'<div class="grammar-grid">'+items+'</div></div>';
  }).join('');
}

function updateRoadmapProgress(){
  var total=0, done=0;
  ROADMAP.forEach(function(band){ band.items.forEach(function(item){ total++; if(itemMastery(item.id).state==='green') done++; }); });
  var pct=total?Math.round(done/total*100):0;
  var fill=document.getElementById('rm-fill');
  var text=document.getElementById('rm-text');
  if(fill) fill.style.width=pct+'%';
  if(text) text.textContent=done+' / '+total+' témakör teljesítve';
}

function openModal(id){
  var item=null;
  ROADMAP.forEach(function(band){ band.items.forEach(function(i){ if(i.id===id) item=i; }); });
  if(!item) return;
  currentModalId=id;
  var modal=document.getElementById('gr-modal');
  var title=document.getElementById('modal-title');
  var body=document.getElementById('modal-body');
  if(!modal||!title||!body) return;
  title.textContent=(item.en||item.title)+(item.en?' — '+item.title:'');
  var html = masteryModalHtml(id) + renderRoadmapItem(item);
  body.innerHTML = html;
  modal.style.display='flex';
}

function closeModal(){
  var modal=document.getElementById('gr-modal');
  if(modal) modal.style.display='none';
  currentModalId=null;
}

function closeModalDirect(e){
  if(e.target===document.getElementById('gr-modal')) closeModal();
}

// ============================================================
// TENSE EXERCISES
// ============================================================

// ============================================================
// GRAMMAR EXERCISE ENGINE — új motor
// ============================================================

var grExState = {
  queue: [],
  idx: 0,
  score: {correct:0, total:0},
  perItem: {},   // {roadmapId: {correct:0, total:0}}
  phase: 'idle',
  currentRoadmapId: null
};

// Elem választó renderelése a tenses panelben
function renderTenseSelector(){
  var grid = document.getElementById('tense-select-grid');
  if(!grid) return;
  var byLevel = {};
  Object.keys(GRAMMAR_EXERCISES).forEach(function(id){
    var item = GRAMMAR_EXERCISES[id];
    var lvl = item.level || 'B1';
    if(!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push({id:id, name:item.name, level:lvl, isTense:item.category==='tense'});
  });
  var html = '';
  ['A1','A2','B1','B2','C1'].forEach(function(lvl){
    if(!byLevel[lvl]) return;
    html += '<div class="tense-group"><div class="tense-group-label">'+lvl+'</div><div class="tense-chips">';
    byLevel[lvl].forEach(function(item){
      // Roadmap élő tudásszint a chipen (ugyanaz az adat, mint a roadmapon)
      var m = itemMastery(item.id);
      var statusIcon = ' '+masteryIcon(m.state);
      var badge = m.count>0 ? '<div class="tc-badge">'+m.count+'× · '+m.score+'%</div>' : '';
      var chipCls = 'tense-chip '+(item.isTense?'chip-tense':'chip-grammar')+(selectedTenses.has(item.id)?' selected':'');
      html += '<div class="'+chipCls+'" id="tc-'+item.id+'" data-id="'+item.id+'">'
        + '<div class="tc-name">'+item.name+statusIcon+'</div>'+badge+'</div>';
    });
    html += '</div></div>';
  });
  grid.innerHTML = html;
  grid.onclick = function(e){
    var chip = e.target.closest('.tense-chip');
    if(!chip) return;
    var id = chip.getAttribute('data-id');
    if(!id) return;
    toggleTense(id);
  };
  updateTenseSelectSummary();
}

// A témaválasztó panel össze-/kinyitása (a Mondatszerkesztéshez hasonlóan)
function toggleTenseSelect(force){
  var grid = document.getElementById('tense-select-grid');
  var arrow = document.getElementById('tense-select-arrow');
  if(!grid) return;
  var open = (typeof force === 'boolean') ? force : (grid.style.display === 'none');
  grid.style.display = open ? 'flex' : 'none';
  if(arrow) arrow.textContent = open ? '▾' : '▸';
}

function updateTenseSelectSummary(){
  var el = document.getElementById('tense-select-summary');
  if(!el) return;
  var n = selectedTenses.size;
  el.textContent = n ? ('Témák: '+n+' kiválasztva') : 'Témák kiválasztása';
}

function saveExerciseHistory(roadmapId, correct, total){
  var history = JSON.parse(localStorage.getItem('ex_history') || '[]');
  history.push({
    roadmapId: roadmapId,
    correct: correct,
    total: total,
    pct: total ? Math.round(correct/total*100) : 0,
    date: getTodayStr()
  });
  localStorage.setItem('ex_history', JSON.stringify(history));
}

function showToast(msg){
  var toast = document.getElementById('gr-toast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'gr-toast';
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:.7rem 1.2rem;font-size:.86rem;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:9999;transition:opacity .3s';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function(){ toast.style.opacity = '0'; }, 3000);
}

function toggleTense(id){
  if(selectedTenses.has(id)){
    selectedTenses.delete(id);
    var el=document.getElementById('tc-'+id);
    if(el) el.classList.remove('selected');
  } else {
    selectedTenses.add(id);
    var el=document.getElementById('tc-'+id);
    if(el) el.classList.add('selected');
  }
  updateTenseSelectSummary();
}

function selectAllTenses(){
  Object.keys(GRAMMAR_EXERCISES).forEach(function(id){
    selectedTenses.add(id);
    var el=document.getElementById('tc-'+id);
    if(el) el.classList.add('selected');
  });
  updateTenseSelectSummary();
}

function deselectAllTenses(){
  Object.keys(GRAMMAR_EXERCISES).forEach(function(id){
    selectedTenses.delete(id);
    var el=document.getElementById('tc-'+id);
    if(el) el.classList.remove('selected');
  });
  updateTenseSelectSummary();
}

function startExercises(){
  if(!selectedTenses.size){
    var el = document.getElementById('ex-empty');
    if(el) el.style.display = 'block';
    return;
  }
  var el = document.getElementById('ex-empty');
  if(el) el.style.display = 'none';

  grExState.queue = [];
  selectedTenses.forEach(function(id){
    var item = GRAMMAR_EXERCISES[id];
    if(!item) return;
    // Get cached AI exercises too
    var cached = JSON.parse(localStorage.getItem('ex_cache_'+id) || '[]');
    var allEx = item.exercises.concat(cached);
    allEx.forEach(function(ex){ grExState.queue.push({roadmapId:id, itemName:item.name, level:item.level, ex:ex}); });
  });

  grExState.queue.sort(function(){ return Math.random() - 0.5; });
  grExState.idx = 0;
  grExState.score = {correct:0, total:0};
  grExState.perItem = {};
  grExState.phase = 'question';
  // a témák session eleji tudásszint-állapota (a "zöldre vált" toasthoz)
  grExState.preStates = {};
  selectedTenses.forEach(function(id){ grExState.preStates[id] = itemMastery(id).state; });

  toggleTenseSelect(false); // gyakorlás indításakor a választó becsukódik (több hely)
  document.getElementById('exercise-area').style.display = 'block';
  renderGrExercise();
}

function renderGrExercise(){
  if(grExState.idx >= grExState.queue.length){ showGrExSummary(); return; }
  var item = grExState.queue[grExState.idx];
  grExState.phase = 'question';
  grExState.currentRoadmapId = item.roadmapId;

  var wrap = document.getElementById('ex-card-wrap');
  var type = item.ex.type;

  var html = '<div class="ex-card">';
  // Header: level badge + topic (nehéz módban rejtett)
  html += '<div class="ex-card-header">'
    + (hardMode ? '' : '<span class="ex-tense-badge">'+item.level+'</span>')
    + (hardMode ? '' : '<span style="font-size:.84rem;color:var(--muted)">'+item.itemName+'</span>')
    + '<span class="ex-counter">'+(grExState.idx+1)+' / '+grExState.queue.length
    + ' &nbsp; <span class="ex-score-good">'+grExState.score.correct+' helyes</span></span>'
    + '</div>';

  if(type === 'fill'){
    html += '<div class="ex-section-label">Magyar kontextus</div>';
    html += '<div class="ex-hu-text">'+(item.ex.hu||'')+'</div>';
    html += '<div class="ex-section-label" style="margin-top:1rem">Egészítsd ki</div>';
    html += '<div class="ex-sentence-row">';
    if(item.ex.pre) html += '<span class="ex-sentence-part">'+item.ex.pre+'</span>';
    html += '<input type="text" id="ex-input" class="ex-sentence-input" placeholder="'+(item.ex.hint||'')+'" autocomplete="off" autocorrect="off" spellcheck="false" data-answer="'+escapeAttr(item.ex.answer)+'"/>';
    if(item.ex.post) html += '<span class="ex-sentence-part">'+item.ex.post+'</span>';
    html += '</div>';
  }
  else if(type === 'transform'){
    html += '<div class="ex-section-label">Feladat</div>';
    html += '<div class="ex-hu-text">'+(item.ex.instruction||'Alakítsd át:')+'</div>';
    html += '<div class="ex-source-sentence">'+(item.ex.source||'')+'</div>';
    if(item.ex.hint) html += '<div style="font-size:.76rem;color:var(--faint);margin-top:4px">Segítség: '+item.ex.hint+'</div>';
    html += '<div class="ex-section-label" style="margin-top:1rem">A te válaszod</div>';
    html += '<textarea id="ex-textarea" class="ex-textarea" placeholder="Írj ide..." autocorrect="off" spellcheck="false" data-answer="'+escapeAttr(item.ex.answer)+'"></textarea>';
  }
  else if(type === 'error'){
    html += '<div class="ex-section-label">Keressd meg a hibát</div>';
    html += '<div class="ex-source-sentence" id="error-sentence">';
    var words = item.ex.sentence.split(' ');
    words.forEach(function(w, i){
      html += '<span class="error-word" onclick="selectErrorWord(this)" data-word="'+w+'" data-idx="'+i+'">'+w+'</span> ';
    });
    html += '</div>';
    html += '<div id="ex-selected-word" style="margin-top:.6rem;font-size:.84rem;color:var(--muted)">Kattints a hibás szóra vagy kifejezésre...</div>';
    html += '<input type="hidden" id="ex-error-selection" data-answer="'+escapeAttr(item.ex.answer)+'"/>';
  }
  else if(type === 'choice'){
    html += '<div class="ex-section-label">Válassz!</div>';
    html += '<div class="ex-hu-text">'+(item.ex.question||'')+'</div>';
    html += '<div class="ex-choices" id="ex-choices">';
    (item.ex.options||[]).forEach(function(opt, i){
      html += '<button class="ex-choice-btn" onclick="selectChoice(this,'+i+')" data-idx="'+i+'" data-correct="'+item.ex.correct+'">'+opt+'</button>';
    });
    html += '</div>';
  }
  else if(type === 'build'){
    // Mondatszerkesztés: magyar mondat + alapalakú szavak → angol mondat (beolvasztva)
    html += '<div class="ex-section-label">Magyar mondat</div>';
    html += '<div class="ex-hu-text">'+(item.ex.hu||'')+'</div>';
    if(item.ex.words && item.ex.words.length){
      html += '<div class="ex-section-label" style="margin-top:1rem">Használd ezeket a szavakat (alapalak)</div>';
      html += '<div class="bld-word-chips">'+item.ex.words.map(function(w){ return '<span class="bld-word-chip">'+w+'</span>'; }).join('')+'</div>';
    }
    html += '<div class="ex-section-label" style="margin-top:1rem">Írd le angolul</div>';
    html += '<textarea id="ex-textarea" class="ex-textarea" placeholder="Rakd össze a mondatot..." autocorrect="off" spellcheck="false" data-answer="'+escapeAttr(item.ex.answer)+'"></textarea>';
  }

  // Nehéz módban: kinyitható hint (fill + transform + build típusoknál)
  if(hardMode && (type === 'fill' || type === 'transform' || type === 'build')){
    var rmItemHard = null;
    ROADMAP.forEach(function(band){ band.items.forEach(function(i){ if(i.id===item.roadmapId) rmItemHard=i; }); });
    if(rmItemHard){
      html += '<div class="to-hint-wrap">';
      html += '<button class="to-hint-btn" onclick="toggleGrHint()">'
        + '<span id="gr-hint-icon">▶</span> Segítség — nyelvtani magyarázat</button>';
      html += '<div id="gr-hint-body" style="display:none">';
      html += '<div style="font-size:.8rem;font-weight:600;color:var(--accent);margin-bottom:.4rem">'+item.itemName+'</div>';
      html += renderRoadmapItem(rmItemHard, true);
      html += '</div></div>';
    }
  }

  html += '<div id="ex-feedback" class="ex-feedback" style="display:none"></div>';
  html += '<div class="ex-nav">';
  if(type !== 'choice'){
    html += '<button class="btn btn-outline" onclick="checkGrAnswer()">Ellenőrzés</button>';
    html += '<button class="btn btn-outline" id="btn-show-ans" onclick="showGrAnswer()">Mutasd</button>';
  }
  html += '<button class="btn btn-gold" id="btn-next" style="display:none" onclick="nextGrExercise()">Következő →</button>';
  html += '</div>';

  html += '</div>'; // ex-card
  wrap.innerHTML = html;

  // Focus
  var inp = document.getElementById('ex-input') || document.getElementById('ex-textarea');
  if(inp) inp.focus();
}

function escapeAttr(s){ return (s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function selectErrorWord(el){
  document.querySelectorAll('.error-word').forEach(function(w){ w.classList.remove('selected'); });
  el.classList.add('selected');
  document.getElementById('ex-selected-word').textContent = '"'+el.getAttribute('data-word')+'" kiválasztva';
}

function selectChoice(el, idx){
  var correct = parseInt(el.getAttribute('data-correct'));
  var isCorrect = idx === correct;
  document.querySelectorAll('.ex-choice-btn').forEach(function(b){ b.disabled = true; });
  var rid2 = grExState.queue[grExState.idx].roadmapId;
  if(!grExState.perItem[rid2]) grExState.perItem[rid2] = {correct:0, total:0};
  if(isCorrect){
    el.classList.add('correct');
    grExState.score.correct++;
    grExState.perItem[rid2].correct++;
  } else {
    el.classList.add('wrong');
    document.querySelectorAll('.ex-choice-btn')[correct].classList.add('correct');
  }
  grExState.score.total++;
  grExState.perItem[rid2].total++;
  addItemEvidence(rid2, isCorrect?1:0, isCorrect?0:1, exWeight('choice')); // súlyozott tudásszint-jel
  showGrFeedback(isCorrect, grExState.queue[grExState.idx].ex);
  document.getElementById('btn-next').style.display = 'inline-block';
  grExState.phase = 'checked';
}


function normalise(s){
  return s.replace(/['']/g,"'").toLowerCase()
    .replace(/will not/g,"won't").replace(/cannot/g,"can't").replace(/do not/g,"don't")
    .replace(/does not/g,"doesn't").replace(/did not/g,"didn't").replace(/have not/g,"haven't")
    .replace(/has not/g,"hasn't").replace(/had not/g,"hadn't").replace(/is not/g,"isn't")
    .replace(/are not/g,"aren't").replace(/was not/g,"wasn't").replace(/were not/g,"weren't")
    .replace(/would not/g,"wouldn't").replace(/could not/g,"couldn't").replace(/should not/g,"shouldn't")
    .replace(/i am/g,"i'm").replace(/i have/g,"i've").replace(/i will/g,"i'll")
    .replace(/she is/g,"she's").replace(/he is/g,"he's").replace(/it is/g,"it's")
    .replace(/we are/g,"we're").replace(/they are/g,"they're").replace(/you are/g,"you're")
    .replace(/we will/g,"we'll").replace(/they will/g,"they'll").replace(/she will/g,"she'll")
    .replace(/he will/g,"he'll").replace(/\s+/g,' ').trim();
}

function checkGrAnswer(){
  if(grExState.phase === 'checked') return;
  var item = grExState.queue[grExState.idx];
  var type = item.ex.type;
  if(type === 'build'){ checkBuildAnswer(item); return; } // szabad produkció → AI-értékelés
  var correct = item.ex.answer || '';
  var userVal = '';

  if(type === 'fill'){
    var inp = document.getElementById('ex-input');
    if(!inp || !inp.value.trim()) return;
    userVal = inp.value.trim();
    inp.disabled = true;
  } else if(type === 'transform'){
    var ta = document.getElementById('ex-textarea');
    if(!ta || !ta.value.trim()) return;
    userVal = ta.value.trim();
    ta.disabled = true;
  } else if(type === 'error'){
    var sel = document.querySelector('.error-word.selected');
    if(!sel) return;
    userVal = sel.getAttribute('data-word');
  }

  // For transform, check loosely (Claude can also check)
  var isCorrect;
  if(type === 'transform'){
    isCorrect = normalise(userVal).indexOf(normalise(correct.split('.')[0].substring(0,20))) > -1
      || normalise(correct).indexOf(normalise(userVal.substring(0,20))) > -1
      || normalise(userVal) === normalise(correct);
  } else {
    // Accept multiple correct answers separated by /
    var acceptedAnswers = correct.split('/').map(function(a){ return normalise(a.trim()); });
    isCorrect = acceptedAnswers.indexOf(normalise(userVal)) > -1;
  }

  var rid = grExState.queue[grExState.idx].roadmapId;
  if(!grExState.perItem[rid]) grExState.perItem[rid] = {correct:0, total:0};
  if(isCorrect){ grExState.score.correct++; grExState.perItem[rid].correct++; }
  grExState.score.total++;
  grExState.perItem[rid].total++;
  addItemEvidence(rid, isCorrect?1:0, isCorrect?0:1, exWeight(type)); // súlyozott tudásszint-jel

  if(type === 'fill'){
    var inp2 = document.getElementById('ex-input');
    if(inp2){ inp2.classList.add(isCorrect?'correct':'wrong'); }
  }

  showGrFeedback(isCorrect, item.ex);
  var showAns = document.getElementById('btn-show-ans');
  if(showAns) showAns.style.display = 'none';
  document.getElementById('btn-next').style.display = 'inline-block';
  grExState.phase = 'checked';
}

// Mondatszerkesztés (build) értékelése AI-val — paraphrase-toleráns, súly 2
async function checkBuildAnswer(item){
  var ta = document.getElementById('ex-textarea');
  if(!ta || !ta.value.trim()) return;
  var userVal = ta.value.trim();
  ta.disabled = true;
  grExState.phase = 'checked'; // dupla beküldés ellen
  var fb = document.getElementById('ex-feedback');
  if(fb){ fb.className = 'ex-feedback'; fb.style.display = 'block'; fb.innerHTML = 'Ellenőrzés...'; }
  var isCorrect = false, corrected = item.ex.answer || '';
  try{
    var r = await claude(
      'You are an English grammar teacher for a Hungarian learner. Evaluate this sentence-building answer. Accept any answer that correctly uses the target grammar and conveys the meaning (paraphrases are fine). Return ONLY valid JSON, single line, no double quotes inside values: {"correct":true/false,"score":1-10,"feedback":"short HU note","corrected":"correct English sentence"}.',
      'Hungarian: '+(item.ex.hu||'')+'\nExpected: '+(item.ex.answer||'')+'\nStudent: '+userVal,
      400
    );
    var d = safeParseJSON(r);
    isCorrect = !!(d.correct || d.score>=8);
    if(d.corrected) corrected = d.corrected;
    if(fb){
      fb.className = 'ex-feedback ' + (isCorrect?'correct':'wrong');
      fb.innerHTML = (isCorrect ? '✓ Helyes! ' : '✗ ') + (isCorrect ? '' : (d.feedback||'Nem pontos.'))
        + (isCorrect ? '' : '<div class="ex-explanation">Helyes: '+corrected+'</div>');
    }
  }catch(e){
    // hálózati hiba esetén laza helyi ellenőrzés
    isCorrect = normalise(userVal) === normalise(item.ex.answer||'');
    if(fb){ fb.className='ex-feedback '+(isCorrect?'correct':'wrong'); fb.innerHTML = isCorrect?'✓ Helyes!':'✗ Helyes: '+(item.ex.answer||''); }
  }
  var rid = item.roadmapId;
  if(!grExState.perItem[rid]) grExState.perItem[rid] = {correct:0, total:0};
  if(isCorrect){ grExState.score.correct++; grExState.perItem[rid].correct++; }
  grExState.score.total++; grExState.perItem[rid].total++;
  addItemEvidence(rid, isCorrect?1:0, isCorrect?0:1, exWeight('build')); // súly 2
  var showAns = document.getElementById('btn-show-ans');
  if(showAns) showAns.style.display = 'none';
  document.getElementById('btn-next').style.display = 'inline-block';
}

// Egy build (mondatszerkesztés) feladat AI-generálása egy igeidőhöz
async function aiGenBuildItem(tenseName, level){
  try{
    var r = await claude(
      'Output ONLY a JSON object with keys: hu, answer, words. No markdown, no extra text.',
      'Tense: '+tenseName+'. Level: '+level+'. Generate a sentence-building exercise in a business or everyday context. Return JSON: hu (Hungarian translation), answer (correct English sentence), words (array of 5-8 base-form content words, no articles or auxiliaries).',
      400
    );
    var d = safeParseJSON(r);
    if(d && d.hu && d.answer && Array.isArray(d.words)) return {type:'build', hu:d.hu, answer:d.answer, words:d.words};
  }catch(e){}
  return null;
}

function showGrAnswer(){
  var item = grExState.queue[grExState.idx];
  var rid3 = grExState.queue[grExState.idx].roadmapId;
  if(!grExState.perItem[rid3]) grExState.perItem[rid3] = {correct:0, total:0};
  grExState.perItem[rid3].total++;
  grExState.score.total++;
  addItemEvidence(rid3, 0, 1, exWeight(item.ex.type)); // megmutatott válasz = hibás jel
  var fb = document.getElementById('ex-feedback');
  fb.className = 'ex-feedback wrong';
  fb.innerHTML = 'Helyes válasz: <strong>'+(item.ex.answer||'')+'</strong>'
    + (item.ex.explanation ? '<div class="ex-explanation">'+item.ex.explanation+'</div>' : '');
  fb.style.display = 'block';
  var showAns = document.getElementById('btn-show-ans');
  if(showAns) showAns.style.display = 'none';
  document.getElementById('btn-next').style.display = 'inline-block';
  grExState.phase = 'checked';
}

function showGrFeedback(isCorrect, ex){
  var fb = document.getElementById('ex-feedback');
  fb.className = 'ex-feedback ' + (isCorrect ? 'correct' : 'wrong');
  if(isCorrect){
    fb.innerHTML = '✓ Helyes! <strong>'+ex.answer+'</strong>'
      + (ex.explanation ? '<div class="ex-explanation">'+ex.explanation+'</div>' : '');
  } else {
    fb.innerHTML = '✗ Helyes válasz: <strong>'+ex.answer+'</strong>'
      + (ex.explanation ? '<div class="ex-explanation">'+ex.explanation+'</div>' : '');
    // Save wrong answer as error pattern
    if(ex.hu && ex.answer){
      addErrorPattern(ex.hu.substring(0,60), ex.answer, 'grammar', ex.explanation||'');
    }
  }
  fb.style.display = 'block';
}

function nextGrExercise(){
  grExState.idx++;
  grExState.phase = 'question';
  renderGrExercise();
}

function showGrExSummary(){
  var s = grExState.score;
  var pct = s.total ? Math.round(s.correct/s.total*100) : 0;

  // Session-előzmény + toast: a tudásszint-bizonyítékot már válaszonként (súlyozottan)
  // rögzítettük, itt csak az ex_history mentés és a zöldre váltás jelzése történik.
  Object.keys(grExState.perItem).forEach(function(rid){
    var c = grExState.perItem[rid];
    if(c.total > 0){
      saveExerciseHistory(rid, c.correct, c.total);
      var before = (grExState.preStates && grExState.preStates[rid]) || 'grey';
      if(itemMastery(rid).state==='green' && before!=='green'){
        var ri = roadmapItem(rid);
        showToast('🟢 '+(ri ? (ri.item.en||ri.item.title) : rid)+' — jól megy!');
      }
    }
  });
  logSkillResult('grammar', pct/100, s.total);

  var msg = pct >= 85 ? 'Kiváló munka!' : pct >= 65 ? 'Szép, tovább így!' : 'Gyakorolj még ezekkel a témákkal.';
  var wrap = document.getElementById('ex-card-wrap');
  wrap.innerHTML = '<div class="ex-card"><div style="text-align:center;padding:1.5rem 1rem">'
    + '<div style="font-family:\'Inter\',sans-serif;font-size:2.2rem;color:var(--accent)">'+s.correct+'/'+s.total+'</div>'
    + '<div style="font-size:1.1rem;margin:.5rem 0">'+pct+'%</div>'
    + '<div style="color:var(--muted);font-size:.88rem;margin-bottom:1.5rem">'+msg+'</div>'
    + '<button class="btn btn-gold" onclick="startExercises()" style="margin-right:8px">Újra</button>'
    + '<button class="btn btn-outline" onclick="generateMoreExercises()">🤖 Több feladat (AI)</button>'
    + '</div></div>';

  // Update roadmap display
  renderRoadmap();
  updateRoadmapProgress();
  renderTenseSelector();
}

// AI feladat generátor
async function generateMoreExercises(){
  if(!selectedTenses.size){ alert('Válassz legalább egy témát!'); return; }
  var btn = document.querySelector('[onclick="generateMoreExercises()"]');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Generálás...'; }

  var ids = Array.from(selectedTenses);
  for(var i = 0; i < ids.length; i++){
    var id = ids[i];
    var item = GRAMMAR_EXERCISES[id];
    if(!item) continue;
    try{
      var r = await claude(
        'You are an English grammar exercise creator for a Hungarian B1 learner. Generate 3 exercises for the given grammar topic. Return ONLY valid JSON array with objects having these fields: type (fill|transform|error|choice), and type-specific fields. For fill: hu (HU context), pre, post, answer, hint. For transform: instruction, source, answer, hint. For error: sentence, answer, explanation. For choice: question, options (array of 4), correct (0-3 index). Use business English context. No markdown.',
        'Grammar topic: ' + item.name + ' ('+id+'). Level: ' + item.level + '. Generate 3 varied exercises.'
      );
      var newEx = safeParseJSON(r);
      if(!Array.isArray(newEx)) newEx = [newEx];
      // Igeidő-témákhoz mondatszerkesztés (build) feladat is — beolvasztott funkció
      if(item.category === 'tense'){
        var bld = await aiGenBuildItem(item.name, item.level);
        if(bld) newEx.push(bld);
      }
      var cached = JSON.parse(localStorage.getItem('ex_cache_'+id) || '[]');
      cached = cached.concat(newEx);
      localStorage.setItem('ex_cache_'+id, JSON.stringify(cached));
    } catch(e){ console.error('Generate error for '+id, e); }
  }

  if(btn){ btn.disabled = false; btn.textContent = '✓ Generálva! Indítsd újra.'; }
  renderTenseSelector();
}


// ============================================================
// CONVERSATION
// ============================================================


function renderTopicPicker(){
  var container=document.getElementById('topic-groups');
  if(!container) return;
  if(container.querySelectorAll('.topic-chip').length) return;
  var html='';
  CONVO_TOPICS.forEach(function(g){
    html+='<div><div class="topic-group-label">'+g.group+'</div><div class="topic-chips">';
    g.topics.forEach(function(t){
      html+='<button class="topic-chip" onclick="selectConvoTopic(\''+t.replace(/'/g,"\\'")+'\',this)" data-topic="'+t.replace(/"/g,'&quot;')+'">'+t+'</button>';
    });
    html+='</div></div>';
  });
  container.innerHTML=html;
}

function selectConvoTopic(topic, el){
  convoSelectedTopic=topic;
  document.querySelectorAll('.topic-chip').forEach(function(c){ c.classList.toggle('selected',c.getAttribute('data-topic')===topic); });
  var box=document.getElementById('topic-selected-box');
  var lbl=document.getElementById('topic-selected-label');
  if(box) box.style.display='flex';
  if(lbl) lbl.textContent='📌 '+topic;
}

function convoClearTopic(){
  convoSelectedTopic='';
  document.querySelectorAll('.topic-chip').forEach(function(c){ c.classList.remove('selected'); });
  var box=document.getElementById('topic-selected-box');
  if(box) box.style.display='none';
}

function selectConvoLevel(lvl, el){
  convoLevel=lvl;
  document.querySelectorAll('#panel-convo .gen-lvl-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
}

function convoStart(){
  var extra=document.getElementById('convo-topic-extra').value.trim();
  var topic=convoSelectedTopic||extra;
  if(!topic){ alert('Válassz témát vagy írj be egyet!'); return; }
  var fullTopic=convoSelectedTopic+(extra?' — '+extra:'');
  convoHistory=[]; convoErrors=[];
  document.getElementById('convo-claude-msgs').innerHTML='';
  document.getElementById('convo-user-msgs').innerHTML='';
  var cs=document.getElementById('convo-stats'); if(cs) cs.style.display='none';
  document.getElementById('convo-topic-label').textContent=fullTopic;
  document.getElementById('convo-level-label').textContent=convoLevel+' szint';
  document.getElementById('topic-picker').style.display='none';
  document.getElementById('convo-main').style.display='block';
  convoSystemPrompt='You are a friendly encouraging conversation partner helping a Hungarian '+convoLevel+' English learner practice. Topic: "'+fullTopic+'". Rules: 2-3 sentences max per reply, natural '+convoLevel+' level English, ask a follow-up question, stay on topic. Never use emojis, emoticons or smileys. Start with a warm natural opening.';
  convoGetReply();
}

function convoReset(){
  convoStopMic(); if(window.speechSynthesis) window.speechSynthesis.cancel();
  document.getElementById('topic-picker').style.display='block';
  document.getElementById('convo-main').style.display='none';
}

async function convoSend(){
  var inp=document.getElementById('convo-input');
  var text=inp.value.trim(); if(!text) return;
  inp.value='';
  convoAddBubble('user',text);
  convoHistory.push({role:'user',content:text});
  show('convo-thinking'); dis('convo-input',true);
  var results=await Promise.all([convoCheckErrors(text),convoGetReplyText()]);
  var correction=results[0], reply=results[1];
  hide('convo-thinking'); dis('convo-input',false);
  if(correction&&correction.errors&&correction.errors.length){ convoAddCorrection(correction.errors); convoErrors=convoErrors.concat(correction.errors); }
  if(correction){
    recordAttribution(correction); // roadmap tudásszint frissítése a fordulóból
    var errN = (correction.errors && correction.errors.length) || 0;
    logSkillResult('speaking', errN===0 ? 1 : Math.max(0, 1 - errN/3), 1);
  }
  convoHistory.push({role:'claude',content:reply});
  convoAddBubble('claude',reply);
  if(convoTTSEnabled) convoSpeak(reply);
  ['convo-claude-msgs','convo-user-msgs'].forEach(function(id){ var el=document.getElementById(id); if(el) el.scrollTop=el.scrollHeight; });
  document.getElementById('convo-input').focus();
}

function convoAddBubble(role,text){
  var col=document.getElementById(role==='claude'?'convo-claude-msgs':'convo-user-msgs');
  var div=document.createElement('div');
  div.className='convo-bubble '+role;
  div.innerHTML=text.replace(/\n/g,'<br>');
  col.appendChild(div);
}

function convoAddCorrection(errors){
  var col=document.getElementById('convo-user-msgs');
  var div=document.createElement('div');
  div.className='convo-correction';
  var html='<div class="convo-correction-title">Javítások</div>';
  errors.forEach(function(e){
    html+='<div style="margin-bottom:.3rem"><span class="convo-err">'+e.wrong+'</span> → <span class="convo-fix">'+e.right+'</span>'+(e.explanation?'<span class="convo-fix-exp"> — '+e.explanation+'</span>':'')+'</div>';
    if(e.wrong && e.right) addErrorPattern(e.wrong, e.right, e.type||'grammar', e.explanation||'');
  });
  div.innerHTML=html; col.appendChild(div);
}

async function convoGetReply(){
  var msgs=convoHistory.map(function(m){ return {role:m.role==='claude'?'assistant':'user',content:m.content}; });
  if(!msgs.length) msgs=[{role:'user',content:'Please start.'}];
  show('convo-thinking');
  try{
    var r=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:200,system:convoSystemPrompt,messages:msgs})});
    var d=await r.json(); if(d.error) throw new Error(d.error.message);
    var reply=d.content[0].text.trim();
    convoHistory.push({role:'claude',content:reply});
    convoAddBubble('claude',reply);
    if(convoTTSEnabled) convoSpeak(reply);
    var el=document.getElementById('convo-claude-msgs'); if(el) el.scrollTop=el.scrollHeight;
  } catch(e){ convoAddBubble('claude','(Hiba: '+e.message+')'); }
  hide('convo-thinking');
}

async function convoGetReplyText(){
  var msgs=convoHistory.map(function(m){ return {role:m.role==='claude'?'assistant':'user',content:m.content}; });
  try{
    var r=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:200,system:convoSystemPrompt,messages:msgs})});
    var d=await r.json(); if(d.error) throw new Error(d.error.message);
    return d.content[0].text.trim();
  } catch(e){ return '(Hiba: '+e.message+')'; }
}

async function convoCheckErrors(text){
  try{
    var r=await claude('Grammar checker. Check this English text for errors. Return ONLY JSON: {"errors":[{"wrong":"exact phrase","right":"corrected","type":"grammar|typo|style","explanation":"brief HU explanation"}],"topics_ok":[],"topics_wrong":[]}. If no errors, errors=[]. Max 3 most important errors. For topics_ok/topics_wrong use ONLY ids from this list — TOPICS: '+roadmapTopicsForPrompt()+'. topics_wrong = grammar topics the student got WRONG; topics_ok = topics clearly used CORRECTLY. Empty arrays if unsure.','Check: "'+text+'"',500);
    return safeParseJSON(r);
  } catch(e){ return null; }
}

function convoToggleTTS(){
  convoTTSEnabled=!convoTTSEnabled;
  var btn=document.getElementById('convo-tts-btn');
  if(btn) btn.classList.toggle('active',convoTTSEnabled);
  if(!convoTTSEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
}

function convoRateChanged(){
  var sel=document.getElementById('convo-tts-rate');
  if(sel) localStorage.setItem('convo_tts_rate', sel.value);
}

function convoSpeak(text){
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var utt=new SpeechSynthesisUtterance(text);
  var rateEl=document.getElementById('convo-tts-rate');
  utt.lang='en-US'; utt.rate=rateEl?parseFloat(rateEl.value)||1:1; utt.pitch=1;
  // Ugyanaz a hangválasztó, mint a szövegértés felolvasónál (Natural > Google > en-US)
  var voice=compPickVoice();
  if(voice) utt.voice=voice;
  window.speechSynthesis.speak(utt);
}

function convoShowSummary(){
  var stats=document.getElementById('convo-stats');
  var sc=document.getElementById('convo-stats-content');
  var turns=convoHistory.filter(function(m){ return m.role==='user'; }).length;
  if(!convoErrors.length){ sc.innerHTML='<div class="ok-box">'+turns+' üzenet — Nem volt lényeges hiba. Kiváló munka!</div>'; }
  else {
    var byType={};
    convoErrors.forEach(function(e){ var t=e.type||'grammar'; if(!byType[t]) byType[t]=[]; byType[t].push(e); });
    var html='<div style="font-size:.84rem;color:var(--muted);margin-bottom:.8rem">'+turns+' üzenet · '+convoErrors.length+' javított hiba</div>';
    Object.keys(byType).forEach(function(t){
      var label=t==='grammar'?'Nyelvtani':t==='typo'?'Elütés':'Stílus';
      html+='<div style="font-weight:500;margin-bottom:.4rem">'+label+' ('+byType[t].length+')</div>';
      byType[t].forEach(function(e){ html+='<div class="corr-item '+t+'" style="margin-bottom:.4rem"><span class="convo-err">'+e.wrong+'</span> → <span class="convo-fix">'+e.right+'</span>'+(e.explanation?'<div class="corr-exp">'+e.explanation+'</div>':'')+'</div>'; });
    });
    sc.innerHTML=html;
  }
  stats.style.display='block'; stats.scrollIntoView({behavior:'smooth'});
}

function convoToggleMic(){
  if(convoListening){ convoStopMic(); return; }
  if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){ alert('Hangfelismerés csak Chrome-ban elérhető.'); return; }
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  convoRecog=new SR();
  convoRecog.lang='en-US'; convoRecog.continuous=false; convoRecog.interimResults=true;
  var final=document.getElementById('convo-input').value;
  convoRecog.onstart=function(){ convoListening=true; document.getElementById('convo-mic').classList.add('listening'); show('convo-listening'); };
  convoRecog.onresult=function(e){ var interim=''; for(var i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal) final+=e.results[i][0].transcript+' '; else interim+=e.results[i][0].transcript; } document.getElementById('convo-input').value=final+interim; };
  convoRecog.onend=function(){ convoListening=false; document.getElementById('convo-input').value=final.trim(); document.getElementById('convo-mic').classList.remove('listening'); hide('convo-listening'); };
  convoRecog.onerror=function(){ convoListening=false; document.getElementById('convo-mic').classList.remove('listening'); hide('convo-listening'); };
  convoRecog.start();
}

function convoStopMic(){
  if(convoRecog){ convoRecog.stop(); convoRecog=null; }
  convoListening=false;
  var mic=document.getElementById('convo-mic'); if(mic) mic.classList.remove('listening');
  hide('convo-listening');
}

// ============================================================
// OXFORD / SZÓTÁR
// ============================================================
function oxLoad(){
  var stored = localStorage.getItem('oxford_words');
  if(stored){
    oxWords = JSON.parse(stored);
    // Ha nincs __ts, az adat régi (csak localStorage, soha nem ment D1-be) — most migráljuk
    if(!localStorage.getItem('oxford_words__ts')) oxSave();
  }
  // allCards auto-migrate: ha van localStorage-ban de még nem szinkronizált D1-be
  var storedCards = localStorage.getItem('anki_cards');
  if(storedCards && !localStorage.getItem('anki_cards__ts')){
    allCards = JSON.parse(storedCards);
    Store.set('anki_cards', allCards);
  }
  oxPhraseLoad();
  return oxWords.length > 0;
}

// Store.set = localStorage + debounced D1 write-through → szinkronizál más eszközökre is
function oxSave(){ Store.set('oxford_words', oxWords); }
function oxPhraseSave(){ Store.set('oxford_phrases', oxPhrases); }
function oxPhraseLoad(){
  var s = localStorage.getItem('oxford_phrases');
  if(s){
    oxPhrases = JSON.parse(s);
    if(!localStorage.getItem('oxford_phrases__ts')) oxPhraseSave();
  }
}

function oxGetCounts(){
  var byLevel={};
  oxWords.forEach(function(w){
    if(!byLevel[w.l]) byLevel[w.l]={new:0,'under learning':0,active:0,passive:0,total:0};
    byLevel[w.l][w.s]=(byLevel[w.l][w.s]||0)+1;
    byLevel[w.l].total++;
  });
  return {byLevel:byLevel, total:oxWords.length};
}

function renderOxWordlist(){
  if(!oxWords.length){
    document.getElementById('ox-list-no-data').style.display='block';
    document.getElementById('ox-list-content').style.display='none';
    return;
  }
  document.getElementById('ox-list-no-data').style.display='none';
  document.getElementById('ox-list-content').style.display='block';
  var q=(document.getElementById('ox-search')||{value:''}).value.toLowerCase().trim();
  var fLevel=(document.getElementById('ox-filter-level')||{value:''}).value;
  var fStatus=(document.getElementById('ox-filter-status')||{value:''}).value;
  var fSource=(document.getElementById('ox-filter-source')||{value:''}).value;
  var filtered=oxWords.filter(function(w){
    if(q && w.w.toLowerCase().indexOf(q)===-1) return false;
    if(fLevel && w.l!==fLevel) return false;
    if(fStatus && w.s!==fStatus) return false;
    if(fSource==='oxford' && w.source==='own') return false;
    if(fSource==='own' && w.source!=='own') return false;
    return true;
  });
  var totalPages=Math.ceil(filtered.length/OX_PAGE_SIZE);
  if(oxPage>=totalPages) oxPage=Math.max(0,totalPages-1);
  var pageItems=filtered.slice(oxPage*OX_PAGE_SIZE,(oxPage+1)*OX_PAGE_SIZE);
  var rows='';
  pageItems.forEach(function(w){
    var idx=oxWords.indexOf(w);
    var sCls='s-'+(w.s==='under learning'?'under':w.s);
    var card=allCards.find(function(c){ return (c.english||'').toLowerCase()===w.w.toLowerCase(); });
    rows+='<tr><td class="ox-word-cell">'+w.w+'</td>'
      +'<td><span class="badge">'+w.p+'</span></td>'
      +'<td><span class="badge lvl-'+w.l.toLowerCase()+'">'+w.l+'</span></td>'
      +'<td><select class="ox-status-select '+sCls+'" onchange="oxChangeStatus('+idx+',this.value)">'
      +'<option value="new"'+(w.s==='new'?' selected':'')+'>New</option>'
      +'<option value="under learning"'+(w.s==='under learning'?' selected':'')+'>Under learning</option>'
      +'<option value="active"'+(w.s==='active'?' selected':'')+'>Active</option>'
      +'<option value="passive"'+(w.s==='passive'?' selected':'')+'>Passive</option>'
      +'</select></td>'
      +'<td>'+(card?card.hungarian:'<span style="color:var(--faint)">—</span>')+'</td>'
      +'<td style="font-size:.78rem;font-style:italic;color:var(--muted)">'+(card?card.example:'')+'</td>'
      +'<td style="font-size:.75rem;color:var(--muted)">'+(card?card.collocations:'')+'</td>'
      +'</tr>';
  });
  document.getElementById('ox-table-body').innerHTML=rows;
  // Pagination
  var pagHtml='';
  if(totalPages>1){
    pagHtml='<span style="font-size:.8rem;color:var(--muted);margin-right:8px">'+(oxPage+1)+' / '+totalPages+'</span>';
    if(oxPage>0) pagHtml+='<button class="ox-page-btn" onclick="oxGoPage('+(oxPage-1)+')">← Előző</button>';
    var s=Math.max(0,oxPage-2),e2=Math.min(totalPages-1,oxPage+2);
    for(var p=s;p<=e2;p++) pagHtml+='<button class="ox-page-btn'+(p===oxPage?' active':'')+'" onclick="oxGoPage('+p+'">'+(p+1)+'</button>';
    if(oxPage<totalPages-1) pagHtml+='<button class="ox-page-btn" onclick="oxGoPage('+(oxPage+1)+')">Következő →</button>';
  }
  document.getElementById('ox-pagination').innerHTML=pagHtml;
}

function oxGoPage(p){ oxPage=p; renderOxWordlist(); }

function oxChangeStatus(idx,val){
  if(!oxWords[idx]) return;
  oxWords[idx].s=val; oxSave();
  document.querySelectorAll('.ox-status-select').forEach(function(sel){
    sel.classList.remove('s-new','s-under','s-active','s-passive');
    sel.classList.add('s-'+(sel.value==='under learning'?'under':sel.value));
  });
}

// ANKI CONNECT
function ankiRequest(action, params){
  return fetch('http://localhost:8765',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,version:6,params:params||{}})})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.error) throw new Error(d.error); return d.result; });
}

// Az elmúlt 7 nap Anki review-idejének lekérése és beírása a learning_time-ba.
// cardIds opcionális — ha nincs megadva, maga kéri le (English C1 Vocab kártyák).
async function ankiFetchReviewTimes(cardIds){
  if(!cardIds) cardIds = await ankiRequest('findCards',{query:'note:"English C1 Vocab"'});
  if(!cardIds || !cardIds.length) return false;
  var since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - 6);
  var sinceMs = since.getTime();
  var reviewTimes = {};
  for(var ri=0; ri<cardIds.length; ri+=200){
    var rchunk = cardIds.slice(ri, ri+200);
    var reviews = await ankiRequest('getReviewsOfCards', {cards: rchunk});
    if(reviews){
      Object.values(reviews).forEach(function(cardReviews){
        cardReviews.forEach(function(r){
          if(r.id >= sinceMs){
            var rDate = localDateStr(new Date(r.id));
            reviewTimes[rDate] = (reviewTimes[rDate]||0) + Math.floor((r.time||0)/1000);
          }
        });
      });
    }
  }
  if(Object.keys(reviewTimes).length){
    var ltData = JSON.parse(localStorage.getItem('learning_time')||'{}');
    Object.keys(reviewTimes).forEach(function(date){
      if(!ltData[date]) ltData[date]={};
      ltData[date].anki = reviewTimes[date]; // a tudatos gyakorlásba számít (lásd dayCategorySecs)
    });
    localStorage.setItem('learning_time', JSON.stringify(ltData));
  }
  return true;
}

// Csendes háttérfrissítés az Áttekintés panelhez: ha fut az Anki, behúzza a friss
// review-időket és újrarajzolja a statisztikákat; ha nem fut, némán kihagyja.
var _ankiActivityLast = 0;
async function ankiRefreshActivity(){
  if(Date.now() - _ankiActivityLast < 30*60*1000) return; // legfeljebb félóránként
  _ankiActivityLast = Date.now();
  try{
    if(await ankiFetchReviewTimes()) renderProgressOverview();
  } catch(e){ /* Anki nem elérhető — nem zavarjuk a felhasználót */ }
}

// ============================================================
// ANKI HUNGARIAN MEZŐ TISZTÍTÁS
// ============================================================
async function ankiCleanHungarian(){
  var btn = document.getElementById('btn-anki-clean');
  var result = document.getElementById('anki-clean-result');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Keresés...'; }
  if(result) result.innerHTML = '';

  // Patterns to remove from Hungarian field
  var patterns = [
    /\s*\(noun\)/gi, /\s*\(verb\)/gi, /\s*\(adjective\)/gi, /\s*\(adverb\)/gi,
    /\s*\(preposition\)/gi, /\s*\(phrase\)/gi, /\s*\(idiom\)/gi,
    /\s*\(abbreviation\)/gi, /\s*\(pronoun\)/gi, /\s*\(conjunction\)/gi,
    /\s*\(determiner\)/gi, /\s*\(exclamation\)/gi, /\s*\(number\)/gi,
    /\s*\[noun\]/gi, /\s*\[verb\]/gi, /\s*\[adj\]/gi, /\s*\[adverb\]/gi,
    /^noun:\s*/gi, /^verb:\s*/gi, /^adj:\s*/gi, /^adv:\s*/gi,
    /\s*noun$/gi, /\s*verb$/gi
  ];

  function cleanHu(text){
    var cleaned = text;
    patterns.forEach(function(p){ cleaned = cleaned.replace(p, ''); });
    return cleaned.trim();
  }

  try {
    if(result) result.innerHTML = '<div class="loading"><div class="dots"><span></span><span></span><span></span></div> Kártyák lekérése...</div>';

    var noteIds = await ankiRequest('findNotes', {query: 'note:"English C1 Vocab"'});
    if(!noteIds || !noteIds.length){
      if(result) result.innerHTML = '<div class="err">Nem találtam kártyákat.</div>';
      if(btn){ btn.disabled = false; btn.textContent = '🧹 Hungarian mező tisztítása'; }
      return;
    }

    if(result) result.innerHTML = '<div class="loading"><div class="dots"><span></span><span></span><span></span></div> ' + noteIds.length + ' kártya ellenőrzése...</div>';

    var CHUNK = 500;
    var toUpdate = [];

    for(var i = 0; i < noteIds.length; i += CHUNK){
      var chunk = noteIds.slice(i, i + CHUNK);
      var info = await ankiRequest('notesInfo', {notes: chunk});
      info.forEach(function(n){
        if(!n || !n.fields || !n.fields.Hungarian) return;
        var orig = n.fields.Hungarian.value;
        var cleaned = cleanHu(orig);
        if(cleaned !== orig){
          toUpdate.push({id: n.noteId, orig: orig, cleaned: cleaned});
        }
      });
    }

    if(!toUpdate.length){
      if(result) result.innerHTML = '<div class="ok-box">Nincs javítandó kártya — minden Hungarian mező tiszta! ✅</div>';
      if(btn){ btn.disabled = false; btn.textContent = '🧹 Hungarian mező tisztítása'; }
      return;
    }

    if(result) result.innerHTML = '<div class="loading"><div class="dots"><span></span><span></span><span></span></div> ' + toUpdate.length + ' kártya javítása...</div>';

    // Update in chunks
    var updated = 0;
    for(var j = 0; j < toUpdate.length; j++){
      var item = toUpdate[j];
      try {
        await ankiRequest('updateNoteFields', {
          note: {id: item.id, fields: {Hungarian: item.cleaned}}
        });
        updated++;
      } catch(e) {
        console.error('Update failed for note', item.id, e);
      }
    }

    if(result) result.innerHTML = '<div class="ok-box">✅ ' + updated + ' kártya javítva! ' + (toUpdate.length - updated > 0 ? (toUpdate.length - updated) + ' sikertelen.' : '') + '</div>';

  } catch(e) {
    if(result) result.innerHTML = '<div class="err">Hiba: ' + e.message + '</div>';
  }

  if(btn){ btn.disabled = false; btn.textContent = '🧹 Hungarian mező tisztítása'; }
}

async function ankiTest(){
  try{
    var v=await ankiRequest('version');
    document.getElementById('anki-sync-result').innerHTML='<div class="ok-box">AnkiConnect v'+v+' elérhető!</div>';
  } catch(e){
    document.getElementById('anki-sync-result').innerHTML='<div class="err">Nem elérhető: '+e.message+'</div>';
  }
}

async function ankiSync(){
  if(!oxWords.length){ document.getElementById('anki-sync-result').innerHTML='<div class="err">Először töltsd be az Oxford 5000 XLS fájlt!</div>'; return; }
  var btn=document.getElementById('btn-anki-sync');
  var status=document.getElementById('anki-sync-status');
  var result=document.getElementById('anki-sync-result');
  btn.disabled=true; status.textContent='Kártyák lekérése...'; result.innerHTML='';
  try{
    var noteIds=await ankiRequest('findNotes',{query:'note:"English C1 Vocab"'});
    if(!noteIds||!noteIds.length){ result.innerHTML='<div class="err">Nem találtam kártyákat. Előbb tölts fel szavakat!</div>'; btn.disabled=false; status.textContent=''; return; }
    status.textContent='Notes info lekérése ('+noteIds.length+')...';
    var CHUNK=500, fieldMap={};
    for(var i=0;i<noteIds.length;i+=CHUNK){
      var chunk=noteIds.slice(i,i+CHUNK);
      var info=await ankiRequest('notesInfo',{notes:chunk});
      info.forEach(function(n){ if(n&&n.fields&&n.fields.English) fieldMap[n.fields.English.value.toLowerCase()]={noteId:n.noteId,fields:n.fields}; });
    }
    status.textContent='Kártyák interval lekérése...';
    var cardIds=await ankiRequest('findCards',{query:'note:"English C1 Vocab"'});
    var cardMap={};
    for(var i=0;i<cardIds.length;i+=CHUNK){
      var chunk=cardIds.slice(i,i+CHUNK);
      var cinfo=await ankiRequest('cardsInfo',{cards:chunk});
      cinfo.forEach(function(c){ if(c&&c.note) cardMap[c.note]=(cardMap[c.note]||0)+c.interval; });
    }
    var updated=0, unchanged=0, notFound=0;
    oxWords.forEach(function(w){
      var key=w.w.toLowerCase();
      var noteInfo=fieldMap[key];
      if(!noteInfo){ notFound++; return; }
      var ivl=cardMap[noteInfo.noteId]||0;
      var newStatus=ivl===0?'new':ivl<=7?'under learning':'active';
      if(w.s==='passive') return;
      if(newStatus!==w.s){ w.s=newStatus; updated++; }
      else unchanged++;
    });
    oxSave();
    // allCards frissítése az Anki kártyák mezőiből (Hungarian, Example, Collocations)
    allCards = [];
    Object.values(fieldMap).forEach(function(info){
      var f = info.fields;
      allCards.push({
        english:      (f.English      ||{}).value || '',
        hungarian:    (f.Hungarian    ||{}).value || '',
        example:      (f.Example      ||{}).value || '',
        collocations: (f.Collocations ||{}).value || '',
        level:        (f.Level        ||{}).value || '',
        source:       (f.Source       ||{}).value || '',
        status:       (f.Status       ||{}).value || ''
      });
    });
    Store.set('anki_cards', allCards);
    renderOxWordlist();
    renderPhrases();
    // Anki review idők lekérése heti bontásban
    status.textContent='Review idők lekérése...';
    try { await ankiFetchReviewTimes(cardIds); }
    catch(re){ console.warn('Review idők lekérése sikertelen:', re); }
    initProgressPanel();
    result.innerHTML='<div class="ok-box">Szinkronizáció kész! '+updated+' státusz frissítve, '+unchanged+' változatlan, '+notFound+' Oxford szó nincs még Ankiban. '+allCards.length+' kártya betöltve.</div>';
  } catch(e){
    result.innerHTML='<div class="err">Hiba: '+(e.message||'Ismeretlen hiba')+'</div>';
    console.error('ankiSync error:', e);
  }
  btn.disabled=false; status.textContent='';
}

// BULK UPLOAD (Words)
function bulkStartLevel(){
  var level=document.getElementById('bulk-level-select').value;
  var status=document.getElementById('bulk-status-select').value;
  bulkQueue=oxWords.filter(function(w){ return w.l===level&&w.s===status; });
  if(!bulkQueue.length){ document.getElementById('bulk-result').innerHTML='<div class="ok-box">Nincs '+status+' státuszú szó a(z) '+level+' szinten.</div>'; return; }
  bulkIdx=0; bulkStats={uploaded:0,skipped:0,failed:0,total:bulkQueue.length}; bulkRunning=true;
  document.getElementById('bulk-progress-wrap').style.display='block';
  document.getElementById('bulk-result').innerHTML='';
  document.getElementById('btn-bulk-start').disabled=true;
  document.getElementById('btn-bulk-stop').style.display='inline-block';
  bulkUpdateProgress();
  bulkRunAuto();
}

function bulkUpdateProgress(){
  var pct=bulkStats.total?Math.round(bulkIdx/bulkStats.total*100):0;
  document.getElementById('bulk-progress-label').textContent=bulkIdx+' / '+bulkStats.total+' szó feldolgozva · '+bulkStats.uploaded+' feltöltve'+(bulkStats.failed?' · '+bulkStats.failed+' hiba':'');
  document.getElementById('bulk-progress-pct').textContent=pct+'%';
  document.getElementById('bulk-progress-bar').style.width=pct+'%';
}

async function bulkGenOneCard(w){
  var r=await claude('You are an Anki flashcard creator for a Hungarian B1 English learner. Return ONLY a valid JSON object (NOT an array). Fields: english, hungarian (2-3 HU meanings, no part of speech), example (natural B1 sentence), collocations (3 collocations with HU translation separated by · symbol, format: "EN – HU · EN – HU"), level, source ("Oxford 5000"), status ("NEW"). No markdown.','Create one Anki card for this word: '+w.w+' ('+w.p+', '+w.l+')',600);
  var cleaned=r.replace(/```json|```/g,'').trim();
  if(cleaned.startsWith('[')){ var arr=JSON.parse(cleaned); return Array.isArray(arr)?arr[0]:arr; }
  return JSON.parse(cleaned);
}

async function bulkUploadCard(c, w){
  var collocs=(c.collocations||'').replace(/;\s*/g,' · ');
  var note={deckName:'English C1::Foundation '+w.l+' new',modelName:'English C1 Vocab',fields:{English:c.english||w.w,Hungarian:c.hungarian||'',Example:c.example||'',Collocations:collocs,IPA:'',Level:w.l,Source:'Oxford 5000 '+w.l+' new',Status:'NEW'},tags:['oxford_5000_'+w.l.toLowerCase()+'_new'],options:{allowDuplicate:true}};
  var result=await ankiRequest('addNotes',{notes:[note]});
  return result&&result[0]!==null;
}

async function bulkRunAuto(){
  for(var i=0;i<bulkQueue.length;i++){
    if(!bulkRunning) break;
    var w=bulkQueue[i]; bulkIdx=i+1;
    var genStatus=document.getElementById('bulk-gen-status');
    if(genStatus) genStatus.textContent='('+bulkIdx+'/'+bulkStats.total+') Generálás: '+w.w+'...';
    show('bulk-gen-loading');
    var success=false;
    for(var attempt=0;attempt<2;attempt++){
      try{
        var card=await bulkGenOneCard(w);
        if(!card||!card.hungarian) continue;
        var uploaded=await bulkUploadCard(card,w);
        if(uploaded){ bulkStats.uploaded++; var oxIdx=oxWords.indexOf(w); if(oxIdx>=0) oxWords[oxIdx].card=true; allCards.push({english:card.english||w.w,hungarian:card.hungarian,example:card.example,collocations:(card.collocations||'').replace(/;\s*/g,' · '),level:w.l,source:'Oxford 5000',status:'NEW'}); success=true; break; }
      } catch(e){ if(attempt===0) await new Promise(function(res){ setTimeout(res,2000); }); }
    }
    if(!success) bulkStats.failed++;
    bulkUpdateProgress();
    await new Promise(function(res){ setTimeout(res,800); });
  }
  oxSave(); saveCards();
  hide('bulk-gen-loading');
  document.getElementById('btn-bulk-start').disabled=false;
  document.getElementById('btn-bulk-stop').style.display='none';
  document.getElementById('bulk-result').innerHTML='<div class="ok-box"><strong>Kész!</strong> '+bulkStats.uploaded+' kártya feltöltve Ankiba.'+(bulkStats.failed?' '+bulkStats.failed+' sikertelen.':'')+'</div>';
  bulkRunning=false;
}

function bulkStop(){ bulkRunning=false; document.getElementById('btn-bulk-start').disabled=false; document.getElementById('btn-bulk-stop').style.display='none'; }

// PHRASES
function renderPhrases(){
  if(!oxPhrases.length){ document.getElementById('ox-phrases-no-data').style.display='block'; document.getElementById('ox-phrases-content').style.display='none'; return; }
  document.getElementById('ox-phrases-no-data').style.display='none'; document.getElementById('ox-phrases-content').style.display='block';
  var q=(document.getElementById('phrase-search')||{value:''}).value.toLowerCase().trim();
  var fLevel=(document.getElementById('phrase-filter-level')||{value:''}).value;
  var fStatus=(document.getElementById('phrase-filter-status')||{value:''}).value;
  var filtered=oxPhrases.filter(function(p){ if(q&&p.w.toLowerCase().indexOf(q)===-1) return false; if(fLevel&&p.l!==fLevel) return false; if(fStatus&&p.s!==fStatus) return false; return true; });
  var info=document.getElementById('phrase-list-info'); if(info) info.textContent=filtered.length+' kifejezés';
  var totalPages=Math.ceil(filtered.length/PHRASE_PAGE_SIZE);
  if(phrasePageIdx>=totalPages) phrasePageIdx=Math.max(0,totalPages-1);
  var pageItems=filtered.slice(phrasePageIdx*PHRASE_PAGE_SIZE,(phrasePageIdx+1)*PHRASE_PAGE_SIZE);
  var html='';
  pageItems.forEach(function(p){
    var idx=oxPhrases.indexOf(p);
    var sCls='s-'+(p.s==='under learning'?'under':p.s);
    var cardData=allCards.find(function(c){ return (c.english||'').toLowerCase()===p.w.toLowerCase(); });
    html+='<tr><td class="ox-word-cell">'+p.w+'</td><td><span class="badge lvl-'+p.l.toLowerCase()+'">'+p.l+'</span></td><td><select class="ox-status-select '+sCls+'" onchange="phraseChangeStatus('+idx+',this.value)"><option value="new"'+(p.s==='new'?' selected':'')+'>New</option><option value="under learning"'+(p.s==='under learning'?' selected':'')+'>Under learning</option><option value="active"'+(p.s==='active'?' selected':'')+'>Active</option><option value="passive"'+(p.s==='passive'?' selected':'')+'>Passive</option></select></td><td>'+(cardData?'<span style="font-size:.8rem">'+cardData.hungarian+'</span>':'<span style="color:var(--faint)">—</span>')+'</td><td>'+(cardData?'<span style="font-size:.78rem;font-style:italic">'+cardData.example+'</span>':'')+'</td></tr>';
  });
  document.getElementById('phrase-table-body').innerHTML=html;
  // Pagination
  var pagHtml='';
  if(totalPages>1){
    pagHtml+='<span style="font-size:.8rem;color:var(--muted);margin-right:8px">'+(phrasePageIdx+1)+' / '+totalPages+'</span>';
    if(phrasePageIdx>0) pagHtml+='<button class="ox-page-btn" onclick="phraseGoPage('+(phrasePageIdx-1)+')">← Előző</button>';
    if(phrasePageIdx<totalPages-1) pagHtml+='<button class="ox-page-btn" onclick="phraseGoPage('+(phrasePageIdx+1)+')">Következő →</button>';
  }
  document.getElementById('phrase-pagination').innerHTML=pagHtml;
}

function phraseGoPage(p){ phrasePageIdx=p; renderPhrases(); }

function phraseChangeStatus(idx,val){ if(!oxPhrases[idx]) return; oxPhrases[idx].s=val; oxPhraseSave(); }

function phraseImportXLS(input){
  var file=input.files[0]; if(!file) return;
  document.getElementById('phrase-xls-status').textContent='Betöltés...';
  var reader=new FileReader();
  reader.onload=function(e){
    if(typeof XLSX==='undefined'){
      var script=document.createElement('script');
      script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload=function(){ phraseParseXLSX(e.target.result); };
      document.head.appendChild(script);
    } else { phraseParseXLSX(e.target.result); }
  };
  reader.readAsArrayBuffer(file);
}

function phraseParseXLSX(buffer){
  try{
    var wb=XLSX.read(buffer,{type:'array'});
    var ws=wb.Sheets[wb.SheetNames[0]];
    var rows=XLSX.utils.sheet_to_json(ws,{defval:'',range:2});
    var phrases=[];
    rows.forEach(function(row){
      var phrase=(row['Phrase']||row['phrase']||Object.values(row)[2]||'').toString().trim();
      var level=(row['CEFR']||row['cefr']||Object.values(row)[1]||'').toString().trim();
      if(phrase&&['A1','A2','B1','B2','C1'].indexOf(level)>-1) phrases.push({w:phrase,s:'new',l:level,p:'phrase',card:false});
    });
    if(!phrases.length) throw new Error('Nem találtam kifejezéseket.');
    oxPhrases=phrases; oxPhraseSave();
    document.getElementById('phrase-xls-status').textContent='✓ '+phrases.length+' kifejezés betöltve!';
    renderPhrases();
  } catch(err){ document.getElementById('phrase-xls-status').textContent='Hiba: '+err.message; }
}

async function phraseBulkStart(){
  var level=document.getElementById('phrase-bulk-level').value;
  phraseQueue=oxPhrases.filter(function(p){ return p.l===level&&p.s==='new'; });
  if(!phraseQueue.length){ document.getElementById('phrase-bulk-result').innerHTML='<div class="ok-box">Nincs new státuszú kifejezés a(z) '+level+' szinten.</div>'; return; }
  phraseIdx=0; phraseStats={uploaded:0,failed:0,total:phraseQueue.length}; phraseRunning=true;
  document.getElementById('phrase-bulk-progress').style.display='block';
  document.getElementById('phrase-bulk-result').innerHTML='';
  document.getElementById('btn-phrase-bulk').disabled=true;
  document.getElementById('btn-phrase-stop').style.display='inline-block';
  phraseUpdateProgress();
  phraseRunAuto();
}

function phraseUpdateProgress(){
  var pct=phraseStats.total?Math.round(phraseIdx/phraseStats.total*100):0;
  document.getElementById('phrase-prog-label').textContent=phraseIdx+' / '+phraseStats.total+' feldolgozva · '+phraseStats.uploaded+' feltöltve';
  document.getElementById('phrase-prog-pct').textContent=pct+'%';
  document.getElementById('phrase-prog-bar').style.width=pct+'%';
}

async function phraseRunAuto(){
  for(var i=0;i<phraseQueue.length;i++){
    if(!phraseRunning) break;
    var p=phraseQueue[i]; phraseIdx=i+1;
    document.getElementById('phrase-bulk-status').textContent='('+phraseIdx+'/'+phraseStats.total+') '+p.w+'...';
    var success=false;
    for(var attempt=0;attempt<2;attempt++){
      try{
        var r=await claude('You are an Anki flashcard creator for a Hungarian B1 English learner. Return ONLY a valid JSON object. Fields: english (phrase exactly), hungarian (HU translation), example (B1-B2 sentence), collocations (2-3 variations/extensions with HU translation separated by · symbol), level, source ("Oxford Phrase List"), status ("NEW"). No markdown.','Create one Anki card for this English phrase: '+p.w+' ('+p.l+')',600);
        var cleaned=r.replace(/```json|```/g,'').trim();
        var card=cleaned.startsWith('[')?JSON.parse(cleaned)[0]:JSON.parse(cleaned);
        if(!card||!card.hungarian) continue;
        var collocs=(card.collocations||'').replace(/;\s*/g,' · ');
        var note={deckName:'English C1::Phrases '+p.l,modelName:'English C1 Vocab',fields:{English:card.english||p.w,Hungarian:card.hungarian||'',Example:card.example||'',Collocations:collocs,IPA:'',Level:p.l,Source:'Oxford Phrase List '+p.l,Status:'NEW'},tags:['oxford_phrase_list_'+p.l.toLowerCase()],options:{allowDuplicate:true}};
        var result=await ankiRequest('addNotes',{notes:[note]});
        if(result&&result[0]!==null){ phraseStats.uploaded++; var pidx=oxPhrases.indexOf(p); if(pidx>=0){ oxPhrases[pidx].card=true; oxPhrases[pidx].s='under learning'; } allCards.push({english:card.english||p.w,hungarian:card.hungarian,example:card.example,collocations:collocs,level:p.l,source:'Oxford Phrase List',status:'NEW'}); success=true; break; }
      } catch(e){ if(attempt===0) await new Promise(function(res){ setTimeout(res,2000); }); }
    }
    if(!success) phraseStats.failed++;
    phraseUpdateProgress();
    await new Promise(function(res){ setTimeout(res,800); });
  }
  oxPhraseSave(); saveCards();
  document.getElementById('btn-phrase-bulk').disabled=false;
  document.getElementById('btn-phrase-stop').style.display='none';
  document.getElementById('phrase-bulk-status').textContent='';
  document.getElementById('phrase-bulk-result').innerHTML='<div class="ok-box"><strong>Kész!</strong> '+phraseStats.uploaded+' kifejezés feltöltve.'+(phraseStats.failed?' '+phraseStats.failed+' sikertelen.':'')+'</div>';
  phraseRunning=false; renderPhrases();
}

function phraseStop(){ phraseRunning=false; document.getElementById('btn-phrase-bulk').disabled=false; document.getElementById('btn-phrase-stop').style.display='none'; document.getElementById('phrase-bulk-result').innerHTML='<div class="ok-box">Leállítva. '+phraseStats.uploaded+' feltöltve.</div>'; }

// OX IMPORT/EXPORT
function oxImportXLS(input){
  var file=input.files[0]; if(!file) return;
  document.getElementById('ox-xls-status').textContent='Betöltés...';
  var reader=new FileReader();
  reader.onload=function(e){
    if(typeof XLSX==='undefined'){
      var script=document.createElement('script');
      script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload=function(){ oxParseXLSX(e.target.result); };
      document.head.appendChild(script);
    } else { oxParseXLSX(e.target.result); }
  };
  reader.readAsArrayBuffer(file);
}

function oxParseXLSX(buffer){
  try{
    var wb=XLSX.read(buffer,{type:'array'});
    var ws=wb.Sheets[wb.SheetNames[0]];
    var rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    var words=[];
    rows.forEach(function(row){
      var w=(row['Szó']||row['Word']||row['word']||Object.values(row)[0]||'').toString().trim().toLowerCase();
      var s=(row['Status']||row['status']||row['Státusz']||'new').toString().trim().toLowerCase();
      var p=(row['Szófaj']||row['Part']||row['pos']||'').toString().trim();
      var l=(row['Szint']||row['Level']||row['level']||'B1').toString().trim();
      if(w&&['A1','A2','B1','B2','C1'].indexOf(l)>-1) words.push({w:w,s:s,p:p,l:l,card:false});
    });
    if(!words.length) throw new Error('Nem találtam szavakat.');
    oxWords=words; oxSave();
    document.getElementById('ox-xls-status').textContent='✓ '+words.length+' szó betöltve!';
    renderVocabDashboard();
  } catch(err){ document.getElementById('ox-xls-status').textContent='Hiba: '+err.message; }
}

function oxExportCSV(){
  var level=(document.getElementById('ox-export-level')||{value:''}).value;
  var status=(document.getElementById('ox-export-status')||{value:''}).value;
  var filtered=oxWords.filter(function(w){ return (!level||w.l===level)&&(!status||w.s===status); });
  var csv='English,Hungarian,Example,Collocations,IPA,Level,Source,Status\n';
  filtered.forEach(function(w){
    var card=allCards.find(function(c){ return (c.english||'').toLowerCase()===w.w; });
    csv+='"'+w.w+'","'+(card?card.hungarian:'')+'","'+(card?card.example:'')+'","'+(card?card.collocations:'')+'","","'+w.l+'","Oxford 5000","'+w.s+'"\n';
  });
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='oxford_export.csv'; a.click();
}

function oxImportAnki(input){
  var file=input.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    var lines=e.target.result.split('\n');
    var updated=0;
    lines.forEach(function(line){
      var parts=line.trim().split('\t');
      if(parts.length>=2){
        var word=parts[0].toLowerCase().trim();
        var status=parts[1].trim();
        var idx=oxWords.findIndex(function(w){ return w.w===word; });
        if(idx>=0&&['new','under learning','active','passive'].indexOf(status)>-1){ oxWords[idx].s=status; updated++; }
      }
    });
    oxSave();
    document.getElementById('ox-anki-status').textContent='✓ '+updated+' státusz frissítve';
  };
  reader.readAsText(file);
}

function oxClearData(){
  if(!confirm('Biztosan törlöd az összes Oxford adatot? Ez nem vonható vissza.')) return;
  oxWords=[]; oxPhrases=[]; oxSave(); oxPhraseSave();
  allCards=[]; Store.set('anki_cards', []);
  renderVocabDashboard();
}

function toggleBackup(){
  var section=document.getElementById('backup-section');
  var arrow=document.getElementById('backup-arrow');
  if(section){ section.style.display=section.style.display==='none'?'block':'none'; }
  if(arrow){ arrow.style.transform=section&&section.style.display==='block'?'rotate(180deg)':''; }
}

// Azonnali felhő szinkron — az összes helyi adat D1-be push-olása
function forcePushAll(){
  var btn=document.getElementById('btn-force-push');
  var status=document.getElementById('force-push-status');
  if(btn){ btn.disabled=true; btn.textContent='Mentés...'; }
  if(status){ status.textContent=''; }
  Store.pushAll(function(count){
    if(btn){ btn.disabled=false; btn.textContent='☁ Adatok mentése felhőbe'; }
    if(status){ status.textContent='✓ Szinkronizálva! Az adatok más eszközökön is elérhetők.'; }
  });
}

// CARDS
function saveCards(){ Store.set('anki_cards', allCards); }


function updateWritingLabels(){
  var srcBadge = document.getElementById('writing-source-badge');
  var srcLang = document.getElementById('writing-source-lang');
  var tgtBadge = document.getElementById('writing-target-badge');
  var tgtLang = document.getElementById('writing-target-lang');
  if(genDir === 'hu'){
    if(srcBadge){ srcBadge.textContent='HU'; srcBadge.className='col-badge badge-hu'; }
    if(srcLang) srcLang.textContent = 'Magyar szöveg';
    if(tgtBadge){ tgtBadge.textContent='EN'; tgtBadge.className='col-badge badge-en'; }
    if(tgtLang) tgtLang.textContent = 'A te fordításod (EN)';
  } else {
    if(srcBadge){ srcBadge.textContent='EN'; srcBadge.className='col-badge badge-en'; }
    if(srcLang) srcLang.textContent = 'Angol szöveg';
    if(tgtBadge){ tgtBadge.textContent='HU'; tgtBadge.className='col-badge badge-hu'; }
    if(tgtLang) tgtLang.textContent = 'A te fordításod (HU)';
  }
}

function updateCounters(){
  var total=oxWords.length;
  var active=oxWords.filter(function(w){ return w.s==='active'; }).length;
  var el=document.getElementById('counter-words');
  if(el) el.textContent=active+' aktív / '+total+' szó';
}

// MISC
function oxSaveSnapshot(){
  var snap=JSON.parse(localStorage.getItem('ox_snapshots')||'[]');
  var now=new Date(); var week=getWeekNumber(now);
  var counts=oxGetCounts();
  snap.push({week:'W'+week,year:now.getFullYear(),counts:counts});
  if(snap.length>52) snap=snap.slice(-52);
  localStorage.setItem('ox_snapshots',JSON.stringify(snap));
}

function getWeekNumber(d){
  d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  var yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/86400000)+1)/7);
}


