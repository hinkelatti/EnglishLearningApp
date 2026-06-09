
var grStatuses=JSON.parse(localStorage.getItem('gr_statuses')||'{}');
var currentModalId=null;




// ============================================================
// STATE VARIABLES
// ============================================================
var apiKey = '', trText = '', huText = '', selWords = new Set();
var selectedLevel = 'B1', genLevel = 'B1', genDir = 'en', trOutLang = 'en';
var writingDir = 'en-hu', genSelectedTopic = '';
var writingType = 'general', emailTone = 'formal';
var allCards = JSON.parse(localStorage.getItem('anki_cards') || '[]');
var oxWords = [], oxPhrases = [];
var exState = 'idle';
var currentExIdx = 0, exScore = {correct:0, total:0}, exerciseQueue = [];
var selectedTenses = new Set();
var compQuestions = [];
var convoLevel = 'B1', convoHistory = [], convoSystemPrompt = '';
var convoErrors = [], convoRecog = null, convoListening = false, convoTTSEnabled = false;
var convoSelectedTopic = '';
var analyzerLang = 'auto';
var phrasePageIdx = 0, PHRASE_PAGE_SIZE = 50;
var phraseRunning = false, phraseQueue = [], phraseIdx = 0;
var phraseStats = {uploaded:0, failed:0, total:0};
var bulkQueue = [], bulkIdx = 0, bulkRunning = false;
var bulkStats = {uploaded:0, skipped:0, failed:0, total:0};
var oxPage = 0, OX_PAGE_SIZE = 50;
var genLevel = 'B1';

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

  return {get: get, set: set, pull: pull};
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
      var status = grStatuses[id] || 'todo';
      var dot = status==='done'?'ref-dot-done':status==='learning'?'ref-dot-learning':'ref-dot-todo';
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
      if (grStatuses[item.id] === 'done') done++;
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

  // Sessions this week
  var sessions = JSON.parse(localStorage.getItem('weekly_sessions') || '[]');
  var weekStart = getWeekStart();
  var weekSessions = sessions.filter(function(s) { return s.date >= weekStart; }).length;
  var sessEl = document.getElementById('stat-sessions');
  if (sessEl) sessEl.textContent = weekSessions || '0';

  // Weekly activity bars
  renderWeeklyActivity(sessions);
}

function getWeekStart() {
  var d = new Date();
  var day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function logSession() {
  var sessions = JSON.parse(localStorage.getItem('weekly_sessions') || '[]');
  var today = new Date().toISOString().slice(0, 10);
  var todayEntry = sessions.find(function(s) { return s.date === today; });
  if (!todayEntry) {
    sessions.push({ date: today, count: 1 });
  } else {
    todayEntry.count++;
  }
  localStorage.setItem('weekly_sessions', JSON.stringify(sessions));
}

function renderWeeklyActivity(sessions) {
  var wrap = document.getElementById('weekly-activity');
  if (!wrap) return;
  var days = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V'];
  var weekStart = getWeekStart();
  var html = '';
  for (var i = 0; i < 7; i++) {
    var d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    var dateStr = d.toISOString().slice(0, 10);
    var entry = sessions.find(function(s) { return s.date === dateStr; });
    var count = entry ? entry.count : 0;
    var height = Math.min(count * 15, 50);
    var isToday = dateStr === new Date().toISOString().slice(0, 10);
    html += '<div class="weekly-day-bar">'
      + '<div class="weekly-day-fill" style="height:' + Math.max(height, 3) + 'px;'
      + (isToday ? 'opacity:1;background:var(--success)' : count > 0 ? 'opacity:.7' : 'opacity:.2') + '"></div>'
      + '<div class="weekly-day-label">' + days[i] + '</div>'
      + '</div>';
  }
  wrap.innerHTML = html;
}

// ============================================================
// DAILY PLAN
// ============================================================
async function generateDailyPlan() {
  show('daily-task-loading');
  document.getElementById('daily-task-content').innerHTML = '';
  dis('btn-weekly-start', true);

  var dayNames = ['vasárnap','hétfő','kedd','szerda','csütörtök','péntek','szombat'];
  var today = dayNames[new Date().getDay()];
  var activeWords = oxWords.filter(function(w) { return w.s === 'active'; }).length;
  var errors = JSON.parse(localStorage.getItem('error_patterns') || '[]');
  var activeErrors = errors.filter(function(e) { return e.status === 'active'; });
  var planText = (document.getElementById('doc-plan-text') || {}).value || DOC_DEFAULTS.plan;

  try {
    var r = await claude(
      'You are a personalized English learning coach for a Hungarian B1 learner targeting C1. Generate a concrete daily study plan. Return ONLY valid JSON: {"greeting":"short motivating HU sentence","tasks":[{"time":"X perc","activity":"konkrét feladat HU","module":"Fordítás|Társalgás|Igeidők|Szótár|Anki","tip":"rövid tipp HU"}]}. Max 4 tasks. Be specific about what exactly to do.',
      'Today is ' + today + '. Active vocabulary: ' + activeWords + ' words. Active error patterns: ' + activeErrors.length + '. Weekly plan:\n' + planText.substring(0, 500)
    );
    var d = safeParseJSON(r);
    var html = '';
    if (d.greeting) html += '<div style="font-size:.88rem;color:var(--muted);margin-bottom:.8rem;font-style:italic">' + d.greeting + '</div>';
    if (d.tasks) {
      d.tasks.forEach(function(task, i) {
        var saved = JSON.parse(localStorage.getItem('daily_tasks_' + getTodayStr()) || '[]');
        var done = saved.indexOf(i) > -1;
        html += '<div class="daily-task-item">'
          + '<div class="daily-task-check' + (done ? ' done' : '') + '" onclick="toggleDailyTask(' + i + ',this)" id="dtask-' + i + '"></div>'
          + '<div class="daily-task-text">'
          + '<strong>' + task.time + '</strong> — ' + task.activity
          + '<span class="daily-task-tag">' + task.module + '</span>'
          + (task.tip ? '<div style="font-size:.78rem;color:var(--faint);margin-top:2px">' + task.tip + '</div>' : '')
          + '</div>'
          + '</div>';
      });
    }
    document.getElementById('daily-task-content').innerHTML = html;
    logSession();
    renderProgressOverview();
  } catch (e) {
    document.getElementById('daily-task-content').innerHTML = '<div class="err">Hiba: ' + e.message + '</div>';
  }
  hide('daily-task-loading');
  dis('btn-weekly-start', false);
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toggleDailyTask(idx, el) {
  var key = 'daily_tasks_' + getTodayStr();
  var saved = JSON.parse(localStorage.getItem(key) || '[]');
  var pos = saved.indexOf(idx);
  if (pos > -1) { saved.splice(pos, 1); el.classList.remove('done'); }
  else { saved.push(idx); el.classList.add('done'); }
  localStorage.setItem(key, JSON.stringify(saved));
}

// ============================================================
// HETI NAPLÓ
// ============================================================

function weeklyLogStart() {
  weeklyAnswers = [];
  weeklyQIdx = 0;
  document.getElementById('weekly-log-interview').style.display = 'block';
  document.getElementById('weekly-log-summary').style.display = 'none';
  document.getElementById('btn-weekly-start').style.display = 'none';
  renderWeeklyQuestion();
}

function renderWeeklyQuestion() {
  var wrap = document.getElementById('weekly-q-wrap');
  if (!wrap) return;
  var q = WEEKLY_QUESTIONS[weeklyQIdx];
  wrap.innerHTML = '<div class="weekly-q-box">'
    + '<div class="weekly-q-label">' + (weeklyQIdx + 1) + ' / ' + WEEKLY_QUESTIONS.length + '. kérdés</div>'
    + '<div class="weekly-q-text">' + q.q + '</div>'
    + '<textarea id="weekly-ans-input" rows="3" placeholder="Válaszolj őszintén..."></textarea>'
    + '</div>';
  var inp = document.getElementById('weekly-ans-input');
  if (inp) {
    inp.focus();
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) weeklyLogNext();
    });
  }
  var btn = document.getElementById('btn-weekly-next');
  if (btn) btn.textContent = weeklyQIdx < WEEKLY_QUESTIONS.length - 1 ? 'Következő →' : 'Összefoglalás →';
}

async function weeklyLogNext() {
  var inp = document.getElementById('weekly-ans-input');
  var ans = inp ? inp.value.trim() : '';
  weeklyAnswers.push({ q: WEEKLY_QUESTIONS[weeklyQIdx].q, a: ans });
  weeklyQIdx++;
  if (weeklyQIdx < WEEKLY_QUESTIONS.length) {
    renderWeeklyQuestion();
    return;
  }
  // Generate summary
  document.getElementById('weekly-log-interview').style.display = 'none';
  document.getElementById('weekly-log-summary').style.display = 'block';
  document.getElementById('weekly-summary-content').textContent = 'Összefoglalás generálása...';
  try {
    var qa = weeklyAnswers.map(function(w, i) { return (i+1)+'. '+w.q+'\nVálasz: '+w.a; }).join('\n\n');
    var r = await claude(
      'You are an English learning coach. Summarize this weekly learning log in Hungarian. Be encouraging but honest. Note what went well, what needs work, and give 1-2 specific suggestions for next week. Keep it concise (5-8 sentences).',
      'Weekly log:\n' + qa
    );
    document.getElementById('weekly-summary-content').textContent = r;
  } catch (e) {
    document.getElementById('weekly-summary-content').textContent = weeklyAnswers.map(function(w) { return w.q + '\n' + w.a; }).join('\n\n');
  }
}

function weeklyLogSave() {
  var summary = document.getElementById('weekly-summary-content').textContent;
  var logs = JSON.parse(localStorage.getItem('weekly_logs') || '[]');
  var now = new Date();
  logs.unshift({
    date: now.toISOString().slice(0, 10),
    week: 'W' + getWeekNumber(now),
    answers: weeklyAnswers,
    summary: summary
  });
  localStorage.setItem('weekly_logs', JSON.stringify(logs));
  // Also append to log document
  var logEl = document.getElementById('doc-log-text');
  if (logEl) {
    var entry = '\n## ' + now.toISOString().slice(0, 10) + ' — Heti összefoglaló\n\n' + summary + '\n\n';
    logEl.value = logEl.value + entry;
    docSave('log');
  }
  weeklyLogReset();
  renderWeeklyLogs();
}

function weeklyLogDiscard() { weeklyLogReset(); }

function weeklyLogReset() {
  document.getElementById('weekly-log-interview').style.display = 'none';
  document.getElementById('weekly-log-summary').style.display = 'none';
  document.getElementById('btn-weekly-start').style.display = 'inline-block';
  weeklyAnswers = []; weeklyQIdx = 0;
}

function renderWeeklyLogs() {
  var logs = JSON.parse(localStorage.getItem('weekly_logs') || '[]');
  var wrap = document.getElementById('weekly-log-list');
  if (!wrap) return;
  if (!logs.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = logs.slice(0, 5).map(function(log) {
    return '<div class="weekly-log-entry">'
      + '<div class="weekly-log-entry-date">' + log.date + ' · ' + log.week + '</div>'
      + '<div class="weekly-log-entry-summary">' + (log.summary || '').substring(0, 200) + '...</div>'
      + '</div>';
  }).join('');
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
    existing.lastSeen = new Date().toISOString().slice(0, 10);
  } else {
    patterns.push({
      id: Date.now(),
      wrong: wrong,
      right: right,
      type: type || 'grammar',
      explanation: explanation || '',
      status: 'active',
      count: 1,
      firstSeen: new Date().toISOString().slice(0, 10),
      lastSeen: new Date().toISOString().slice(0, 10)
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
  var counts=oxGetCounts();
  var sumHtml='';
  ['A1','A2','B1','B2','C1'].forEach(function(l){
    var c=counts.byLevel[l]||{new:0,'under learning':0,active:0,passive:0,total:0};
    if(!c.total) return;
    var pA=c.active/c.total,pL=(c['under learning']||0)/c.total,pP=c.passive/c.total,pN=c.new/c.total;
    var pctKnown=Math.round((c.active+c.passive)/c.total*100);
    var size=80,cx=40,cy=40,r=34,ri=20;
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
    sumHtml+='<div class="ox-pie-box"><div class="ox-pie-level">'+l+'</div><div class="ox-pie-wrap"><svg width="80" height="80" viewBox="0 0 80 80">'+svgPath+'</svg><div class="ox-pie-center">'+pctKnown+'%</div></div><div class="ox-pie-total">'+c.total+' szó</div><div class="ox-pie-mini"><span class="ox-mini-badge ox-active">A:'+c.active+'</span><span class="ox-mini-badge ox-learning">L:'+(c['under learning']||0)+'</span><span class="ox-mini-badge ox-passive">P:'+c.passive+'</span><span class="ox-mini-badge ox-new">N:'+c.new+'</span></div></div>';
  });
  var sr=document.getElementById('vocab-summary-row'); if(sr) sr.innerHTML=sumHtml;
  var barsHtml='';
  ['A1','A2','B1','B2','C1'].forEach(function(l){
    var c=counts.byLevel[l]||{new:0,'under learning':0,active:0,passive:0,total:0};
    if(!c.total) return;
    var pA=(c.active/c.total*100).toFixed(1),pL=((c['under learning']||0)/c.total*100).toFixed(1),pP=(c.passive/c.total*100).toFixed(1),pN=(c.new/c.total*100).toFixed(1);
    barsHtml+='<div class="ox-level-bar-row"><div class="ox-level-bar-label"><span><strong>'+l+'</strong> — '+c.total+' szó</span><span style="font-size:.72rem"><span style="color:var(--success)">Active: '+pA+'%</span> · <span style="color:var(--accent)">Learning: '+pL+'%</span> · <span style="color:#3b82f6">Passive: '+pP+'%</span> · <span style="color:var(--faint)">New: '+pN+'%</span></span></div><div class="ox-bar-track"><div class="ox-bar-active" style="width:'+pA+'%"></div><div class="ox-bar-learning" style="width:'+pL+'%"></div><div class="ox-bar-passive" style="width:'+pP+'%"></div><div class="ox-bar-new" style="width:'+pN+'%"></div></div></div>';
  });
  var lb=document.getElementById('vocab-level-bars'); if(lb) lb.innerHTML=barsHtml;
  var activeWords=oxWords.filter(function(w){return w.s==='active';}).length;
  var el=document.getElementById('stat-active-words'); if(el) el.textContent=activeWords||'—';
}

function initProgressPanel() {
  docLoad();
  renderProgressOverview();
  renderWeeklyLogs();
  renderErrorPatterns();
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
        throw new Error('JSON parse failed: ' + e1.message);
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
    // Oxford adatok D1-ből szinkronizált értékek betöltése a memóriába
    oxLoad();
  });
  updateHardModeBtn();
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
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-btn,.nav-dropdown-btn,.nav-sub-btn').forEach(function(b){ b.classList.remove('active'); });
  var panel = document.getElementById('panel-'+name);
  if(panel) panel.classList.add('active');
  if(el) el.classList.add('active');
  Store.set('active_main', name);
  if(name==='roadmap'){ initProgressPanel(); }
  if(name==='translate'){ renderGenTopics(); }
  if(name==='oxford'){ oxLoad(); oxPhraseLoad(); oxPage=0; renderOxWordlist(); }
  if(name==='convo'){ renderTopicPicker(); }
  if(name==='tenses'){ renderTenseSelector(); }
}

function showSub(panel, sub, el){
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
  if(panel==='translate' && sub==='text') renderGenTopics();
  if(panel==='roadmap' && sub==='overview') renderProgressOverview();
  if(panel==='roadmap' && sub==='vocab'){ oxLoad(); renderVocabDashboard(); }
  if(panel==='roadmap' && sub==='map'){ renderRoadmap(); updateRoadmapProgress(); }
  if(panel==='roadmap' && sub==='weekly') renderWeeklyLogs();
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
}

function selectLevel(level, el){
  selectedLevel = level;
  document.querySelectorAll('.lvl-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  var ll = document.getElementById('btn-level-label');
  if(ll) ll.textContent = level;
  var btn = document.getElementById('btn-tr');
  if(btn) btn.innerHTML = 'Átalakítás <span id="btn-level-label">'+level+'</span> '+(trOutLang==='en'?'EN-re':'HU-ra');
}

function setTrOutLang(lang, el){
  trOutLang = lang;
  ['tr-out-en','tr-out-hu'].forEach(function(id){
    var b = document.getElementById(id);
    if(b) b.classList.remove('active');
  });
  if(el) el.classList.add('active');
  var btn = document.getElementById('btn-tr');
  var ll = document.getElementById('btn-level-label');
  var lvl = ll ? ll.textContent : selectedLevel;
  if(btn) btn.innerHTML = 'Átalakítás <span id="btn-level-label">'+lvl+'</span> '+(lang==='en'?'EN-re':'HU-ra');
}

async function doTranslate(){
  var inp = getInputText();
  if(!inp) return;
  var lvl = selectedLevel;
  dis('btn-tr', true); show('tr-loading'); hide('tr-result');
  try{
    var sysPrompt, userPrompt;
    if(trOutLang==='en'){
      sysPrompt='You are an English teacher. The input may be Hungarian OR English. If Hungarian, translate to English. If already English, rewrite at exactly '+lvl+' CEFR level keeping ALL meaning. Output ONLY the resulting English text.';
      userPrompt='Output '+lvl+' English:\n\n'+inp;
      huText = inp;
    } else {
      sysPrompt='You are a Hungarian teacher. The input may be English OR Hungarian. If English, translate to Hungarian. If already Hungarian, rewrite at exactly '+lvl+' CEFR level keeping ALL meaning. Output ONLY the resulting Hungarian text.';
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
      'You are an English teacher for Hungarian B1 learners. The student was given a writing task and wrote an English text. ' + (typeSpecific[uzletiType]||typeSpecific['general']) + ' ALL text fields MUST be in Hungarian. Return ONLY valid JSON (no markdown, no linebreaks inside strings): {"score":1-10,"overall":"HU summary","positives":["HU"],"corrected_text":"improved version of student text","corrections":[{"type":"grammar|style|typo","wrong":"phrase","right":"fix","explanation":"HU"}]}. Include ALL errors.',
      'Task (Hungarian): "' + uzletiTask + '"\n\nStudent English text:\n"' + my + '"',
      2000
    );
    var d = safeParseJSON(r);
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

function tutorAddBubble(role, text){
  var wrap = document.getElementById('tutor-messages');
  if(!wrap) return;
  var div = document.createElement('div');
  div.className = 'tutor-bubble tutor-bubble-' + role;
  div.innerHTML = text.replace(/\n/g,'<br>');
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
  ROADMAP.forEach(function(band){ band.items.forEach(function(item){ roadmapTotal++; if(grStatuses[item.id]==='done') roadmapDone++; }); });
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
      'You are an English grammar teacher for a Hungarian B1 learner. Evaluate this sentence building exercise. Return ONLY valid JSON on a single line: {"correct":true/false,"score":1-10,"feedback":"HU explanation what is good/wrong","corrected":"the correct English sentence","errors":[{"wrong":"phrase","right":"fix","explanation":"HU"}]}.',
      'Tense: ' + bldCurrentTask.tense + '. Type: ' + bldCurrentTask.type + '.\nHungarian: "' + bldCurrentTask.hu + '"\nExpected answer: "' + bldCurrentTask.answer + '"\nStudent answer: "' + ans + '"',
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

function setGenDir(dir, el){
  genDir = dir;
  document.querySelectorAll('#gen-box-section .writing-dir-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  var label = document.getElementById('gentext-label');
  if(label) label.textContent = dir==='en' ? 'Angol szöveg generálása' : 'Magyar szöveg generálása';
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

function selectGenLevel(level, el){
  genLevel = level;
  document.querySelectorAll('.gen-lvl-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
}

async function doGenText(){
  var context = document.getElementById('gen-context').value.trim();
  dis('btn-gentext', true); show('gentext-loading');
  var topicStr = genSelectedTopic || context || (genDir==='en' ? 'business communication' : 'üzleti kommunikáció');
  var extraNote = (genSelectedTopic && context) ? ' Additional notes: '+context : '';
  try{
    var r = await claude(
      genDir==='en'
        ? 'Generate a natural English text at '+genLevel+' CEFR level. Topic: "'+topicStr+'".'+extraNote+' Length: 60-100 words. Output ONLY the English text, no title, no explanation.'
        : 'Generate a natural Hungarian text at '+genLevel+' CEFR level difficulty. Topic: "'+topicStr+'".'+extraNote+' Length: 60-100 words. Output ONLY the Hungarian text, no title, no explanation.',
      'Generate the text.'
    );
    var generated = r.trim();
    if(genDir==='en'){ trText=generated; huText=''; }
    else { huText=generated; trText=''; }
    var src = document.getElementById('writing-source');
    if(src) src.value = generated;
    var preview = document.getElementById('gen-result-preview');
    var previewText = document.getElementById('gen-result-text');
    if(preview && previewText){ previewText.textContent=generated; preview.style.display='block'; }
    var cr = document.getElementById('check-result');
    if(cr) cr.innerHTML='';
    updateWritingLabels();
  } catch(e){
    document.getElementById('gentext-loading').insertAdjacentHTML('afterend','<div class="err">Hiba: '+e.message+'</div>');
  }
  hide('gentext-loading'); dis('btn-gentext', false);
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
      'You are an English teacher for Hungarian B1 learners. ' + getWritingTypePrompt() + ' ALL text fields in Hungarian. Return ONLY a single line of valid JSON, no markdown, no newlines inside strings. Schema: {"score":0,"overall":"","positives":[],"corrected_text":"","corrections":[{"type":"grammar","wrong":"","right":"","explanation":""}]}. Fill all fields. Escape any quotes inside strings.',
      (isHuEn
        ? 'Source Hungarian text:\n"'+sourceText.substring(0,600)+'"\n\nStudent English translation:\n"'+my+'"'
        : 'Source English text:\n"'+sourceText.substring(0,600)+'"\n\nStudent Hungarian translation:\n"'+my+'"')
    );
    var d = safeParseJSON(r);
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
    // Auto-collect errors
    if(d.corrections && d.corrections.length){
      d.corrections.forEach(function(c){
        if(c.wrong && c.right) addErrorPattern(c.wrong, c.right, c.type||'grammar', c.explanation||'');
      });
    }
    // Auto-collect errors
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
    var msg=pct===100?'Kiváló!':pct>=80?'Szép munka!':pct>=60?'Jól van, de van fejlődési lehetőség.':'Olvasd el újra és próbáld újra.';
    document.getElementById('comp-result').innerHTML='<div class="comp-score-box"><div style="display:flex;align-items:baseline;gap:10px"><span class="comp-score-num">'+totalScore+'/'+compQuestions.length+'</span><span style="font-size:.9rem;color:var(--muted)">'+pct+'% — '+msg+'</span></div></div>';
  } catch(e){
    document.getElementById('comp-result').innerHTML='<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('comp-loading'); dis('btn-comp-check',false);
}

// ============================================================
// SENTENCE ANALYZER PANEL
// ============================================================
function setAnalyzerLang(lang, el){
  analyzerLang=lang;
  document.querySelectorAll('.analyzer-lang-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  analyzerDetectLang();
}

function analyzerDetectLang(){
  if(analyzerLang!=='auto') return;
  var text=document.getElementById('analyzer-input').value;
  var indicator=document.getElementById('analyzer-lang-indicator');
  if(!indicator) return;
  if(!text.trim()){ indicator.textContent=''; return; }
  indicator.textContent=detectHungarian(text)?'Magyar':'Angol';
}

function detectHungarian(text){
  return /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(text)||/\b(és|az|egy|hogy|nem|van|volt|már|még|is|de|ha|mert|csak)\b/i.test(text);
}

function clearAnalyzer(){
  document.getElementById('analyzer-input').value='';
  document.getElementById('analyze-result').innerHTML='';
  var ind=document.getElementById('analyzer-lang-indicator');
  if(ind) ind.textContent='';
}

async function doAnalyze(){
  var text=document.getElementById('analyzer-input').value.trim();
  if(!text) return;
  var isHu=analyzerLang==='hu'?true:analyzerLang==='en'?false:detectHungarian(text);
  dis('btn-analyze',true); show('analyze-loading');
  document.getElementById('analyze-result').innerHTML='';
  try{
    var r=await claude(
      'You are an English grammar teacher for a Hungarian B1 learner. Analyze the sentence. Return ONLY valid JSON: {"translation":"other language translation","source_lang":"hu/en","tense_en":"tense name","tense_hu":"HU tense name","schema":"formation pattern","explanation":"2-3 sentences HU why this tense","key_signals":"word(s) signaling this tense","biz_tip":"1 sentence HU business tip"}. No markdown.',
      (isHu?'Hungarian sentence: ':'English sentence: ')+text
    );
    var d=safeParseJSON(r);
    renderAnalyzeResult(text,d,isHu);
  } catch(e){
    document.getElementById('analyze-result').innerHTML='<div class="err">Hiba: '+e.message+'</div>';
  }
  hide('analyze-loading'); dis('btn-analyze',false);
}

function renderAnalyzeResult(original,d,isHu){
  var html='<div class="analyze-card">';
  html+='<div class="analyze-translation"><div class="analyze-translation-label">'+(isHu?'Magyar → Angol':'Angol → Magyar')+'</div>';
  html+='<div style="font-size:.88rem;color:var(--muted);margin-bottom:4px">'+original+'</div>';
  html+='<div style="font-size:1rem;font-weight:500;color:var(--text)">'+(d.translation||'')+'</div></div>';
  html+='<div class="analyze-tense-header"><span class="analyze-tense-en">'+(d.tense_en||'')+'</span><span class="analyze-tense-hu">'+(d.tense_hu||'')+'</span>';
  if(d.key_signals) html+='<span style="font-size:.78rem;padding:3px 10px;background:rgba(138,94,42,.08);color:var(--accent);border:1px solid rgba(138,94,42,.2);border-radius:99px">🔑 '+d.key_signals+'</span>';
  html+='</div>';
  if(d.schema){ html+='<div class="analyze-section"><h4>Képzési séma</h4><div class="analyze-schema">'+(d.schema||'').replace(/\n/g,'<br>')+'</div></div>'; }
  if(d.explanation){ html+='<div class="analyze-section"><h4>Miért ezt az igeidőt használja?</h4><div class="analyze-explanation">'+(d.explanation||'')+'</div></div>'; }
  if(d.biz_tip){ html+='<div class="analyze-why"><strong>Üzleti tipp:</strong> '+d.biz_tip+'</div>'; }
  html+='</div>';
  document.getElementById('analyze-result').innerHTML=html;
}

// ============================================================
// ROADMAP
// ============================================================
function renderRoadmap(){
  var container=document.getElementById('roadmap-content');
  if(!container) return;
  container.innerHTML=ROADMAP.map(function(band){
    var items=band.items.map(function(item){
      var status=grStatuses[item.id]||'todo';
      var icon=status==='done'?'✅':status==='learning'?'🔵':'⬜';
      return '<div class="grammar-box status-'+status+'" id="box-'+item.id+'" onclick="openModal(\''+item.id+'\')">'+
        '<div class="grammar-box-status">'+icon+'</div>'+
        '<div class="grammar-box-title-en">'+(item.en||item.title)+'</div>'+
        (item.en?'<div class="grammar-box-title-hu">'+item.title+'</div>':'')+
        '<div class="grammar-box-sub">'+item.sub+'</div>'+
        '</div>';
    }).join('');
    return '<div class="roadmap-band cefr-band-'+band.level.toLowerCase()+'">'+'<div class="band-label"><span class="cefr-pill">'+band.level+'</span><span class="band-sub">'+band.sub+'</span></div>'+'<div class="grammar-grid">'+items+'</div></div>';
  }).join('');
}

function updateRoadmapProgress(){
  var total=0, done=0;
  ROADMAP.forEach(function(band){ band.items.forEach(function(item){ total++; if(grStatuses[item.id]==='done') done++; }); });
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
  var status=grStatuses[id]||'todo';
  var modal=document.getElementById('gr-modal');
  var title=document.getElementById('modal-title');
  var body=document.getElementById('modal-body');
  if(!modal||!title||!body) return;
  title.textContent=(item.en||item.title)+(item.en?' — '+item.title:'');
  updateStatusBtns(status);
  var html = renderRoadmapItem(item);
  body.innerHTML = html;
  modal.style.display='flex';
}

function updateStatusBtns(status){
  document.querySelectorAll('.status-btn').forEach(function(b){ b.classList.remove('active'); });
  var id=status==='todo'?'sbtn-todo':status==='learning'?'sbtn-learning':'sbtn-done';
  var btn=document.getElementById(id);
  if(btn) btn.classList.add('active');
}

function setGrStatus(status){
  if(!currentModalId) return;
  grStatuses[currentModalId]=status;
  localStorage.setItem('gr_statuses',JSON.stringify(grStatuses));
  updateStatusBtns(status);
  var box=document.getElementById('box-'+currentModalId);
  if(box){
    box.className='grammar-box status-'+status;
    var icon=box.querySelector('.grammar-box-status');
    if(icon) icon.textContent=status==='done'?'✅':status==='learning'?'🔵':'⬜';
  }
  updateRoadmapProgress();
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
      var history = getExerciseHistory(item.id);
      var statusIcon = history.sessions===0?'':history.avgPct>=85?' ✅':history.avgPct>=60?' 🔵':' 🟡';
      var badge = history.sessions>0?'<div class="tc-badge">'+history.sessions+'× · '+history.avgPct+'%</div>':'';
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
}

function getExerciseHistory(roadmapId){
  var history = JSON.parse(localStorage.getItem('ex_history') || '[]');
  var sessions = history.filter(function(h){ return h.roadmapId === roadmapId; });
  if(!sessions.length) return {sessions:0, avgPct:0, lastPct:0};
  var avg = Math.round(sessions.reduce(function(s,h){ return s + h.pct; }, 0) / sessions.length);
  return {sessions:sessions.length, avgPct:avg, lastPct:sessions[sessions.length-1].pct};
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
  updateRoadmapFromExercise(roadmapId, correct, total);
}

function updateRoadmapFromExercise(roadmapId, correct, total){
  if(!total) return;
  var pct = Math.round(correct/total*100);
  var history = JSON.parse(localStorage.getItem('ex_history') || '[]');
  var sessions = history.filter(function(h){ return h.roadmapId === roadmapId; });
  var current = grStatuses[roadmapId] || 'todo';
  // 1 session 60%+ → learning
  if(current === 'todo' && pct >= 60){
    grStatuses[roadmapId] = 'learning';
    localStorage.setItem('gr_statuses', JSON.stringify(grStatuses));
    showToast('🔵 '+roadmapId.replace(/_/g,' ')+' → Tanulás alatt');
  }
  // 3 session 80%+ → done
  var goodSessions = sessions.filter(function(h){ return h.pct >= 80; }).length;
  if(goodSessions >= 3){
    grStatuses[roadmapId] = 'done';
    localStorage.setItem('gr_statuses', JSON.stringify(grStatuses));
    showToast('✅ '+roadmapId.replace(/_/g,' ')+' → Teljesítve!');
  }
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
}

function selectAllTenses(){
  Object.keys(GRAMMAR_EXERCISES).forEach(function(id){
    selectedTenses.add(id);
    var el=document.getElementById('tc-'+id);
    if(el) el.classList.add('selected');
  });
}

function deselectAllTenses(){
  Object.keys(GRAMMAR_EXERCISES).forEach(function(id){
    selectedTenses.delete(id);
    var el=document.getElementById('tc-'+id);
    if(el) el.classList.remove('selected');
  });
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

  // Nehéz módban: kinyitható hint (fill + transform típusoknál)
  if(hardMode && (type === 'fill' || type === 'transform')){
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

function showGrAnswer(){
  var item = grExState.queue[grExState.idx];
  var rid3 = grExState.queue[grExState.idx].roadmapId;
  if(!grExState.perItem[rid3]) grExState.perItem[rid3] = {correct:0, total:0};
  grExState.perItem[rid3].total++;
  grExState.score.total++;
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

  // Save exact history per roadmap item
  Object.keys(grExState.perItem).forEach(function(rid){
    var c = grExState.perItem[rid];
    if(c.total > 0) saveExerciseHistory(rid, c.correct, c.total);
  });

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
  convoSystemPrompt='You are a friendly encouraging conversation partner helping a Hungarian '+convoLevel+' English learner practice. Topic: "'+fullTopic+'". Rules: 2-3 sentences max per reply, natural '+convoLevel+' level English, ask a follow-up question, stay on topic. Start with a warm natural opening.';
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
    var r=await claude('Grammar checker. Check this English text for errors. Return ONLY JSON: {"errors":[{"wrong":"exact phrase","right":"corrected","type":"grammar|typo|style","explanation":"brief HU explanation"}]}. If no errors return {"errors":[]}. Max 3 most important errors.','Check: "'+text+'"',400);
    return safeParseJSON(r);
  } catch(e){ return null; }
}

function convoToggleTTS(){
  convoTTSEnabled=!convoTTSEnabled;
  var btn=document.getElementById('convo-tts-btn');
  if(btn) btn.classList.toggle('active',convoTTSEnabled);
  if(!convoTTSEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
}

function convoSpeak(text){
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var utt=new SpeechSynthesisUtterance(text);
  utt.lang='en-US'; utt.rate=0.9; utt.pitch=1;
  var voices=window.speechSynthesis.getVoices();
  var enVoice=voices.find(function(v){ return v.lang==='en-US'&&v.name.indexOf('Natural')>-1; })||voices.find(function(v){ return v.lang==='en-US'; });
  if(enVoice) utt.voice=enVoice;
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

function renderOxDashboard(){
  if(!oxWords.length){ document.getElementById('ox-no-data').style.display='block'; document.getElementById('ox-dashboard-content').style.display='none'; return; }
  document.getElementById('ox-no-data').style.display='none'; document.getElementById('ox-dashboard-content').style.display='block';
  var counts=oxGetCounts();
  var sumHtml='';
  ['A1','A2','B1','B2','C1'].forEach(function(l){
    var c=counts.byLevel[l]||{new:0,'under learning':0,active:0,passive:0,total:0};
    if(!c.total) return;
    var pA=c.active/c.total, pL=(c['under learning']||0)/c.total, pP=c.passive/c.total, pN=c.new/c.total;
    var pctKnown=Math.round((c.active+c.passive)/c.total*100);
    var size=80, cx=size/2, cy=size/2, r=34, ri=20;
    var segments=[{val:pA,color:'#22c55e'},{val:pL,color:'#f59e0b'},{val:pP,color:'#3b82f6'},{val:pN,color:'#e2e8f0'}];
    var svgPath='', angle=-Math.PI/2;
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
    sumHtml+='<div class="ox-pie-box"><div class="ox-pie-level">'+l+'</div><div class="ox-pie-wrap"><svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+svgPath+'</svg><div class="ox-pie-center">'+pctKnown+'%</div></div><div class="ox-pie-total">'+c.total+' szó</div><div class="ox-pie-mini"><span class="ox-mini-badge ox-active">A:'+c.active+'</span><span class="ox-mini-badge ox-learning">L:'+(c['under learning']||0)+'</span><span class="ox-mini-badge ox-passive">P:'+c.passive+'</span><span class="ox-mini-badge ox-new">N:'+c.new+'</span></div></div>';
  });
  document.getElementById('ox-summary-row').innerHTML=sumHtml;
  var barsHtml='';
  ['A1','A2','B1','B2','C1'].forEach(function(l){
    var c=counts.byLevel[l]||{new:0,'under learning':0,active:0,passive:0,total:0};
    if(!c.total) return;
    var pA=(c.active/c.total*100).toFixed(1),pP=(c.passive/c.total*100).toFixed(1),pL=((c['under learning']||0)/c.total*100).toFixed(1),pN=(c.new/c.total*100).toFixed(1);
    barsHtml+='<div class="ox-level-bar-row"><div class="ox-level-bar-label"><span><strong>'+l+'</strong> — '+c.total+' szó</span><span style="font-size:.72rem"><span style="color:var(--success)">Active: '+pA+'%</span> · <span style="color:var(--accent)">Learning: '+pL+'%</span> · <span style="color:var(--accent3)">Passive: '+pP+'%</span> · <span style="color:var(--faint)">New: '+pN+'%</span></span></div><div class="ox-bar-track"><div class="ox-bar-active" style="width:'+pA+'%"></div><div class="ox-bar-learning" style="width:'+pL+'%"></div><div class="ox-bar-passive" style="width:'+pP+'%"></div><div class="ox-bar-new" style="width:'+pN+'%"></div></div></div>';
  });
  document.getElementById('ox-level-bars').innerHTML=barsHtml;
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
    result.innerHTML='<div class="ok-box">Szinkronizáció kész! '+updated+' státusz frissítve, '+unchanged+' változatlan, '+notFound+' Oxford szó nincs még Ankiban.</div>';
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
    renderOxDashboard();
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
  localStorage.removeItem('anki_cards'); allCards=[];
  renderOxDashboard();
}

function toggleBackup(){
  var section=document.getElementById('backup-section');
  var arrow=document.getElementById('backup-arrow');
  if(section){ section.style.display=section.style.display==='none'?'block':'none'; }
  if(arrow){ arrow.style.transform=section&&section.style.display==='block'?'rotate(180deg)':''; }
}

// CARDS
function saveCards(){ localStorage.setItem('anki_cards',JSON.stringify(allCards)); }


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


