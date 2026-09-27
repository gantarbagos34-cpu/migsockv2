
const accounts = Array.from({length:10},()=>({sessionId:null,username:"",password:"",balance:"-",eventSource:null,status:"OFFLINE"}));
const targets = [];
const participantNames = [];
const el = id => document.getElementById(id);


function esc(v){
  return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
}

function sync(){
  for(let i=0; i<10; i++){
    if(el(`u${i}`)) accounts[i].username = el(`u${i}`).value.trim();
    if(el(`p${i}`)) accounts[i].password = el(`p${i}`).value;
  }
}

function renderAccounts(){
  el("accounts").innerHTML = accounts.map((a, i) => `
    <div class="troop-card">
      <div class="troop-main">
        <div class="troop-id">
          <span class="troop-name">T${i+1}</span>
          <span id="status${i}" title="${esc(a.status || (a.sessionId ? "ONLINE" : "OFFLINE"))}" aria-label="Status Troop ${i+1}: ${esc(a.status || (a.sessionId ? "ONLINE" : "OFFLINE"))}" class="troop-status ${a.status === 'ONLINE' ? 'online' : a.status === 'SUSPEND' ? 'suspend' : a.status === 'ERROR' ? 'error' : a.status === 'OFFLINE' ? 'offline' : a.status === 'LOGIN…' || a.status === 'LOGIN...' ? 'login' : ''}"></span>
        </div>
        <div class="troop-credentials">
          <input id="u${i}" value="${esc(a.username)}" class="troop-input" placeholder="Username" autocomplete="off" aria-label="Username Troop ${i+1}">
          <input id="p${i}" value="${esc(a.password)}" type="password" class="troop-input" placeholder="Password" autocomplete="off" aria-label="Password Troop ${i+1}">
        </div>
        <span id="b${i}" class="troop-balance" title="Saldo">${esc(a.balance === '-' ? '0' : a.balance)}</span>
        <button onclick="loginOne(${i})" class="troop-icon login-icon" title="Login Troop ${i+1}" aria-label="Login Troop ${i+1}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path stroke-linecap="round" stroke-linejoin="round" d="m10 17 5-5-5-5M15 12H3"/></svg>
        </button>
        <button onclick="logoutOne(${i})" class="troop-icon logout-icon" title="Logout Troop ${i+1}" aria-label="Logout Troop ${i+1}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 17l5-5-5-5"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12H3"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>
        </button>
      </div>
    </div>
  `).join("");
}

function setStatus(i, text, kind=""){
  const s = el(`status${i}`);
  if(!s) return;
  const normalized = String(text || "OFFLINE").toUpperCase();
  const temporary = normalized === "LOGIN…" || normalized === "LOGIN...";
  const status = ["ONLINE","OFFLINE","ERROR","SUSPEND"].includes(normalized) ? normalized : (temporary ? normalized : "ERROR");
  accounts[i].status = status;
  const label = status === "LOGIN…" || status === "LOGIN..." ? "LOGIN" : status;
  s.textContent = "";
  s.title = label;
  s.setAttribute("aria-label", `Status Troop ${i+1}: ${label}`);
  s.className = "troop-status";
  if(status === "ONLINE") s.classList.add("online");
  else if(status === "SUSPEND") s.classList.add("suspend");
  else if(status === "ERROR") s.classList.add("error");
  else if(status === "OFFLINE") s.classList.add("offline");
  else if(temporary) s.classList.add("login");
}


function setBalance(i, label){
  let value = String(label ?? "").trim();
  const numeric = value.replace(/[^0-9.,-]/g, "").trim();
  accounts[i].balance = numeric || "-";
  const b = el(`b${i}`);
  if(b) { const v = b.querySelector("strong"); if(v) v.textContent = accounts[i].balance; else b.textContent = accounts[i].balance; }
}

function validRange(){
  const rawStart = el("rangeStart").value.trim();
  const rawEnd = el("rangeEnd").value.trim();
  if(rawStart === "") return null;
  const start = Number(rawStart);
  if(!Number.isSafeInteger(start) || start < 0) return null;
  let end = rawEnd === "" ? start + 9 : Number(rawEnd);
  if(!Number.isSafeInteger(end)) return null;
  const step = end >= start ? 1 : -1;
  end = start + step * 9;
  return {start, end, step};
}

function generateTroop(){
  sync();
  const main = el("mainTroop").value.trim();
  if(!main){ return; }
  const range = validRange();
  if(!range){ return; }
  el("rangeEnd").value = String(range.end);
  for(let i=0; i<10; i++){
    accounts[i].username = main + String(range.start + i * range.step);
  }
  renderAccounts();
}

function generatePassword(){
  sync();
  const p = el("mainPassword").value;
  if(!p){ return; }
  for(let i=0; i<10; i++){
    accounts[i].password = p;
  }
  renderAccounts();
}

function clearFields(){
  for(let i=0; i<10; i++){
    accounts[i].username = "";
    accounts[i].password = "";
    accounts[i].balance = "-";
  }
  el("mainTroop").value = "";
  el("mainPassword").value = "";
  renderAccounts();
}

function openEvents(i){
  const a = accounts[i];
  if(!a.sessionId) return;
  if(a.eventSource) try{ a.eventSource.close(); }catch{}
  const sessionId = a.sessionId;
  const es = new EventSource(`/api/events?sessionId=${encodeURIComponent(sessionId)}`);
  a.eventSource = es;
  es.onmessage = (ev) => {
    if(accounts[i]?.sessionId !== sessionId) return;
    try{
      const msg = JSON.parse(ev.data);
      handleApiEvent(i, msg);
    }catch{}
  };
  es.onerror = () => {
    try{ es.close(); }catch{}
  };
}

const TIMER_START_MS = 60000;
let timerValue = TIMER_START_MS;
let timerRunning = false;
let timerDeadline = 0;
let timerFrame = 0;
let timerGeneration = 0;
let kickTriggeredForTimer = false;
let lastTimerEventKey = "";
let activeVoteKey = "";

function renderTimer(){
  const node = el("timerValue");
  if(node) node.textContent = String(Math.max(0, Math.ceil(timerValue)));
}

function getKickTimerMs(){
  return Math.max(0, Number(el("kickTimer")?.value) || 0);
}

function resetTimer(){
  timerGeneration++;
  timerRunning = false;
  if(timerFrame) clearTimeout(timerFrame);
  timerFrame = 0;
  timerDeadline = 0;
  timerValue = TIMER_START_MS;
  kickTriggeredForTimer = false;
  renderTimer();
}

function triggerKickAllIfReached(previousValue = null){
  const configuredMs = getKickTimerMs();
  if(kickTriggeredForTimer || configuredMs < 0) return;

  // Countdown <= nilai textbox Timer menjadi satu-satunya pemicu.
  const currentValue = Number(timerValue);
  const previous = previousValue === null ? null : Number(previousValue);
  const reached = currentValue <= configuredMs &&
    (previous === null || previous >= configuredMs);

  if(reached){
    kickTriggeredForTimer = true;
    const button = el("kickAllButton");
    if(button) button.click();
    else kickSelectedTargets();
  }
}

function startCountdown(durationMs = TIMER_START_MS, eventKey = ""){
  // Event yang sama/duplikat tidak boleh menghidupkan ulang timer.
  if(eventKey && eventKey === lastTimerEventKey){
    return;
  }
  if(eventKey) lastTimerEventKey = eventKey;

  const duration = Math.max(0, Number(durationMs) || 0);
  const generation = ++timerGeneration;

  if(timerFrame) clearTimeout(timerFrame);

  timerValue = duration;
  timerDeadline = performance.now() + duration;
  timerRunning = duration > 0;
  kickTriggeredForTimer = false;
  renderTimer();
  triggerKickAllIfReached(null);

  if(!timerRunning){
    timerValue = 0;
    renderTimer();
    return;
  }

  // Asynchronous countdown. Tidak ada interval blocking dan timer tidak
  // pernah di-reset ke 60000 saat mencapai 0.
  const tick = () => {
    if(!timerRunning || generation !== timerGeneration) return;

    const previousValue = timerValue;
    const remaining = Math.max(0, timerDeadline - performance.now());
    const nextValue = Math.ceil(remaining);

    timerValue = nextValue;
    renderTimer();
    triggerKickAllIfReached(previousValue);

    if(remaining <= 0){
      timerRunning = false;
      timerValue = 0;
      timerFrame = 0;
      renderTimer();
      return;
    }

    // Update cukup sering untuk tampilan, tetapi tidak memaksa 1 callback
    // untuk setiap 1 ms.
    timerFrame = setTimeout(tick, Math.min(100, Math.max(10, remaining % 100 || 25)));
  };

  timerFrame = setTimeout(tick, 0);
}


function getKickEventData(msg){
  return msg?.data ?? msg ?? {};
}

function getEventTimestamp(msg){
  const data = getKickEventData(msg);
  const candidates = [
    data?.time, data?.timestamp, data?.event_time, data?.eventTime, data?.created_at, data?.createdAt,
    msg?.time, msg?.timestamp, msg?.event_time, msg?.eventTime, msg?.created_at, msg?.createdAt
  ];
  for(const value of candidates){
    if(value == null || value === "") continue;
    if(typeof value === "number" || (/^\d+(?:\.\d+)?$/.test(String(value)))){
      const n = Number(value);
      if(Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    }
    const t = Date.parse(String(value));
    if(Number.isFinite(t)) return t;
  }
  return null;
}

function getVoteRemainingMs(msg){
  const data = getKickEventData(msg);
  const nested = msg?.event ?? msg?.data?.event ?? null;
  const nestedData = nested?.data ?? nested ?? {};
  const textCandidates = [
    data?.status_message, data?.text, data?.message,
    msg?.status_message, msg?.text, msg?.message,
    nestedData?.status_message, nestedData?.text, nestedData?.message,
    nested?.status_message, nested?.text, nested?.message
  ];
  for(const value of textCandidates){
    const text = String(value ?? "").trim();
    // MigReborn room moderation status, e.g.:
    // "Vote to kick gantar: 1 vote, 1 more vote needed. 40s remaining."
    const match = text.match(/\b(\d+)\s*(?:s|sec|secs|second|seconds)\s+remaining\.?$/i);
    if(match) return Math.max(0, Number(match[1]) * 1000);
  }
  const millisecondCandidates = [data?.remaining_ms, data?.remainingMs, msg?.remaining_ms, msg?.remainingMs, nestedData?.remaining_ms, nestedData?.remainingMs];
  for(const value of millisecondCandidates){
    const n = Number(value);
    if(Number.isFinite(n) && n >= 0) return n;
  }
  const secondCandidates = [data?.remaining, msg?.remaining, nestedData?.remaining];
  for(const value of secondCandidates){
    const n = Number(value);
    if(Number.isFinite(n) && n >= 0) return n * 1000;
  }
  return null;
}

function getVoteCountdownMs(msg){
  // Prioritaskan waktu event asli dari API. Jika WebSocket terlambat 8 detik,
  // countdown dimulai dari ~52.000 ms, bukan 60.000 ms.
  const eventTime = getEventTimestamp(msg);
  if(Number.isFinite(eventTime)){
    const age = Math.max(0, Date.now() - eventTime);
    return Math.max(0, TIMER_START_MS - age);
  }

  // Fallback jika API tidak memberi timestamp: gunakan sisa waktu yang tertulis
  // pada status event. Ini tetap lebih akurat daripada selalu memulai 60 detik.
  const remaining = getVoteRemainingMs(msg);
  if(Number.isFinite(remaining)) return Math.min(TIMER_START_MS, Math.max(0, remaining));

  return TIMER_START_MS;
}

function isVoteStartedKickEvent(msg){
  // The actual Socket 1 event is room.kick.state with action=vote_started.
  // Example: status_message = "A vote to kick ... 60s remaining."
  // Keep room.text support as a harmless fallback for older API variants.
  const rawEvent = msg?.event ?? msg?.data?.event ?? msg;
  const data = rawEvent?.data ?? rawEvent ?? {};
  const eventType = String(rawEvent?.type ?? data?.event_type ?? "").toLowerCase();
  const action = String(rawEvent?.action ?? data?.action ?? "").toLowerCase();
  const status = String(rawEvent?.status_message ?? data?.status_message ?? "").trim();
  const text = String(data?.text ?? rawEvent?.text ?? data?.message ?? rawEvent?.message ?? status).trim();

  if(eventType === "room.kick.state" && action === "vote_started"){
    return /vote\s+to\s+kick\b/i.test(status || text) &&
      /\b\d+\s*(?:s|sec|secs|second|seconds)\s+remaining\.?$/i.test(status || text);
  }

  if(eventType !== "room.text" && eventType !== "room.message.received") return false;
  return /^vote\s+to\s+kick\s+.+?:\s*\d+\s+vote(?:s)?[, ]+\d+\s+more\s+vote(?:s)?\s+needed\.\s*\d+\s*(?:s|sec|secs|second|seconds)\s+remaining\.?$/i.test(text);
}
function getVoteKey(msg){
  const rawEvent = msg?.event ?? msg?.data?.event ?? msg;
  const data = rawEvent?.data ?? rawEvent ?? {};
  const explicitId = String(
    data?.event_id ?? data?.eventId ?? data?.id ?? msg?.event_id ?? msg?.eventId ?? ""
  ).trim();
  if(explicitId) return `id:${explicitId}`;

  const target = String(data?.target_username ?? "").trim().toLowerCase();
  const starter = String(data?.username ?? "").trim().toLowerCase();
  const room = String(data?.room ?? data?.room_name ?? "").trim().toLowerCase();
  const time = String(data?.time ?? msg?.time ?? "").trim();

  // Jika API tidak menyediakan event_id, waktu event tetap dipakai untuk
  // membedakan dua vote yang benar-benar berbeda. Status countdown tidak
  // pernah dipakai sebagai identitas event.
  return `vote:${room}|${target}|${starter}|${time}`;
}

function isVoteFinishedEvent(msg){
  const data = getKickEventData(msg);
  const eventType = String(msg?.type ?? data?.event_type ?? "").toLowerCase();
  const action = String(data?.action ?? msg?.action ?? "").toLowerCase();
  return (eventType === "room.kick.state" || eventType === "room.kick") &&
    ["vote_completed","vote_cancelled","vote_failed","kick_completed","kick_failed","completed","cancelled"].includes(action);
}

let suicideEnabled = false;
let suicideTriggeredKeys = new Set();

function renderSuicideToggle(){
  const button = el("suicideToggle");
  if(!button) return;
  button.textContent = suicideEnabled ? "SUICIDE ON" : "SUICIDE OFF";
  button.title = suicideEnabled ? "Suicide ON" : "Suicide OFF";
  button.setAttribute("aria-pressed", suicideEnabled ? "true" : "false");
  button.setAttribute("aria-label", suicideEnabled ? "Suicide ON" : "Suicide OFF");
  button.classList.toggle("suicide-on", suicideEnabled);
  button.classList.toggle("suicide-off", !suicideEnabled);
}

function toggleSuicide(){
  suicideEnabled = !suicideEnabled;
  if(!suicideEnabled) suicideTriggeredKeys.clear();
  renderSuicideToggle();
}

function getVoteTargetUsername(msg){
  const rawEvent = msg?.event ?? msg?.data?.event ?? msg;
  const data = rawEvent?.data ?? rawEvent ?? {};
  const direct = String(
    data?.target_username ??
    rawEvent?.target_username ??
    msg?.target_username ??
    ""
  ).trim();
  if(direct) return direct;

  const candidates = [
    rawEvent?.status_message,
    data?.status_message,
    rawEvent?.text,
    data?.text,
    rawEvent?.message,
    data?.message
  ];

  for(const value of candidates){
    const text = String(value ?? "").trim();
    // Contoh API: "A vote to kick username: 1 vote, 1 more vote needed. 40s remaining."
    const match = text.match(/^A\s+vote\s+to\s+kick\s+(.+?)\s*:\s*\d+\s+votes?(?:,|\s)/i);
    if(match) return match[1].trim();
    const simple = text.match(/^A\s+vote\s+to\s+kick\s+(.+?)(?:\s+\d+\s+votes?\b|\s+\d+\s*(?:s|sec|secs|second|seconds)\s+remaining\b)/i);
    if(simple) return simple[1].trim().replace(/[.:,]+$/,"").trim();
  }
  return "";
}

function findOwnWebsocketAccount(targetUsername){
  const wanted = String(targetUsername || "").trim().toLowerCase();
  if(!wanted) return null;
  for(let i=0; i<10; i++){
    const account = accounts[i];
    const username = String(account?.username || "").trim();
    if(username && username.toLowerCase() === wanted && account?.sessionId){
      return {username, sessionId:account.sessionId, websocket:i+1};
    }
  }
  return null;
}

async function suicideKickTarget(targetUsername, eventKey){
  if(!suicideEnabled) return;
  sync();

  // Suicide only triggers when the vote target matches one of our WS1-WS10 usernames.
  const matched = findOwnWebsocketAccount(targetUsername);
  if(!matched) return;

  const room = el("room")?.value.trim();
  if(!room) return;

  // Once a matching target is found, every connected account (WS1-WS10) kicks it.
  const onlineAccounts = [];
  for(let i=0; i<10; i++){
    const account = accounts[i];
    if(account?.sessionId && String(account.username || "").trim()){
      onlineAccounts.push({
        sessionId: account.sessionId,
        websocket: i + 1
      });
    }
  }
  if(!onlineAccounts.length) return;

  const normalizedKey = String(eventKey || `${room}|${matched.username}`).trim().toLowerCase();
  if(suicideTriggeredKeys.has(normalizedKey)) return;
  suicideTriggeredKeys.add(normalizedKey);

  try{
    await Promise.all(onlineAccounts.map(account =>
      fetch("/api/action", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          sessionId: account.sessionId,
          action: "kick",
          room,
          targetUsername: matched.username
        })
      })
    ));
  }catch{
    suicideTriggeredKeys.delete(normalizedKey);
  }
}

function handleApiEvent(i, msg){
  // Suicide membaca stream event dari semua WebSocket (1-10).
  if(suicideEnabled && isVoteStartedKickEvent(msg)){
    const rawEvent = msg?.event ?? msg?.data?.event ?? msg;
    const targetUsername = getVoteTargetUsername(rawEvent);
    if(targetUsername){
      void suicideKickTarget(targetUsername, getVoteKey(rawEvent));
    }
  }
  if(isVoteFinishedEvent(msg)){
    // Vote lama sudah berakhir; vote_started berikutnya boleh menjadi trigger baru.
    activeVoteKey = "";
  }
  if(i === 0 && isVoteStartedKickEvent(msg)){
    const rawEvent = msg?.event ?? msg?.data?.event ?? msg;
    const eventKey = getVoteKey(msg);

    // Event yang sama dapat dikirim berkali-kali oleh stream. Jangan pernah
    // restart countdown hanya karena ada salinan event vote_started.
    if(eventKey && eventKey === activeVoteKey) return;

    // Selama countdown aktif, event vote_started lain tidak boleh me-reset
    // timer yang sedang berjalan. Timer berikutnya hanya boleh dimulai setelah
    // countdown selesai (atau setelah reset manual).
    if(timerRunning) return;

    activeVoteKey = eventKey;

    // Use the actual vote-start timestamp when the API provides it. The event
    // in room.kick.state contains `time`, which represents when the vote was
    // started. Therefore the countdown is the original 60s deadline minus the
    // time already elapsed before this event reached the browser.
    // This prevents network/SSE delay from giving the vote a fresh 60 seconds.
    let countdownMs = getVoteCountdownMs(rawEvent);

    // If the API event has no usable timestamp, fall back to the server's
    // receive time so browser/SSE delivery delay is still deducted from the
    // remaining value reported by the API.
    const eventTime = getEventTimestamp(rawEvent);
    if(!Number.isFinite(eventTime)){
      const receivedAt = Number(msg?.receivedAt);
      const reportedRemaining = getVoteRemainingMs(rawEvent);
      if(Number.isFinite(receivedAt) && receivedAt > 0 && Number.isFinite(reportedRemaining)){
        countdownMs = Math.max(0, reportedRemaining - Math.max(0, Date.now() - receivedAt));
      }
    }

    startCountdown(countdownMs, eventKey);
  }
  if(msg.type === "wallet.balance.result" || msg.type === "wallet.transfer.result"){
    const w = msg.data?.wallet;
    if(w?.balance_cr != null) setBalance(i, w.balance_cr);
    else if(w?.label) setBalance(i, w.label);
  }
  if(msg.type === "session.replaced"){
    setStatus(i, "ERROR");
    accounts[i].sessionId = null;
    setBalance(i, "-");
  }
  if(msg.type === "session.closed"){
    accounts[i].sessionId = null;
    setStatus(i, "OFFLINE");
    setBalance(i, "-");
  }
  if(msg.type === "session.error"){
    setStatus(i, "ERROR");
  }
  if(msg.type === "login.status" && String(msg.status).toUpperCase() === "SUSPEND"){
    setStatus(i, "SUSPEND");
  }
  if(String(msg.type||"").includes("participants") || hasParticipantContainer(msg.data)){
    const list = extractParticipantNames(msg);
    if(list.length){
      renderParticipants(list);
    }
  }
}

function hasParticipantContainer(data){
  if(!data || typeof data !== "object") return false;
  return ["participants", "participant", "members", "users"].some(k => Object.prototype.hasOwnProperty.call(data, k));
}

function extractParticipantNames(msg){
  const found = [];
  const seen = new Set();
  const add = v => {
    if(typeof v !== "string") return;
    const n = v.trim();
    if(n && !seen.has(n)){ seen.add(n); found.push(n); }
  };
  function walk(v, depth, participantContext=false){
    if(depth > 10 || v == null) return;
    if(Array.isArray(v)){ for(const x of v) walk(x, depth+1, participantContext); return; }
    if(typeof v !== "object") return;
    const keys = Object.keys(v);
    const ctx = participantContext || keys.some(k => ["participants","participant","members","users"].includes(k));
    if(ctx && typeof v.username === "string") add(v.username);
    if(ctx && typeof v.user_name === "string") add(v.user_name);
    if(ctx && typeof v.name === "string" && keys.some(k => ["user_id","userId","username","user_name"].includes(k))) add(v.name);
    for(const [k, val] of Object.entries(v)){
      if(["password","permissions","wallet"].includes(k)) continue;
      const childCtx = ctx || ["participants","participant","members","users","items","result","data"].includes(k);
      walk(val, depth+1, childCtx);
    }
  }
  walk(msg, 0, String(msg?.type||"").includes("participants"));
  return found;
}

function renderParticipants(list, merge=true){
  const combined = merge ? [...participantNames, ...list] : list;
  const unique = [...new Set(combined.filter(Boolean))];
  participantNames.length = 0;
  participantNames.push(...unique);
  if(!unique.length){
    el("participantsList").innerHTML = '<div class="flex items-center justify-center h-full text-xs text-slate-500 py-10">Tidak ada peserta.</div>';
    return;
  }
  el("participantsList").innerHTML = unique.map(n => `
    <div class="flex items-center px-3 py-2 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors">
      <span class="text-xs sm:text-sm text-slate-200 truncate">${esc(n)}</span>
    </div>
  `).join("");
  populateTargetsFromUsers(list);
}

function clearParticipants(){
  participantNames.length = 0;
  // List User bersifat independen dari Target Kick.
  // Target yang sudah dipilih tidak boleh hilang saat List User dibersihkan.
  el("participantsList").innerHTML = '<div class="flex items-center justify-center h-full text-xs text-slate-500 py-10">Belum ada data participants.</div>';
}

// Checkbox List User tidak lagi menghapus/membangun ulang Target Kick.
// Target hanya berubah melalui pemilihan target/Auto Target.
function syncCheckedTargets(){
  return;
}

// Kompatibilitas tombol lama: pertahankan target yang sudah ada.
function moveCheckedToTargets(){ return; }

function normalizeTargetName(value){
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function targetNameSimilarity(a, b){
  const x=normalizeTargetName(a), y=normalizeTargetName(b);
  if(!x || !y) return 0;
  if(x===y) return 1;
  let prefix=0;
  const plen=Math.min(x.length,y.length);
  while(prefix<plen && x[prefix]===y[prefix]) prefix++;
  const prefixScore=prefix/plen;

  const rows=x.length+1, cols=y.length+1;
  let prev=new Uint16Array(cols), curr=new Uint16Array(cols);
  for(let i=1;i<rows;i++){
    for(let j=1;j<cols;j++) curr[j]=(x[i-1]===y[j-1]) ? prev[j-1]+1 : Math.max(prev[j],curr[j-1]);
    const t=prev; prev=curr; curr=t; curr.fill(0);
  }
  const lcsScore=(2*prev[cols-1])/(x.length+y.length);

  const counts=new Map();
  for(const ch of x) counts.set(ch,(counts.get(ch)||0)+1);
  let common=0;
  for(const ch of y){ const n=counts.get(ch)||0; if(n>0){ common++; counts.set(ch,n-1); } }
  const charScore=common/Math.max(x.length,y.length);

  const dprev=new Uint16Array(cols), dcurr=new Uint16Array(cols);
  for(let j=0;j<cols;j++) dprev[j]=j;
  for(let i=1;i<rows;i++){
    dcurr[0]=i;
    for(let j=1;j<cols;j++){
      const cost=x[i-1]===y[j-1]?0:1;
      dcurr[j]=Math.min(dcurr[j-1]+1,dprev[j]+1,dprev[j-1]+cost);
    }
    dprev.set(dcurr);
  }
  const editScore=1-(dprev[cols-1]/Math.max(x.length,y.length));
  return Math.max(0.45*charScore+0.35*lcsScore+0.20*editScore, 0.60*prefixScore+0.25*lcsScore+0.15*charScore);
}

function populateTargetsFromUsers(sourceList){
  // Auto Target: cari 10 username yang memiliki nama dasar/prefix yang sama.
  // Contoh: anda1, anda2, ... anda10 -> masukkan 10 target.
  // Jika tidak ada kelompok dengan minimal 10 username yang memiliki prefix sama,
  // List Target dikosongkan.
  const users = Array.isArray(sourceList)
    ? sourceList.map(n => String(n ?? "").trim()).filter(Boolean)
    : [...participantNames].map(n => String(n ?? "").trim()).filter(Boolean);

  targets.length = 0;

  // Jangan masukkan username dari Socket/Troop 1-10 ke List Target.
  const socketUsernames = new Set(
    accounts.slice(0, 10).map(a => normalizeTargetName(a?.username)).filter(Boolean)
  );

  // Kelompokkan berdasarkan SEMUA huruf username. Semua angka dan semua
  // separator/pemisah diabaikan, di mana pun posisinya.
  // Contoh: aug-01-aug, aug_02_aug, aug.03.aug -> grup "augaug".
  const groups = new Map();
  for (const user of users) {
    const normalized = normalizeTargetName(user);
    if (!normalized) continue;
    if (socketUsernames.has(normalized)) continue;
    const base = normalized.replace(/\d+/g, "");
    if (!base) continue;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(user);
  }

  // Pilih grup yang memiliki minimal 10 username berbeda.
  // Prioritaskan grup terbesar; jika seri, pertahankan urutan kemunculan data.
  let selected = null;
  for (const [base, members] of groups) {
    const unique = [...new Map(members.map(name => [normalizeTargetName(name), name])).values()];
    if (unique.length < 10) continue;
    if (!selected || unique.length > selected.members.length) {
      selected = { base, members: unique };
    }
  }

  if (selected) {
    // Auto Target hanya mengambil username yang mempunyai nomor.
    // Username dasar tanpa nomor TIDAK boleh masuk Target.
    // Contoh: kima, kima1 ... kima10 -> Target = kima1 ... kima10.
    const numbered = selected.members.filter(name => {
      const normalized = normalizeTargetName(name);
      return /\d/.test(normalized);
    });

    // Urutkan berdasarkan angka username, sehingga 1..10 tidak menjadi 1,10,2...
    numbered.sort((a, b) => {
      const na = normalizeTargetName(a), nb = normalizeTargetName(b);
      const numsA = (na.match(/\d+/g) || []).map(Number);
      const numsB = (nb.match(/\d+/g) || []).map(Number);
      const len = Math.max(numsA.length, numsB.length);
      for (let i = 0; i < len; i++) {
        const da = numsA[i] ?? -1, db = numsB[i] ?? -1;
        if (da !== db) return da - db;
      }
      return na.localeCompare(nb);
    });

    // Ambil tepat 10 target bernomor. Jika belum ada 10 username bernomor,
    // jangan membuat Target Kick parsial.
    if (numbered.length >= 10) {
      targets.push(...numbered.slice(0, 10));
    }
  }

  renderTargets();
}
function renderTargets(){
  el("targetList").innerHTML = targets.length ? targets.map((n, i) => `
    <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800/80">
      <span class="text-[11px] font-mono font-bold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">${String(i+1).padStart(2,"0")}</span>
      <span class="text-xs sm:text-sm text-slate-200 truncate flex-1">${esc(n)}</span>
    </div>
  `).join("") : '<div class="flex items-center justify-center h-full text-xs text-slate-500 py-10">Belum ada target.</div>';
}

function clearTargets(){
  targets.length = 0;
  renderTargets();
}

async function loginOne(i){
  sync();
  const a = accounts[i];
  if(!a.username || !a.password){ ; return; }
  if(a.sessionId) await logoutOne(i, true);
  setStatus(i, "LOGIN…");
  try{
    const r = await fetch("/api/login", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:a.username, password:a.password})});
    const j = await r.json();
    if(!j.ok){
      const err = new Error(j.error || "Login gagal");
      err.loginStatus = String(j.status || "error").toUpperCase();
      throw err;
    }
    a.sessionId = j.account.sessionId;
    const w = j.account.wallet;
    if(w?.balance_cr != null) setBalance(i, w.balance_cr);
    else if(w?.label) setBalance(i, w.label);
    else setBalance(i, "-");
    setStatus(i, "ONLINE");
    openEvents(i);
  }catch(e){
    const status = e.loginStatus === "SUSPEND" ? "SUSPEND" : "ERROR";
    setStatus(i, status);
  }
}

async function logoutOne(i, silent=false){
  const a = accounts[i];
  if(a.eventSource) try{ a.eventSource.close(); }catch{}
  a.eventSource = null;
  if(a.sessionId){
    try{ await fetch("/api/logout", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sessionId:a.sessionId})}); }catch{}
  }
  a.sessionId = null;
  setStatus(i, "OFFLINE");
  setBalance(i, "-");
  if(!silent) ;
}

async function batchAction(action, extra={}){
  const ids = accounts.map(a => a.sessionId).filter(Boolean);
  if(!ids.length){ ; return null; }
  try{
    const r = await fetch("/api/batch-action", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sessionIds:ids, action, ...extra})});
    const j = await r.json();
    if(!j.ok){ ; return null; }
    return j;
  }catch(e){
    return null;
  }
}

async function loginAll(){
  sync();
  const list = accounts.map((a, i) => ({index:i, username:a.username, password:a.password, sessionId:a.sessionId})).filter(a => a.username && a.password);
  if(!list.length){ ; return; }
  list.forEach(a => setStatus(a.index, "LOGIN…"));
  try{
    const r = await fetch("/api/login-batch", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({accounts:list})});
    const j = await r.json();
    for(const item of (j.results || [])){
      const i = item.index;
      if(item.ok){
        accounts[i].sessionId = item.account.sessionId;
        const w = item.account.wallet;
        if(w?.balance_cr != null) setBalance(i, w.balance_cr);
        else if(w?.label) setBalance(i, w.label);
        else setBalance(i, "-");
        setStatus(i, "ONLINE");
        openEvents(i);
          } else {
        accounts[i].sessionId = null;
        const status = String(item.status || "error").toUpperCase() === "SUSPEND" ? "SUSPEND" : "ERROR";
        setStatus(i, status);
        setBalance(i, "-");
      }
    }
    const ok = (j.results || []).filter(x => x.ok).length;
    const total = (j.results || []).length;
    for(const item of (j.results || [])) if(!item.ok) ;
  }catch(e){
    for(const a of list) setStatus(a.index, "ERROR");
  }
  resetKickAllProgress("Progress KICK ALL di-reset setelah LOGIN ALL.");
}

function toggleAccountCommands(){
  const panel = el("mainControlPanel");
  const box = el("accountCommandBox");
  const button = el("toggleAccountCommands");
  const icon = el("toggleAccountCommandsIcon");
  if(!panel || !box) return;

  const collapsed = panel.classList.toggle("commands-collapsed");
  box.classList.toggle("commands-collapsed", collapsed);

  if(button){
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = collapsed ? "Tampilkan semua" : "Sembunyikan bagian atas";
    button.setAttribute("aria-label", collapsed ? "Tampilkan semua" : "Sembunyikan bagian atas");
  }

  if(icon){
    icon.innerHTML = collapsed
      ? '<path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>'
      : '<path stroke-linecap="round" stroke-linejoin="round" d="m6 15 6-6 6 6"/>';
  }
}

async function logoutAll(){
  // Invalidate session IDs BEFORE closing EventSource.
  const ids = accounts.map(a => a.sessionId).filter(Boolean);
  const previous = accounts.map(a => ({ sessionId: a.sessionId, eventSource: a.eventSource }));

  for(const a of accounts){
    a.sessionId = null;
    a.eventSource = null;
  }

  for(const item of previous){
    if(item.eventSource) try{ item.eventSource.close(); }catch{}
  }

  for(let i=0; i<accounts.length; i++){
    setStatus(i, "OFFLINE");
    setBalance(i, "-");
  }

  let result = null;
  try{
    const r = await fetch("/api/logout-batch", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sessionIds:ids})
    });
    result = await r.json();
  }catch{}

  resetKickAllProgress("Progress KICK ALL di-reset karena semua WebSocket logout.");
  return result;
}

el("resetTimerButton")?.addEventListener("click", resetTimer);
el("generateTroop").onclick = generateTroop;
el("generatePassword").onclick = generatePassword;
el("clearFields").onclick = clearFields;

el("saveSet").onclick = function(){
  let name = el("setName").value.trim() || "set1";
  name = name.replace(/\.json$/i, "") || "set1";
  const data = {
    app: "MIGMASTER SET",
    version: 1,
    savedAt: new Date().toISOString(),
    kickTimer: el("kickTimer")?.value ?? "60000",
    textdelay: el("textdelay")?.value ?? "15",
    delayBatch: el("delayBatch")?.value ?? "25",
    textloop: el("textloop")?.value ?? "30",
    burstSize: el("burstSize")?.value ?? "3"
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".json";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
};

el("loadSet").onclick = ()=> el("loadSetFile").click();
el("loadSetFile").onchange = e => {
  const file = e.target.files[0];
  if(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(data.kickTimer != null) el("kickTimer").value = String(data.kickTimer);
        if(data.textdelay != null) el("textdelay").value = String(data.textdelay);
        if(data.delayBatch != null) el("delayBatch").value = String(data.delayBatch);
        if(data.textloop != null) el("textloop").value = String(data.textloop);
        if(data.burstSize != null) el("burstSize").value = String(data.burstSize);
        const base = file.name.replace(/\.json$/i, "");
        el("setName").value = base || "set1";
      }catch(err){}
    };
    reader.readAsText(file);
  }
  e.target.value = "";
};

el("saveAccounts").onclick = function(){
  sync();
  let name = el("saveName").value.trim() || "troop1";
  name = name.replace(/\.json$/i, "") || "troop1";
  const data = {
    app: "MIGMASTER PROTOTIPE 1.0",
    version: 5,
    savedAt: new Date().toISOString(),
    mainTroop: el("mainTroop").value.trim(),
    mainPassword: el("mainPassword").value,
    rangeStart: el("rangeStart").value,
    rangeEnd: el("rangeEnd").value,
    accounts: accounts.map(a => ({username:a.username, password:a.password}))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".json";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
};

el("loadAccounts").onclick = ()=> el("loadFile").click();
el("loadFile").onchange = e => {
  const file = e.target.files[0];
  if(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(!Array.isArray(data.accounts)) throw new Error("Format save tidak valid.");
        el("mainTroop").value = String(data.mainTroop || "");
        el("mainPassword").value = String(data.mainPassword || "");
        el("rangeStart").value = String(data.rangeStart ?? "1");
        el("rangeEnd").value = String(data.rangeEnd ?? "10");
        for(let i=0; i<10; i++){
          const a = data.accounts[i] || {};
          accounts[i].username = String(a.username || "");
          accounts[i].password = String(a.password || "");
          accounts[i].balance = "-";
        }
        const base = file.name.replace(/\.json$/i, "");
        el("saveName").value = base || "troop1";
        renderAccounts();
      }catch(err){
      }
    };
    reader.readAsText(file);
  }
  e.target.value = "";
};

el("loginAll").onclick = loginAll;
el("logoutAll").onclick = logoutAll;

async function joinAll(){
  const room = el("room").value.trim().replace(/\s+/g, " ");
  const statusEl = el("roomJoinStatus");
  if(!room){ if(statusEl) statusEl.textContent = "Room wajib diisi"; return; }
  if(statusEl) statusEl.textContent = "JOIN…";
  const result = await batchAction("join", {room});
  if(!result){ if(statusEl) statusEl.textContent = "JOIN gagal"; return; }

  const okResults = (result.results || []).filter(x => x.ok && x.sessionId);
  if(!okResults.length){
    if(statusEl) statusEl.textContent = "Tidak ada WebSocket aktif";
    return;
  }

  // batch-action hanya memastikan command berhasil dikirim. Verifikasi status
  // join per WebSocket supaya UI tidak menganggap room sudah masuk sebelum API
  // benar-benar mengirim room.join.result.
  const checks = await Promise.all(okResults.map(async item => {
    const deadline = Date.now() + 8500;
    while(Date.now() < deadline){
      try{
        const r = await fetch(`/api/room-status?sessionId=${encodeURIComponent(item.sessionId)}`, {cache:"no-store"});
        const j = await r.json();
        if(j.joinStatus === "joined") return j;
        if(j.joinStatus === "error") return j;
      }catch{}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return {joinStatus:"timeout", requestedRoom:room};
  }));

  const joined = checks.filter(x => x.joinStatus === "joined");
  const failed = checks.filter(x => x.joinStatus !== "joined");
  if(statusEl){
    if(joined.length && !failed.length) statusEl.textContent = `JOIN OK: ${joined[0].joinedRoom || room}`;
    else if(joined.length) statusEl.textContent = `JOIN ${joined.length}/${checks.length}: ${joined[0].joinedRoom || room}`;
    else statusEl.textContent = failed[0]?.joinError || `JOIN gagal: ${failed[0]?.joinStatus || "timeout"}`;
  }
}

async function leaveAll(){
  const room = el("room").value.trim();
  if(!room){ ; return; }
  await batchAction("leave", {room});
  resetKickAllProgress("Progress KICK ALL di-reset karena semua WebSocket meninggalkan room.");
}



async function participants(){
  const room = el("room").value.trim();
  if(!room){ ; return; }
  clearParticipants();
  const sessionId = accounts.map(a => a.sessionId).filter(Boolean)[0];
  if(!sessionId){ ; return; }
  try{
    const r = await fetch("/api/action", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sessionId, action:"participants", room})});
    const j = await r.json();
    if(!j.ok){ ; return; }
    const list = extractParticipantNames(j.event || j);
    if(list.length){
      renderParticipants(list, false);
    } else {
      el("participantsList").innerHTML = '<div class="flex items-center justify-center h-full text-xs text-slate-500 py-10">Tidak ada peserta.</div>';
    }
  }catch(e){
  }
}

async function balanceAll(){
  const online = accounts.map((a, i) => ({i, sessionId:a.sessionId})).filter(x => x.sessionId);
  if(!online.length){ ; return; }
  // Saldo tidak bergantung pada satu SSE event-source. Backend menunggu
  // wallet.balance.result untuk setiap session dan mengembalikan hasilnya.
  try{
    const r = await fetch("/api/balance-all", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sessionIds:online.map(x => x.sessionId)})
    });
    const j = await r.json();
    const bySession = new Map((j.results || []).map(x => [x.sessionId, x]));
    let ok = 0;
    for(const item of online){
      const result = bySession.get(item.sessionId);
      if(result?.ok){
        const w = result.wallet || {};
        if(w.balance_cr != null) setBalance(item.i, w.balance_cr);
        else if(w.label) setBalance(item.i, w.label);
        else setBalance(item.i, "-");
        ok++;
      }else{
        setBalance(item.i, "-");
      }
    }
  }catch(e){
  }
}

function resetPerTroopKickProgress(){
  for(let i=0;i<10;i++){
    const bar=el(`kickTroopProgressBar${i}`);
    const txt=el(`kickTroopProgressText${i}`);
    const fail=el(`kickTroopProgressFail${i}`);
    if(bar) bar.style.width="0%";
    if(txt) txt.textContent="0/0";
    if(fail) fail.textContent="";
  }
}

function updatePerTroopKickProgress(wsProgress){
  if(!Array.isArray(wsProgress)) return;
  wsProgress.forEach(tp=>{
    const i=Math.max(0,Number(tp.websocket||0)-1);
    if(i<0 || i>=10) return;
    const completed=Math.max(0,Number(tp.completed)||0);
    const dispatched=Math.max(completed,Number(tp.dispatched)||0);
    const failed=Math.max(0,Number(tp.failed)||0);
    const total=Math.max(0,Number(tp.total)||0);
    const pct=total>0 ? Math.min(100,Math.round((dispatched/total)*100)) : 0;
    const bar=el(`kickTroopProgressBar${i}`);
    const txt=el(`kickTroopProgressText${i}`);
    const fail=el(`kickTroopProgressFail${i}`);
    if(bar){
      bar.style.width=`${pct}%`;
      bar.classList.toggle("has-failure",failed>0);
    }
    if(txt) txt.textContent=`${dispatched}/${total}`;
    if(fail) fail.textContent=failed>0 ? `gagal ${failed}` : "";
  });
}

function resetKickAllProgress(reason = "Menunggu perintah kick...") {
  // Hentikan polling progress yang sedang berjalan.
  if (typeof window.stopKickProgressPolling === "function") {
    window.stopKickProgressPolling();
  }
  const bar = el("kickProgressBar");
  const txt = el("kickProgressText");
  const meta = el("kickProgressMeta");
  const step = el("kickProgressStep");
  if (bar) bar.style.width = "0%";
  if (txt) txt.textContent = "Siap";
  if (step) step.textContent = "Target 0/0";
  const targetProgress = el("kickTargetProgress");
  if (targetProgress) targetProgress.innerHTML = "";
  resetPerTroopKickProgress();
  if (meta) meta.textContent = reason;
}

async function kickSelectedTargets(){
  const room = el("room").value.trim();
  if(!room){ ; return; }
  if(!targets.length){ ; return; }

  const textdelay = Math.max(0, parseInt(el("textdelay")?.value || "15", 10) || 0);
  const delayBatch = Math.max(0, parseInt(el("delayBatch")?.value || "25", 10) || 0);
  const textloop = Math.max(1, parseInt(el("textloop")?.value || "1", 10) || 1);
  const burstSize = Math.max(1, Math.min(10, parseInt(el("burstSize")?.value || "10", 10) || 3));
  // Limit KICK ditentukan backend secara authoritative:
  // WS1 100/900ms, WS2 100/910ms, ... WS10 100/990ms.
  // Frontend tidak mengirim nilai limit agar limit tidak dapat diubah dari client.
  const onlineSlots = accounts
    .map((a, i) => a.sessionId ? { sessionId: a.sessionId, websocket: i + 1 } : null)
    .filter(Boolean);
  const wsCount = onlineSlots.length;
  const total = textloop * targets.length;
  const bar = el("kickProgressBar"), txt = el("kickProgressText"), meta = el("kickProgressMeta");
  const step = el("kickProgressStep");
  const targetProgressBox = el("kickTargetProgress");
  resetPerTroopKickProgress();
  for(let i=0;i<wsCount;i++){
    const txt=el(`kickTroopProgressText${i}`);
    if(txt) txt.textContent=`0/${total}`;
  }
  if (targetProgressBox) {
    targetProgressBox.innerHTML = targets.map((t, i) => `<div data-kick-target="${i+1}" class="rounded-md border border-slate-800 bg-slate-900/70 px-1.5 py-1 text-[9px] text-slate-400 text-center truncate">T${i+1} <span>0/${textloop * wsCount}</span></div>`).join("");
  }
  bar.style.width = "0%";
  txt.textContent = "Memulai";
  step.textContent = `Target 0/${targets.length * textloop}`;
  meta.textContent = `Menyiapkan ${targets.length} target × ${textloop} loop • burst ${burstSize} • delay target ${textdelay} ms • batch ${delayBatch} ms`;

  try{
    const r = await fetch("/api/kick-loop", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        sessionIds: onlineSlots.map(x=>x.sessionId),
        websocketSlots: onlineSlots,
        room, targets:[...targets], textdelay, delayBatch, textloop, burstSize
      })
    });
    const j = await r.json();
    if(!j.ok || !j.executionId){
      txt.textContent = "Gagal";
      meta.textContent = j.error || "Gagal memulai KICK ALL.";
      return;
    }

    // Gunakan SSE untuk menerima progress KICK ALL secara realtime.
    // Tidak ada polling HTTP berulang setiap 100 ms.
    let progressStopped = false;
    let progressSource = null;

    window.stopKickProgressPolling = () => {
      progressStopped = true;
      if (progressSource) progressSource.close();
      progressSource = null;
    };

    const applyProgressState = (state) => {
      if (progressStopped) return;
      const p = state.progress || {};
      if (p.type !== "kick.progress") return;

      if (Array.isArray(p.wsProgress)) updatePerTroopKickProgress(p.wsProgress);

      if (targetProgressBox && Array.isArray(p.targetProgress)) {
        p.targetProgress.forEach(tp => {
          const cell = targetProgressBox.querySelector(`[data-kick-target="${tp.targetIndex}"]`);
          if (!cell) return;
          const span = cell.querySelector("span");
          const done = Number(tp.completed) || 0;
          const dispatched = Math.max(done, Number(tp.dispatched) || 0);
          const total = Number(tp.total) || (textloop * wsCount);
          if (span) span.textContent = `${dispatched}/${total}`;
          cell.className = `rounded-md border px-1.5 py-1 text-[9px] text-center truncate ${dispatched >= total ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300" : dispatched > 0 ? "border-blue-700/60 bg-blue-950/30 text-blue-300" : "border-slate-800 bg-slate-900/70 text-slate-400"}`;
        });
      }

      const dispatchTotal = Number(p.totalJobs) || 0;
      const dispatchCount = Number(p.dispatchedJobs);
      const fallbackPercent = Number(p.percent) || 0;
      const percent = dispatchTotal > 0 && Number.isFinite(dispatchCount)
        ? Math.max(0, Math.min(100, Math.round((dispatchCount / dispatchTotal) * 100)))
        : Math.max(0, Math.min(100, fallbackPercent));
      bar.style.width = `${percent}%`;
      bar.style.transition = "width 100ms linear";

      if(p.phase === "started" || p.phase === "connected") txt.textContent = "Berjalan";
      else if(p.phase === "dispatched") txt.textContent = "KICK DIKIRIM";
      else if(p.phase === "send_failed") txt.textContent = "KICK GAGAL";
      else if(p.phase === "delay") txt.textContent = "Delay";
      else if(p.phase === "completed") txt.textContent = "Selesai";
      else if(p.phase === "completed_with_errors") txt.textContent = "Selesai • Ada Gagal";
      else if(p.phase === "failed") txt.textContent = "Gagal";

      const done = Number(p.completedSteps) || 0;
      const totalSteps = Number(p.totalSteps) || total;
      step.textContent = `Target ${done}/${totalSteps}`;

      if(p.phase === "delay") {
        meta.textContent = p.burstSize ? `Burst ${p.burst}/${p.burstTotal} • Loop ${p.loop}/${p.loopTotal || textloop} • delay target ${p.targetDelayMs ?? textdelay} ms • batch ${p.delayMs ?? delayBatch} ms` : `Loop ${p.loop}/${textloop} selesai • delay target ${p.targetDelayMs ?? textdelay} ms • batch ${p.delayMs ?? delayBatch} ms`;
      } else if(p.phase === "completed" || p.phase === "completed_with_errors") {
        if (p.phase === "completed") bar.style.width = "100%";
        meta.textContent = `${totalSteps}/${totalSteps} target batch selesai • ${textloop} loop • burst ${burstSize} • delay target ${textdelay} ms • batch ${delayBatch} ms`;
        stopProgress();
      } else if(p.phase === "failed" || p.phase === "error") {
        meta.textContent = p.error || "Eksekusi KICK ALL gagal.";
        stopProgress();
      }

      if(state.done && p.phase !== "completed" && p.phase !== "completed_with_errors" && p.phase !== "failed" && p.phase !== "error") stopProgress();
    };

    const stopProgress = () => {
      progressStopped = true;
      if(progressSource) progressSource.close();
      progressSource = null;
      if(window.stopKickProgressPolling) window.stopKickProgressPolling = null;
    };

    progressSource = new EventSource(`/api/kick-progress-stream?id=${encodeURIComponent(j.executionId)}`);
    progressSource.onmessage = (event) => {
      try { applyProgressState(JSON.parse(event.data)); }
      catch(e) { if(!progressStopped) meta.textContent = "Memuat progress backend…"; }
    };
    progressSource.onerror = () => {
      if(!progressStopped) meta.textContent = "Koneksi progress backend terputus…";
    };

  }catch(e){
    txt.textContent = "Gagal";
    meta.textContent = e.message;
  }
}

renderAccounts();
renderTargets();
renderTimer();
renderSuicideToggle();
