/* ליגת המספרים — לוגיקה ומסכים. Logic = פונקציות טהורות (נבדקות ב-node), App = ממשק. */
(function (root) {
'use strict';
var D = root.FOOTBALL_DATA;
var KEY = 'ligat-hamisparim-v1';
// חוק הפרסים של יהב, במיליונים: חיבור 5, חיסור 10, אנגלית 15, כפל 30, חילוק 50, טעות 2. סיום משחק 50 + חפיסה.
var REWARD = { add: 5, sub: 10, spell: 15, mul: 30, div: 50, chain: 50, miss: 2, finish: 50, pack: 100 };
var RARITY = { add: ['נדיר', 'rare'], sub: ['סופר-נדיר', 'sr'], spell: ['אפי', 'epic'], mul: ['אגדי', 'leg'], div: ['אולטרה אגדי', 'ultra'], chain: ['אולטרה אגדי', 'ultra'] };
var LEVELS = {
  1: { add: 20, sub: 20, mul: [6, 6],   div: [6, 6],   chain: false, blanks: 1 },
  2: { add: 50, sub: 50, mul: [10, 10], div: [10, 10], chain: false, blanks: 2 },
  3: { add: 99, sub: 99, mul: [12, 30], div: [12, 30], chain: true,  blanks: 'all' }
};
var DEFAULT = {
  name: 'יהב', coins: 0, level: 2, ops: { add: true, sub: true, mul: true, div: true }, speech: true, voice: '', perMatch: 10,
  album: {}, trophies: {}, seen: {}, stats: { matches: 0, correct: 0, wrong: 0, earned: 0, teams: {} }, last: { comp: 'ucl', team: 'realmadrid', mode: 'mix' }
};

function rnd(n) { return Math.floor(Math.random() * n); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pick(a) { return a[rnd(a.length)]; }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

var Logic = {
  REWARD: REWARD, LEVELS: LEVELS,
  // "Mbappé" -> "Mbappe", "Ødegaard" -> "Odegaard"
  strip: function (s) {
    var map = { 'ø': 'o', 'Ø': 'O', 'ß': 'ss', 'ı': 'i', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'æ': 'ae', 'Æ': 'Ae', 'ð': 'd', 'þ': 'th' };
    s = s.replace(/[øØßıłŁđĐæÆðþ]/g, function (c) { return map[c]; });
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  },
  roster: function (teamId) {
    var out = [];
    for (var i = 0; i < D.players.length; i++) {
      var p = D.players[i], num = 0;
      if (p[2] === teamId && p[3] > 0) num = p[3];
      else if (p[4] === teamId && p[5] > 0) num = p[5];
      if (num) out.push({ en: p[0], he: p[1], num: num, team: teamId });
    }
    return out;
  },
  // המילה לכתיב: שם המשפחה; אם קצר מ-4 אותיות — כל השם
  spellWord: function (en) {
    var parts = Logic.strip(en).split(' ');
    var w = parts[parts.length - 1];
    if (w.replace(/[^A-Za-z]/g, '').length < 4) w = parts.join('');
    return w;
  },
  isLetter: function (c) { return /[A-Za-z]/.test(c); },
  distractors: function (letter, n) {
    var L = letter.toLowerCase();
    var vowels = 'aeiouy', groups = ['bpd', 'cks', 'gjq', 'mn', 'vwf', 'lr', 'tdh', 'szx'];
    var pool = '';
    if (vowels.indexOf(L) >= 0) pool = vowels;
    else for (var i = 0; i < groups.length; i++) if (groups[i].indexOf(L) >= 0) pool = groups[i];
    pool = pool.replace(L, '');
    var all = 'abcdefghijklmnopqrstuvwxyz'.replace(L, '');
    var out = [];
    var cand = shuffle(pool.split('')).concat(shuffle(all.split('')));
    for (var j = 0; j < cand.length && out.length < n; j++) if (out.indexOf(cand[j]) < 0) out.push(cand[j]);
    var upper = letter === letter.toUpperCase();
    return out.map(function (c) { return upper ? c.toUpperCase() : c; });
  },
  // בוחר שחקנים עם מספר <= max; אם אין מספיק — לוקח את הקטנים ביותר
  candidates: function (roster, max, exclude) {
    var c = roster.filter(function (p) { return p.num <= max && exclude.indexOf(p) < 0; });
    if (c.length) return c;
    return roster.filter(function (p) { return exclude.indexOf(p) < 0; }).sort(function (a, b) { return a.num - b.num; }).slice(0, 3);
  },
  genMath: function (roster, level, ops) {
    var L = LEVELS[level] || LEVELS[2];
    var enabled = Object.keys(ops).filter(function (k) { return ops[k]; });
    if (!enabled.length) enabled = ['add'];
    var op = pick(enabled);
    if (L.chain && ops.mul && ops.add && Math.random() < 0.2) op = 'chain';
    var q = { type: 'math', op: op, reward: REWARD[op] };
    var a, b, c;
    if (op === 'add' || op === 'sub') {
      a = pick(Logic.candidates(roster, L[op], []));
      b = pick(Logic.candidates(roster, L[op], [a]));
      if (op === 'sub' && b.num > a.num) { c = a; a = b; b = c; }
      q.players = [a, b]; q.text = a.num + (op === 'add' ? ' + ' : ' − ') + b.num;
      q.answer = op === 'add' ? a.num + b.num : a.num - b.num;
    } else if (op === 'mul') {
      a = pick(Logic.candidates(roster, L.mul[0], []));
      b = pick(Logic.candidates(roster, L.mul[1], [a]));
      if (Math.random() < 0.5) { c = a; a = b; b = c; }
      q.players = [a, b]; q.text = a.num + ' × ' + b.num; q.answer = a.num * b.num;
    } else if (op === 'div') {
      // השחקן המסתורי: מכפלה ÷ מחלק = מספר השחקן הנסתר
      var d = pick(Logic.candidates(roster, L.div[0], []));
      var hidden = pick(Logic.candidates(roster, L.div[1], [d]));
      q.players = [d, hidden]; q.hidden = hidden; q.product = d.num * hidden.num;
      q.text = q.product + ' ÷ ' + d.num; q.answer = hidden.num;
    } else { // chain: a + b × c
      a = pick(Logic.candidates(roster, 50, []));
      b = pick(Logic.candidates(roster, 10, [a]));
      c = pick(Logic.candidates(roster, 10, [a, b]));
      q.players = [a, b, c]; q.text = a.num + ' + ' + b.num + ' × ' + c.num; q.answer = a.num + b.num * c.num;
    }
    return q;
  },
  genSpell: function (roster, level) {
    var L = LEVELS[level] || LEVELS[2];
    var p = pick(roster);
    var word = Logic.spellWord(p.en);
    var letterIdx = [];
    for (var i = 1; i < word.length; i++) if (Logic.isLetter(word[i])) letterIdx.push(i);
    var blanks;
    if (L.blanks === 'all') blanks = letterIdx;
    else blanks = shuffle(letterIdx).slice(0, Math.min(L.blanks, letterIdx.length)).sort(function (x, y) { return x - y; });
    var options = blanks.map(function (idx) { return shuffle([word[idx]].concat(Logic.distractors(word[idx], 3))); });
    return { type: 'spell', op: 'spell', reward: REWARD.spell, player: p, word: word, blanks: blanks, options: options, typed: L.blanks === 'all', answer: word };
  },
  // תוכנית משחק: רשימת סוגי שאלות
  plan: function (mode, n) {
    var out = [];
    if (mode === 'math') for (var i = 0; i < n; i++) out.push('math');
    else if (mode === 'spell') for (var j = 0; j < n; j++) out.push('spell');
    else { var m = Math.ceil(n * 0.6); for (var k = 0; k < n; k++) out.push(k < m ? 'math' : 'spell'); out = shuffle(out); }
    return out;
  },
  fmt: function (m) {
    if (m >= 1000) { var b = m / 1000; return (Math.round(b * 10) / 10).toString().replace(/\.0$/, '') + ' מיליארד'; }
    return m + ' מיליון';
  }
};

root.Logic = Logic;
if (typeof document === 'undefined') return; // node tests

/* ---------------- App ---------------- */
var S, V = { screen: 'home' }, M = null; // S=saved state, V=view state, M=current match
function deepMerge(a, b) { for (var k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = deepMerge(a[k] || {}, b[k]); } else a[k] = b[k]; } return a; }
function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) return deepMerge(JSON.parse(JSON.stringify(DEFAULT)), s); } catch (e) { } return JSON.parse(JSON.stringify(DEFAULT)); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

/* ----- speech (en-GB) ----- */
var voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
function britishVoice() {
  if (S.voice) { for (var i = 0; i < voices.length; i++) if (voices[i].name === S.voice) return voices[i]; }
  var pref = ['Daniel', 'Google UK English Male', 'Google UK English Female', 'Kate', 'Serena', 'Arthur', 'Martha', 'Oliver'];
  for (var p = 0; p < pref.length; p++) for (var j = 0; j < voices.length; j++) if (voices[j].name.indexOf(pref[p]) === 0 && /en[-_]GB/i.test(voices[j].lang)) return voices[j];
  for (var k = 0; k < voices.length; k++) if (/en[-_]GB/i.test(voices[k].lang)) return voices[k];
  for (var m = 0; m < voices.length; m++) if (/^en/i.test(voices[m].lang)) return voices[m];
  return null;
}
function speak(text, opts) {
  opts = opts || {};
  if (!S.speech || !('speechSynthesis' in root)) return;
  try {
    if (!opts.queue) speechSynthesis.cancel();
    if (!voices.length) loadVoices();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; u.rate = opts.rate || 0.85; u.pitch = opts.pitch || 1;
    var v = britishVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { }
}
// קריאת גול במבטא בריטי אחרי תשובה נכונה
var GOAL_CALLS = ['Goooooal!', 'Gooooal! What a strike!', 'Goooal! Brilliant!', 'Goooooal! Top corner!', 'Gooooal! Unbelievable!'];
function speakGoal() { speak(pick(GOAL_CALLS), { rate: 0.95, pitch: 1.15 }); }
if ('speechSynthesis' in root) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

/* ----- Hebrew narration (he-IL) ----- */
function speakHe(text) {
  if (!S.speech || !('speechSynthesis' in root)) return;
  try {
    speechSynthesis.cancel();
    if (!voices.length) loadVoices();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL'; u.rate = 0.9;
    var v = null;
    for (var i = 0; i < voices.length; i++) if (/^he/i.test(voices[i].lang)) { v = voices[i]; break; }
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { }
}
function heNum(n) { return String(n); }
function balls(n, cls) { var o = ''; for (var i = 0; i < n; i++) o += '<i' + (cls ? ' class="' + cls + '"' : '') + '>⚽</i>'; return o; }

/* ----- הסברים: דוגמה קבועה לכל סוג שאלה ----- */
var EXPLAIN = {
  add: function () {
    return { title: '➕ חיבור: 5 + 7', say: '5 ועוד 7. מתחילים מהמספר הגדול, 7, ומוסיפים 5 בספירה: 8, 9, 10, 11, 12. אז 5 ועוד 7 שווה 12.',
      html: '<div class="ex-row"><span class="ex-grp">' + balls(7) + '</span><span class="ex-op">+</span><span class="ex-grp">' + balls(5, 'alt') + '</span></div><p>מתחילים מהגדול: <b>7</b> ← 8, 9, 10, 11, <b>12</b></p><div class="ex-res">5 + 7 = 12</div>' };
  },
  sub: function () {
    return { title: '➖ חיסור: 12 − 5', say: '12 פחות 5. יש לנו 12 כדורים, ומורידים 5. סופרים אחורה מ-12: 11, 10, 9, 8, 7. נשארו 7. אז 12 פחות 5 שווה 7.',
      html: '<div class="ex-row"><span class="ex-grp">' + balls(7) + balls(5, 'out') + '</span></div><p>סופרים אחורה מ-<b>12</b>: 11, 10, 9, 8, <b>7</b></p><div class="ex-res">12 − 5 = 7</div>' };
  },
  mul: function () {
    return { title: '✖️ כפל: 3 × 8', say: '3 כפול 8. זה אומר: 8, שלוש פעמים. 8 ועוד 8 זה 16. ועוד 8 זה 24. אז 3 כפול 8 שווה 24. אפשר גם למצוא בלוח הכפל: שורה 3, עמודה 8.',
      html: '<div class="ex-rows"><div>' + balls(8) + '<b>8</b></div><div>' + balls(8) + '<b>16</b></div><div>' + balls(8) + '<b>24</b></div></div><p>3 שורות של 8: &nbsp;8 → 16 → 24</p><div class="ex-res">3 × 8 = 24</div><p class="muted">בלוח הכפל: שורה 3, עמודה 8 📐</p>' };
  },
  div: function () {
    return { title: '➗ חילוק: 24 ÷ 8', say: '24 חלקי 8. חילוק זה ההפך של כפל. שואלים: איזה מספר כפול 8 נותן 24? הולכים בלוח הכפל בשורה של 8: 8, 16, 24. הגענו ל-24 אחרי 3 צעדים. אז 24 חלקי 8 שווה 3. בדיקה: 3 כפול 8 זה 24.',
      html: '<p>24 כדורים, מחלקים לקבוצות של 8. כמה קבוצות?</p><div class="ex-rows"><div>' + balls(8) + '<b>1</b></div><div>' + balls(8) + '<b>2</b></div><div>' + balls(8) + '<b>3</b></div></div><p>בשורה של 8 בלוח הכפל: 8 → 16 → <b>24</b> = 3 צעדים</p><div class="ex-res">24 ÷ 8 = 3</div><p class="muted">בדיקה: 3 × 8 = 24 ✔</p>' };
  },
  chain: function () {
    return { title: '🧠 סדר פעולות: 2 + 3 × 4', say: '2 ועוד 3 כפול 4. קודם כפל, אחר כך חיבור. 3 כפול 4 זה 12. ואז 2 ועוד 12 זה 14. אז התשובה 14.',
      html: '<p>קודם <b>כפל</b>, אחר כך <b>חיבור</b>:</p><div class="ex-res" style="font-size:28px">2 + <span class="hl">3 × 4</span> = 2 + <span class="hl">12</span> = 14</div>' };
  },
  spell: function () {
    return { title: '🔤 כתיב באנגלית', say: 'מקשיבים לשם של השחקן, מסתכלים על האותיות, ובוחרים את האות שחסרה. אפשר ללחוץ על הרמקול כדי לשמוע שוב.',
      html: '<div class="word center" style="font-size:34px">Haal<span class="blank cur"></span>nd</div><p>שומעים: <b>Haaland</b> → חסרה האות <b style="direction:ltr;display:inline-block">a</b></p><p class="muted">🔊 = לשמוע שוב</p>' };
  }
};
function renderExplain() {
  var op = V.explain, e = EXPLAIN[op]();
  var showTable = (op === 'mul' || op === 'div' || op === 'chain');
  return '<div class="fb"><div class="box ex">' +
    '<h2 style="color:var(--gold)">' + e.title + '</h2>' + e.html +
    '<div class="row" style="justify-content:center;margin-top:10px"><button class="small gray" data-a="sayExplain">🔊 שוב</button>' +
    (showTable ? '<button class="small p" data-a="openTable">📐 לוח כפל</button>' : '') + '</div>' +
    '<button class="big g" style="margin-top:10px" data-a="closeExplain">הבנתי, קדימה! ⚽</button></div></div>';
}
/* ----- לוח כפל ----- */
function renderTable(overlay) {
  var T = V.table || {}; var r = T.row || 0, c = T.col || 0;
  var h = '<div class="mt"><table><tr><th>×</th>';
  for (var j = 1; j <= 10; j++) h += '<th class="' + (j === c ? 'hc' : '') + '">' + j + '</th>';
  h += '</tr>';
  for (var i = 1; i <= 10; i++) {
    h += '<tr><th class="' + (i === r ? 'hr' : '') + '">' + i + '</th>';
    for (var k = 1; k <= 10; k++) {
      var cls = (i === r && k === c && !T.hint) ? 'hit' : (i === r || k === c) ? 'hl' : '';
      h += '<td class="' + cls + '" data-a="cell" data-v="' + i + ',' + k + '">' + (i * k) + '</td>';
    }
    h += '</tr>';
  }
  h += '</table></div>';
  var cap = T.hint ? '<p class="center">' + (c ? 'מצאו את המפגש של שורה <b>' + r + '</b> ועמודה <b>' + c + '</b>' : 'חפשו את <b>' + (M && M.q.product) + '</b> בשורה של <b>' + r + '</b>. באיזו עמודה הוא?') + '</p>' : r && c ? '<div class="ex-res">' + r + ' × ' + c + ' = ' + (r * c) + '</div>' : '<p class="center muted">לחצו על מספר בלוח ותשמעו את התרגיל. שורה × עמודה.</p>';
  if (overlay) return '<div class="fb"><div class="box" style="max-width:520px"><h2 style="color:var(--gold);margin:0 0 6px">📐 לוח הכפל</h2>' + h + cap + '<button class="big g" style="margin-top:8px" data-a="closeTable">חזרה לשאלה ▶</button></div></div>';
  return h + cap;
}

/* ----- helpers ----- */
function team(id) { return D.teams[id]; }
function jersey(teamId, num, cls) {
  var t = team(teamId);
  var txt = String(num), fs = txt.length > 4 ? 20 : txt.length > 2 ? 28 : 38;
  return '<svg class="jersey ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true">' +
    '<path d="M30 8 L42 4 Q50 14 58 4 L70 8 L92 24 L82 40 L72 34 L72 94 L28 94 L28 34 L18 40 L8 24 Z" fill="' + t.c1 + '" stroke="rgba(0,0,0,.4)" stroke-width="3" stroke-linejoin="round"/>' +
    '<text x="50" y="70" text-anchor="middle" font-size="' + fs + '" fill="' + t.c2 + '" font-weight="bold">' + esc(txt) + '</text></svg>';
}
function pcard(p, hidden) {
  return '<div class="pcard' + (hidden ? ' mystery' : '') + '">' + jersey(p.team, hidden ? '?' : p.num) +
    '<div class="he">' + (hidden ? 'שחקן מסתורי' : esc(p.he)) + '</div><div class="en">' + (hidden ? '???' : esc(p.en)) + '</div></div>';
}
function coinsPill() { return '<span class="pill">🪙 <b>' + Logic.fmt(S.coins) + '</b></span>'; }
function topbar(backAct, title) {
  return '<div class="topbar">' + (backAct ? '<button class="small gray" data-a="' + backAct + '">◀ חזרה</button>' : '<span></span>') +
    (title ? '<h2 style="margin:0">' + title + '</h2>' : '') + coinsPill() + '</div>';
}
function albumCount(teamId) { return (S.album[teamId] || []).length; }
function compsOf(teamId) { return D.competitions.filter(function (c) { return c.teams.indexOf(teamId) >= 0; }); }

/* ----- screens ----- */
function render() {
  var app = document.getElementById('app');
  var fn = screens[V.screen] || screens.home;
  app.innerHTML = fn();
  root.scrollTo(0, 0);
}
var screens = {
  home: function () {
    var tro = Object.keys(S.trophies).length;
    var last = team(S.last.team);
    return '<div class="topbar"><span class="pill">👋 ' + esc(S.name) + '</span>' + coinsPill() + '</div>' +
      '<div class="hero"><div class="ball">⚽</div><h1>ליגת המספרים</h1><h3>חידון כדורגלנים: חשבון + אנגלית</h3></div>' +
      '<button class="big y" data-a="goComp">⚽ משחק חדש</button>' +
      (last ? '<button class="full gray" style="margin-top:10px" data-a="pickTeam" data-v="' + S.last.team + '">▶ להמשיך עם ' + team(S.last.team).flag + ' ' + esc(last.name) + '</button>' : '') +
      '<div class="grid2" style="margin-top:14px">' +
      '<button class="tile" data-a="goAlbum"><span class="ic">📒</span><span class="nm">אלבום מדבקות</span><span class="sub">' + totalStickers() + ' / ' + D.players.length + '</span></button>' +
      '<button class="tile" data-a="goStats"><span class="ic">🏆</span><span class="nm">גביעים</span><span class="sub">' + tro + ' קבוצות הושלמו</span></button>' +
      '<button class="tile" data-a="openTable"><span class="ic">📐</span><span class="nm">לוח הכפל</span><span class="sub">מדבר!</span></button>' +
      '<button class="tile" data-a="resetSeen"><span class="ic">🎓</span><span class="nm">הסברים</span><span class="sub">' + (Object.keys(S.seen).length ? 'להראות שוב' : 'יופיעו במשחק') + '</span></button>' +
      '</div>' +
      '<div class="row sp" style="margin-top:14px"><button class="small gray" data-a="goSettings">⚙️ הגדרות</button>' +
      '<span class="muted" style="font-size:14px">' + S.stats.matches + ' משחקים · ' + S.stats.correct + ' גולים</span></div>';
  },
  comp: function () {
    return topbar('goHome', 'בחר תחרות') +
      '<div class="grid2">' + D.competitions.map(function (c) {
        return '<button class="tile" data-a="pickComp" data-v="' + c.id + '"><span class="ic">' + c.icon + '</span><span class="nm">' + esc(c.name) + '</span><span class="sub">' + c.teams.length + ' קבוצות</span></button>';
      }).join('') + '</div>';
  },
  team: function () {
    var c = D.competitions.filter(function (x) { return x.id === V.comp; })[0] || D.competitions[0];
    return topbar('goComp', c.icon + ' ' + esc(c.name)) +
      '<div class="grid3">' + c.teams.map(function (id) {
        var t = team(id), n = Logic.roster(id).length, done = S.trophies[id];
        return '<button class="tile' + (done ? ' done' : '') + '" data-a="pickTeam" data-v="' + id + '">' + jersey(id, done ? '🏆' : t.flag, 'sm') +
          '<span class="nm" style="font-size:16px">' + esc(t.name) + '</span><span class="cnt">' + albumCount(id) + '/' + n + '</span></button>';
      }).join('') + '</div>';
  },
  pre: function () {
    var id = V.team, t = team(id), r = Logic.roster(id);
    var st = S.stats.teams[id] || { matches: 0, best: 0 };
    return topbar('goTeamList', t.flag + ' ' + esc(t.name)) +
      '<div class="card center">' + jersey(id, r.length, 'lg') + '<p class="muted">' + r.length + ' שחקנים במאגר · ' + st.matches + ' משחקים · שיא ' + st.best + '/' + S.perMatch + '</p>' +
      '<div class="players" style="gap:6px">' + shuffle(r).slice(0, 6).map(function (p) { return '<span class="pill" style="font-size:14px">' + esc(p.he) + ' <b>' + p.num + '</b></span>'; }).join('') + '</div></div>' +
      '<h3 class="center">מה משחקים?</h3>' +
      '<div class="mix">' +
      '<button class="tile" data-a="start" data-v="math"><span class="ic">🧮</span><span class="nm">חשבון</span></button>' +
      '<button class="tile" data-a="start" data-v="spell"><span class="ic">🔤</span><span class="nm">אנגלית</span></button>' +
      '<button class="tile" data-a="start" data-v="mix"><span class="ic">🔀</span><span class="nm">מעורב</span></button>' +
      '</div>' +
      '<div class="card flat"><div class="row sp"><span>רמה</span><div class="seg grow">' + [1, 2, 3].map(function (l) { return '<button class="' + (S.level === l ? 'on' : '') + '" data-a="setLevel" data-v="' + l + '">' + '⭐'.repeat(l) + '</button>'; }).join('') + '</div></div>' +
      '<p class="muted" style="font-size:14px;margin-top:8px">' + levelDesc(S.level) + '</p></div>' +
      '<div class="row sp"><button class="small gray" data-a="goAlbumTeam" data-v="' + id + '">📒 מדבקות הקבוצה (' + albumCount(id) + '/' + r.length + ')</button></div>';
  },
  play: function () {
    var q = M.q, i = M.i, n = M.plan.length;
    var pct = Math.round(i / n * 100);
    var head = '<div class="topbar"><button class="small gray" data-a="quit">✖</button><span class="pill">שאלה <b>' + (i + 1) + '</b>/' + n + '</span>' + coinsPill() + '</div>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div>';
    var body;
    if (q.type === 'math') body = renderMath(q);
    else body = renderSpell(q);
    return head + body + (M.fb ? renderFeedback() : V.explain ? renderExplain() : V.table && V.table.open ? renderTable(true) : '');
  },
  end: function () {
    var t = team(M.team), n = M.plan.length;
    var pack = M.pack || [];
    var trophy = S.trophies[M.team] && M.newTrophy;
    return '<div class="topbar"><span></span><h2 style="margin:0">סיום המשחק!</h2>' + coinsPill() + '</div>' +
      '<div class="card center">' + jersey(M.team, M.correct + '/' + n, 'lg') +
      '<h2>' + (M.correct === n ? '🏅 משחק מושלם!' : M.correct >= n * 0.7 ? '🔥 ניצחון גדול!' : '💪 כל הכבוד על המאמץ!') + '</h2>' +
      '<p>' + M.correct + ' גולים מתוך ' + n + ' · ' + t.flag + ' ' + esc(t.name) + '</p>' +
      '<div class="reward">🪙 הרווחת ' + Logic.fmt(M.earned) + '</div>' +
      '<div class="reward" style="color:var(--green)">🎁 בונוס סיום: +' + Logic.fmt(REWARD.finish) + '!</div>' +
      (trophy ? '<div class="badge ultra" style="font-size:18px;padding:8px 14px;margin-top:6px">🏆 האלבום של ' + esc(t.name) + ' הושלם! גביע חדש!</div>' : '') +
      '</div>' +
      '<div class="card"><h3 class="center" style="color:var(--gold)">🎴 חפיסת מדבקות חינם!</h3>' +
      (pack.length ? '<div class="stickers">' + pack.map(function (p) { return stickerHtml(p, true, true); }).join('') + '</div>' : '<p class="center muted">כל המדבקות של הקבוצה כבר אצלך! קיבלת 20 מיליון במקום.</p>') +
      '</div>' +
      '<button class="big y" data-a="start" data-v="' + M.mode + '">🔁 עוד משחק</button>' +
      '<div class="grid2" style="margin-top:10px"><button class="gray" data-a="goComp">⚽ קבוצה אחרת</button><button class="p" data-a="goAlbumTeam" data-v="' + M.team + '">📒 לאלבום</button></div>' +
      '<div class="center" style="margin-top:10px"><button class="small gray" data-a="goHome">🏠 בית</button></div>';
  },
  album: function () {
    var ids = Object.keys(D.teams);
    return topbar('goHome', '📒 אלבום') +
      '<p class="center muted">כל משחק = חפיסה חינם. חפיסה נוספת עולה ' + Logic.fmt(REWARD.pack) + '.</p>' +
      '<div class="grid3">' + ids.map(function (id) {
        var t = team(id), n = Logic.roster(id).length, have = albumCount(id);
        return '<button class="tile' + (S.trophies[id] ? ' done' : '') + '" data-a="goAlbumTeam" data-v="' + id + '">' + jersey(id, have + '/' + n, 'sm') + '<span class="nm" style="font-size:15px">' + esc(t.name) + '</span></button>';
      }).join('') + '</div>';
  },
  albumTeam: function () {
    var id = V.team, t = team(id), r = Logic.roster(id).sort(function (a, b) { return a.num - b.num; });
    var have = S.album[id] || [];
    var full = have.length >= r.length;
    return topbar('goAlbum', t.flag + ' ' + esc(t.name)) +
      '<div class="row sp"><span class="pill">מדבקות <b>' + have.length + '</b>/' + r.length + '</span>' +
      (full ? '<span class="badge">🏆 אלבום מלא!</span>' : '<button class="small y" data-a="buyPack" data-v="' + id + '"' + (S.coins < REWARD.pack ? ' disabled' : '') + '>🎴 חפיסה (' + Logic.fmt(REWARD.pack) + ')</button>') + '</div>' +
      (S.coins < REWARD.pack && !full ? '<p class="muted center" style="font-size:14px">צריך עוד ' + Logic.fmt(REWARD.pack - S.coins) + ' — שחק כדי להרוויח!</p>' : '') +
      '<div class="stickers" style="margin-top:10px">' + r.map(function (p) { return stickerHtml(p, have.indexOf(p.en) >= 0, (V.newStickers || []).indexOf(p.en) >= 0); }).join('') + '</div>' +
      '<button class="big g" style="margin-top:12px" data-a="pickTeam" data-v="' + id + '">⚽ לשחק עם ' + esc(t.name) + '</button>';
  },
  table: function () {
    return topbar('goHome', '📐 לוח הכפל') + '<div class="card" style="padding:10px">' + renderTable(false) + '</div>' +
      '<div class="card flat"><p class="muted" style="font-size:15px;margin:0">💡 חילוק זה ההפך של כפל: כדי לפתור 24 ÷ 8, מחפשים בשורה של 8 את המספר 24 ורואים באיזו עמודה הוא נמצא. 3!</p></div>';
  },
  stats: function () {
    var ids = Object.keys(S.trophies);
    var teams = Object.keys(S.stats.teams).sort(function (a, b) { return S.stats.teams[b].matches - S.stats.teams[a].matches; });
    return topbar('goHome', '🏆 חדר הגביעים') +
      '<div class="card center"><div style="font-size:60px">' + (ids.length ? '🏆'.repeat(Math.min(ids.length, 8)) : '🥅') + '</div>' +
      '<p>' + ids.length + ' אלבומים הושלמו · ' + S.stats.matches + ' משחקים · ' + S.stats.correct + ' גולים · ' + S.stats.wrong + ' פספוסים</p>' +
      '<p class="muted">סה״כ הרווחת ' + Logic.fmt(S.stats.earned) + ' 🪙</p></div>' +
      (teams.length ? '<div class="card flat">' + teams.map(function (id) { var t = team(id), s = S.stats.teams[id]; return '<div class="row sp" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>' + t.flag + ' ' + esc(t.name) + '</span><span class="muted">' + s.matches + ' משחקים · שיא ' + s.best + '</span></div>'; }).join('') + '</div>' : '<p class="center muted">עוד לא שיחקת. קדימה למגרש!</p>');
  },
  settings: function () {
    var opts = voices.filter(function (v) { return /^en/i.test(v.lang); });
    return topbar('goHome', '⚙️ הגדרות') +
      '<div class="card">' +
      '<label class="set"><span>שם השחקן</span><input type="text" id="nameIn" value="' + esc(S.name) + '" maxlength="14"></label>' +
      '<label class="set"><span>שאלות במשחק</span><div class="seg" style="width:200px">' + [5, 10, 15].map(function (n) { return '<button class="' + (S.perMatch === n ? 'on' : '') + '" data-a="setPer" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div></label>' +
      '<label class="set"><span>רמה</span><div class="seg" style="width:200px">' + [1, 2, 3].map(function (l) { return '<button class="' + (S.level === l ? 'on' : '') + '" data-a="setLevel" data-v="' + l + '">' + '⭐'.repeat(l) + '</button>'; }).join('') + '</div></label>' +
      '<p class="muted" style="font-size:14px">' + levelDesc(S.level) + '</p>' +
      '</div><div class="card"><h3>פעולות חשבון</h3>' +
      [['add', '➕ חיבור'], ['sub', '➖ חיסור'], ['mul', '✖️ כפל'], ['div', '➗ חילוק']].map(function (o) { return '<label class="set"><span>' + o[1] + '</span><span class="toggle ' + (S.ops[o[0]] ? 'on' : '') + '" data-a="toggleOp" data-v="' + o[0] + '"></span></label>'; }).join('') +
      '</div><div class="card"><h3>הקראה באנגלית</h3>' +
      '<label class="set"><span>🔊 הקראת שמות</span><span class="toggle ' + (S.speech ? 'on' : '') + '" data-a="toggleSpeech"></span></label>' +
      '<label class="set"><span>קול</span><select id="voiceSel"><option value="">אוטומטי (בריטי)</option>' + opts.map(function (v) { return '<option value="' + esc(v.name) + '"' + (S.voice === v.name ? ' selected' : '') + '>' + esc(v.name) + ' (' + esc(v.lang) + ')</option>'; }).join('') + '</select></label>' +
      '<div class="row wrap"><button class="small gray" data-a="testVoice">🔊 בדיקה: Erling Haaland</button><button class="small g" data-a="testGoal">⚽ גוללל!</button><button class="small gray" data-a="testHe">🔊 בדיקה בעברית</button></div>' +
      '<label class="set"><span>🎓 הסברים בפעם הראשונה</span><button class="small gray" data-a="resetSeen">להראות שוב</button></label>' +
      '<p class="muted" style="font-size:13px">באייפד: הגדרות ← נגישות ← תוכן מדובר ← קולות ← אנגלית (בריטניה) ← Daniel/Kate, כדי להוריד קול בריטי איכותי.</p>' +
      '</div><div class="card flat"><h3>חוק הפרסים של יהב</h3><p class="muted" style="font-size:15px">חיבור 5 · חיסור 10 · אנגלית 15 · כפל 30 · חילוק 50 · טעות 2 (במיליונים). סיום משחק: +50 מיליון + חפיסת מדבקות.</p>' +
      '<p class="muted" style="font-size:13px">מספרי החולצות לפי עונת 2025/26. לעריכה: הקובץ players.js.</p></div>' +
      '<div class="center"><button class="small r" data-a="resetAsk">🗑 איפוס כל ההתקדמות</button></div>' +
      (V.resetAsk ? '<div class="card" style="border-color:var(--red)"><p class="center">לאפס את כל המטבעות, האלבום והגביעים של ' + esc(S.name) + '? אין דרך חזרה.</p><div class="grid2"><button class="r" data-a="resetYes">כן, לאפס</button><button class="gray" data-a="resetNo">לא</button></div></div>' : '');
  }
};
function levelDesc(l) {
  return { 1: 'קל: חיבור וחיסור עד 20, לוח הכפל עד 6, אות אחת חסרה.', 2: 'בינוני: חיבור וחיסור עד 50, לוח הכפל עד 10, שתי אותיות חסרות.', 3: 'קשה: מספרים גדולים, כפל דו-ספרתי, סדר פעולות, הקלדת כל השם.' }[l];
}
function totalStickers() { var n = 0; for (var k in S.album) n += S.album[k].length; return n; }
function stickerHtml(p, have, isNew) {
  return '<div class="sticker' + (have ? '' : ' locked') + (isNew ? ' new' : '') + '">' + jersey(p.team, have ? p.num : '?', 'sm') + '<div>' + (have ? esc(p.he) : '???') + '</div><div class="en">' + (have ? esc(p.en) : '') + '</div></div>';
}

/* ----- question rendering ----- */
function opName(op) { return { add: 'חיבור', sub: 'חיסור', mul: 'כפל', div: 'חילוק', chain: 'סדר פעולות', spell: 'כתיב באנגלית' }[op]; }
function renderMath(q) {
  var r = RARITY[q.op];
  var cards;
  if (q.op === 'div') {
    cards = '<div class="players">' + pcard(q.players[0]) + '<span class="op">×</span>' + pcard(q.hidden, true) + '<span class="op">=</span><div class="pcard"><div class="math" style="font-size:40px;padding-top:18px">' + q.product + '</div></div></div>' +
      '<p class="center muted" style="font-size:15px">המספר של ' + esc(q.players[0].he) + ' כפול המספר של השחקן המסתורי נותן ' + q.product + '. מה המספר של השחקן המסתורי?</p>';
  } else {
    var syms = q.op === 'chain' ? ['+', '×'] : [q.op === 'add' ? '+' : q.op === 'sub' ? '−' : '×'];
    cards = '<div class="players">' + q.players.map(function (p, i) { return (i ? '<span class="op">' + syms[i - 1] + '</span>' : '') + pcard(p); }).join('') + '</div>';
  }
  return '<div class="card"><div class="row sp"><span class="badge ' + r[1] + '">' + opName(q.op) + ' · ' + r[0] + ' · ' + REWARD[q.op] + ' מיליון</span><span class="row" style="gap:6px"><button class="small gray" data-a="help">❓</button>' + (q.op !== 'add' && q.op !== 'sub' ? '<button class="small p" data-a="openTable">📐</button>' : '') + '</span></div>' + cards +
    '<div class="math">' + q.text + ' = <span class="q">?</span></div>' +
    '<div class="answerbox" id="ans">' + (M.input || '&nbsp;') + '</div>' +
    '<div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) { return '<button data-a="key" data-v="' + d + '">' + d + '</button>'; }).join('') +
    '<button class="del" data-a="key" data-v="del">⌫</button><button data-a="key" data-v="0">0</button><button class="ok" data-a="submit">✔</button></div></div>';
}
function renderSpell(q) {
  var p = q.player, html = '';
  var filled = M.filled || [];
  for (var i = 0; i < q.word.length; i++) {
    var bi = q.blanks.indexOf(i);
    if (bi < 0) html += esc(q.word[i]);
    else if (filled[bi] != null) html += '<span class="filled">' + esc(filled[bi]) + '</span>';
    else html += '<span class="blank' + (bi === filled.length ? ' cur' : '') + '"></span>';
  }
  var first = Logic.strip(p.en).split(' ');
  first = first.length > 1 && Logic.spellWord(p.en) === first[first.length - 1] ? first.slice(0, -1).join(' ') + ' ' : '';
  var input;
  if (q.typed) input = qwerty();
  else {
    var cur = Math.min(filled.length, q.options.length - 1);
    input = '<div class="opts">' + q.options[cur].map(function (L, k) { return '<button class="letter" data-a="letter" data-v="' + esc(L) + '">' + esc(L) + '<span class="muted" style="font-size:12px;font-family:var(--font);display:block">' + (k + 1) + '</span></button>'; }).join('') + '</div>';
  }
  return '<div class="card"><div class="row sp"><span class="badge epic">' + opName('spell') + ' · אפי · ' + REWARD.spell + ' מיליון</span><span class="row" style="gap:6px"><button class="small gray" data-a="help">❓</button><button class="spk" data-a="speak" aria-label="הקראה">🔊</button></span></div>' +
    '<div class="players">' + pcard(p) + '</div>' +
    '<p class="center muted" style="margin:0">' + (q.typed ? 'הקשיבו והקלידו את שם המשפחה באנגלית' : (q.blanks.length > 1 ? 'איזה אותיות חסרות?' : 'איזו אות חסרה?')) + '</p>' +
    '<div class="word center"><span class="first">' + esc(first) + '</span>' + html + '</div>' + input + '</div>';
}
function qwerty() {
  var rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  return '<div class="qwerty">' + rows.map(function (r, i) {
    return '<div class="krow">' + r.split('').map(function (c) { return '<button data-a="type" data-v="' + c + '">' + c + '</button>'; }).join('') +
      (i === 2 ? '<button class="wide" data-a="type" data-v="del">⌫</button><button class="wide ok" data-a="submit">✔</button>' : '') + '</div>';
  }).join('') + '</div>';
}
function renderFeedback() {
  var f = M.fb, q = M.q;
  var ansTxt = q.type === 'math' ? q.text + ' = ' + q.answer : q.answer;
  var extra = q.type === 'math' && q.op === 'div' ? '<p>השחקן המסתורי: ' + esc(q.hidden.he) + ' (' + q.hidden.num + ')</p>' : (q.type === 'spell' ? '<p class="muted" style="direction:ltr">' + esc(q.player.en) + '</p>' : '');
  return '<div class="fb ' + (f.ok ? 'good' : 'bad') + '"><div class="box">' +
    '<div class="big">' + (f.ok ? '⚽ גול!' : '😅 פספוס') + '</div>' +
    '<div class="ans">' + esc(ansTxt) + '</div>' + extra +
    '<div class="reward">+' + Logic.fmt(f.reward) + ' 🪙' + (f.ok ? ' <span class="badge ' + RARITY[q.op][1] + '">' + RARITY[q.op][0] + '</span>' : '') + '</div>' +
    '<button class="big ' + (f.ok ? 'g' : 'o') + '" data-a="next">' + (M.i + 1 >= M.plan.length ? '🏁 לסיום' : 'הבא ▶') + '</button></div></div>';
}

/* ----- match flow ----- */
function startMatch(mode) {
  var id = V.team;
  S.last = { comp: V.comp || S.last.comp, team: id, mode: mode }; save();
  M = { team: id, mode: mode, roster: Logic.roster(id), plan: Logic.plan(mode, S.perMatch), i: 0, correct: 0, earned: 0, input: '', filled: [], fb: null };
  nextQuestion();
  V.screen = 'play'; render();
  afterShow();
}
function afterShow() {
  if (V.explain) speakHe(EXPLAIN[V.explain]().say);
  else if (M.q.type === 'spell') speak(M.q.player.en);
}
function tableHint() {
  var q = M && M.q; if (!q || q.type !== 'math') return {};
  if (q.op === 'mul' && q.players[0].num <= 10 && q.players[1].num <= 10) return { row: q.players[0].num, col: q.players[1].num };
  if (q.op === 'div' && q.players[0].num <= 10) return { row: q.players[0].num };
  if (q.op === 'chain' && q.players[1].num <= 10) return { row: q.players[1].num, col: q.players[2].num };
  return {};
}
function nextQuestion() {
  var kind = M.plan[M.i];
  M.q = kind === 'math' ? Logic.genMath(M.roster, S.level, S.ops) : Logic.genSpell(M.roster, S.level);
  M.input = ''; M.filled = []; M.fb = null;
  V.table = null;
  V.explain = S.seen[M.q.op] ? null : M.q.op;
}
function finish(ok) {
  var q = M.q, reward = ok ? q.reward : REWARD.miss;
  M.fb = { ok: ok, reward: reward };
  M.earned += reward; S.coins += reward; S.stats.earned += reward;
  if (ok) { M.correct++; S.stats.correct++; } else S.stats.wrong++;
  save(); render();
  if (ok) { speakGoal(); if (q.type === 'spell') speak(q.player.en, { queue: true }); }
  else if (q.type === 'spell') speak(q.player.en);
}
function endMatch() {
  var n = M.plan.length, id = M.team;
  S.coins += REWARD.finish; M.earned += REWARD.finish; S.stats.earned += REWARD.finish; S.stats.matches++;
  var st = S.stats.teams[id] || { matches: 0, best: 0 }; st.matches++; st.best = Math.max(st.best, M.correct); S.stats.teams[id] = st;
  M.pack = openPack(id, 3);
  if (!M.pack.length) { S.coins += 20; M.earned += 20; }
  M.newTrophy = checkTrophy(id);
  save(); V.screen = 'end'; render(); confetti();
}
function openPack(id, n) {
  var have = S.album[id] = S.album[id] || [];
  var locked = Logic.roster(id).filter(function (p) { return have.indexOf(p.en) < 0; });
  var got = shuffle(locked).slice(0, n);
  got.forEach(function (p) { have.push(p.en); });
  return got;
}
function checkTrophy(id) {
  if (S.trophies[id]) return false;
  if (albumCount(id) >= Logic.roster(id).length) { S.trophies[id] = true; return true; }
  return false;
}
function confetti() {
  var em = ['⚽', '🏆', '🪙', '⭐', '🎉', '🥅'];
  for (var i = 0; i < 24; i++) {
    var s = document.createElement('span'); s.className = 'confetti'; s.textContent = pick(em);
    s.style.left = rnd(100) + 'vw'; s.style.animationDelay = (Math.random() * 1.2) + 's';
    document.body.appendChild(s); setTimeout(function (el) { el.remove(); }, 4000, s);
  }
}

/* ----- actions ----- */
var A = {
  goHome: function () { V.screen = 'home'; V.resetAsk = false; render(); },
  goComp: function () { V.screen = 'comp'; render(); },
  pickComp: function (v) { V.comp = v; V.screen = 'team'; render(); },
  goTeamList: function () { V.screen = 'team'; render(); },
  pickTeam: function (v) { V.team = v; if (!V.comp || compsOf(v).map(function (c) { return c.id; }).indexOf(V.comp) < 0) V.comp = (compsOf(v)[0] || D.competitions[0]).id; V.screen = 'pre'; render(); },
  start: function (v) { startMatch(v); },
  setLevel: function (v) { S.level = +v; save(); render(); },
  setPer: function (v) { S.perMatch = +v; save(); render(); },
  toggleOp: function (v) { S.ops[v] = !S.ops[v]; if (!Object.keys(S.ops).some(function (k) { return S.ops[k]; })) S.ops.add = true; save(); render(); },
  toggleSpeech: function () { S.speech = !S.speech; save(); render(); },
  testVoice: function () { var sel = document.getElementById('voiceSel'); if (sel) { S.voice = sel.value; save(); } var sp = S.speech; S.speech = true; speak('Erling Haaland'); S.speech = sp; },
  goAlbum: function () { V.screen = 'album'; V.newStickers = []; render(); },
  goAlbumTeam: function (v) { V.team = v; if (M && M.pack && M.team === v) { V.newStickers = M.pack.map(function (p) { return p.en; }); } V.screen = 'albumTeam'; render(); },
  buyPack: function (v) { if (S.coins < REWARD.pack) return; S.coins -= REWARD.pack; var got = openPack(v, 3); V.newStickers = got.map(function (p) { return p.en; }); checkTrophy(v); save(); render(); if (S.trophies[v] && got.length) confetti(); },
  testGoal: function () { var sp = S.speech; S.speech = true; speakGoal(); S.speech = sp; },
  testHe: function () { var sp = S.speech; S.speech = true; speakHe('3 כפול 8 שווה 24'); S.speech = sp; },
  goStats: function () { V.screen = 'stats'; render(); },
  goSettings: function () { V.screen = 'settings'; render(); },
  resetAsk: function () { V.resetAsk = true; render(); },
  resetNo: function () { V.resetAsk = false; render(); },
  resetYes: function () { try { localStorage.removeItem(KEY); } catch (e) { } S = JSON.parse(JSON.stringify(DEFAULT)); V = { screen: 'home' }; M = null; render(); },
  quit: function () { M = null; V.explain = null; V.table = null; V.screen = 'pre'; render(); },
  help: function () { if (!M || M.fb) return; V.explain = M.q.op; render(); speakHe(EXPLAIN[V.explain]().say); },
  sayExplain: function () { if (V.explain) speakHe(EXPLAIN[V.explain]().say); },
  closeExplain: function () { var op = V.explain; V.explain = null; if (op) { S.seen[op] = true; save(); } render(); if (M && V.screen === 'play' && M.q.type === 'spell') speak(M.q.player.en); },
  openTable: function () { if (V.screen === 'play') { var h = tableHint(); V.explain = null; V.table = { open: true, row: h.row || 0, col: h.col || 0, hint: !!h.row }; render(); } else { V.table = {}; V.screen = 'table'; render(); } },
  closeTable: function () { V.table = null; render(); },
  cell: function (v) { var p = v.split(',').map(Number); var T = V.table || {}; V.table = { open: !!T.open, row: p[0], col: p[1] }; render(); speakHe(p[0] + ' כפול ' + p[1] + ' שווה ' + (p[0] * p[1])); },
  resetSeen: function () { S.seen = {}; save(); render(); },
  speak: function () { if (M && M.q.type === 'spell') { var sp = S.speech; S.speech = true; speak(M.q.player.en); S.speech = sp; } },
  key: function (v) {
    if (!M || M.fb || V.explain || M.q.type !== 'math') return;
    if (v === 'del') M.input = M.input.slice(0, -1); else if (M.input.length < 5) M.input += v;
    var el = document.getElementById('ans'); if (el) el.innerHTML = M.input || '&nbsp;';
  },
  submit: function () {
    if (!M || M.fb || V.explain) return;
    if (M.q.type === 'math') { if (M.input === '') return; finish(parseInt(M.input, 10) === M.q.answer); }
    
  },
  letter: function (v) {
    if (!M || M.fb || V.explain || M.q.type !== 'spell' || M.q.typed) return;
    var q = M.q, cur = M.filled.length;
    if (v !== q.word[q.blanks[cur]]) { M.filled.push(v); finish(false); return; }
    M.filled.push(v);
    if (M.filled.length >= q.blanks.length) finish(true); else render();
  },
  type: function (v) {
    if (!M || M.fb || V.explain || !M.q.typed) return;
    var q = M.q;
    if (v === 'del') { M.filled.pop(); }
    else {
      if (M.filled.length >= q.blanks.length) return;
      var ch = q.word[q.blanks[M.filled.length]];
      M.filled.push(ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? v.toUpperCase() : v.toLowerCase());
    }
    render();
  },
  next: function () {
    if (!M || !M.fb) return;
    M.i++;
    if (M.i >= M.plan.length) { endMatch(); return; }
    nextQuestion(); render();
    afterShow();
  }
};
// ב-hard: משווים את האותיות שהוקלדו לאותיות החסרות (האות הראשונה ומקפים מוצגים מראש)
var _submit = A.submit;
A.submit = function () {
  if (M && !M.fb && !V.explain && M.q.type === 'spell' && M.q.typed) {
    if (!M.filled.length) return;
    var want = M.q.blanks.map(function (i) { return M.q.word[i]; }).join('').toLowerCase();
    finish(M.filled.join('').toLowerCase() === want); return;
  }
  _submit();
};

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]'); if (!el) return;
  var a = el.getAttribute('data-a'), v = el.getAttribute('data-v');
  if (A[a]) A[a](v, el);
});
document.addEventListener('change', function (e) {
  if (e.target.id === 'nameIn') { S.name = e.target.value.trim() || 'יהב'; save(); }
  if (e.target.id === 'voiceSel') { S.voice = e.target.value; save(); }
});
document.addEventListener('keydown', function (e) {
  if (!M || V.screen !== 'play') return;
  if (e.target && e.target.tagName === 'INPUT') return;
  if (V.explain) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.closeExplain(); } return; }
  if (V.table && V.table.open) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); A.closeTable(); } return; }
  if (M.fb) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.next(); } return; }
  var q = M.q;
  if (q.type === 'math') {
    if (/^[0-9]$/.test(e.key)) A.key(e.key);
    else if (e.key === 'Backspace') A.key('del');
    else if (e.key === 'Enter') A.submit();
  } else if (q.typed) {
    if (/^[a-zA-Z]$/.test(e.key)) A.type(e.key.toUpperCase());
    else if (e.key === 'Backspace') A.type('del');
    else if (e.key === 'Enter') A.submit();
  } else {
    var cur = M.filled.length, opts = q.options[cur] || [];
    if (/^[1-4]$/.test(e.key) && opts[+e.key - 1]) A.letter(opts[+e.key - 1]);
    else if (/^[a-zA-Z]$/.test(e.key)) { var hit = opts.filter(function (L) { return L.toLowerCase() === e.key.toLowerCase(); })[0]; if (hit) A.letter(hit); }
  }
});

function start(snap) {
  S = load();
  if (snap && snap.S) { S = deepMerge(JSON.parse(JSON.stringify(DEFAULT)), snap.S); V = snap.V || V; M = snap.M || null; }
  if (M && M.q && !M.roster) M.roster = Logic.roster(M.team);
  render();
}
try { if (root.claude && root.claude.hot && root.claude.hot.snapshot) root.claude.hot.snapshot(function () { return { S: S, V: V, M: M }; }); } catch (e) { }
if (root.claude && root.claude.hot && root.claude.hot.ready) root.claude.hot.ready(start); else start((root.claude && root.claude.hot && root.claude.hot.data) || null);
root.App = { actions: A, state: function () { return { S: S, V: V, M: M }; }, speak: speak };
})(typeof window !== 'undefined' ? window : globalThis);
