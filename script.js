// ── STATE ────────────────────────────────────────────────────────────────────
let editingTeam = null, editingAthlete = null, editingCoach = null, editingEvent = null;
let deleteCallback = null;

// ── MODULE SWITCH ────────────────────────────────────────────────────────────
function switchModule(name, navEl) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const mod = document.getElementById('mod-' + name);
  if (mod) mod.classList.add('active');

  if (navEl) navEl.classList.add('active');
  else {
    const el = document.querySelector(`[data-module="${name}"]`);
    if (el) el.classList.add('active');
  }

  // Load data on switch
  if (name === 'dashboard') loadStats();
  if (name === 'teams')     loadTeams();
  if (name === 'athletes')  { loadTeams(); loadAthletes(); }
  if (name === 'coaches')   { loadTeams(); loadCoaches(); }
  if (name === 'events')    { loadTeams(); loadEvents(); }
  if (name === 'records')   loadRecords();
  if (name === 'history')   loadHistory();
}

// ── API HELPER ───────────────────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

// ── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── CONFIRM MODAL ────────────────────────────────────────────────────────────
function confirm(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-modal').classList.add('active');
  deleteCallback = cb;
}
function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('active');
  deleteCallback = null;
}
function doDelete() {
  if (deleteCallback) deleteCallback();
  closeConfirm();
}

// ── STATS ────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api('/api/stats');
    ['teams','athletes','coaches','events'].forEach(k => {
      document.getElementById('d-'+k).textContent = s[k];
      document.getElementById('s-'+k).textContent = s[k];
    });
    document.getElementById('d-upcoming').textContent = s.upcoming_events;
  } catch(e) { console.error(e); }
}

// ── TEAMS ────────────────────────────────────────────────────────────────────
async function loadTeams() {
  const search = document.getElementById('team-search')?.value || '';
  try {
    const rows = await api(`/api/teams?search=${encodeURIComponent(search)}`);
    const tbody = document.getElementById('teams-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No teams found</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><code style="color:var(--accent);background:rgba(245,166,35,0.1);padding:2px 6px;border-radius:4px;font-size:12px">${r.team_id}</code></td>
        <td>${r.team_name}</td>
        <td>
          <button class="btn btn-edit" onclick="editTeam('${r.team_id}','${r.team_name.replace(/'/g,"\\'")}')">Edit</button>
          <button class="btn btn-del" onclick="confirmDelete('team','${r.team_id}','${r.team_name.replace(/'/g,"\\'")}')">Delete</button>
        </td>
      </tr>`).join('');

    // Populate team dropdowns
    const opts = `<option value="">-- No Team --</option>` + rows.map(r =>
      `<option value="${r.team_id}">${r.team_name}</option>`).join('');
    ['athlete-team','coach-team'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { const v = el.value; el.innerHTML = opts; el.value = v; }
    });
    const etEl = document.getElementById('event-teams');
    if (etEl) etEl.innerHTML = rows.map(r =>
      `<option value="${r.team_id}">${r.team_name}</option>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

async function saveTeam() {
  const id = document.getElementById('team-id').value.trim();
  const name = document.getElementById('team-name').value.trim();
  if (!id || !name) return toast('All fields are required','error');
  try {
    if (editingTeam) {
      await api(`/api/teams/${editingTeam}`, 'PUT', { team_name: name });
      toast('Team updated successfully');
    } else {
      await api('/api/teams', 'POST', { team_id: id, team_name: name });
      toast('Team added successfully');
    }
    clearTeamForm();
    loadTeams();
    loadStats();
  } catch(e) { toast(e.message,'error'); }
}

function editTeam(id, name) {
  editingTeam = id;
  document.getElementById('team-id').value = id;
  document.getElementById('team-id').disabled = true;
  document.getElementById('team-name').value = name;
  document.getElementById('team-form-title').textContent = `Edit Team: ${id}`;
}

function clearTeamForm() {
  editingTeam = null;
  document.getElementById('team-id').value = '';
  document.getElementById('team-id').disabled = false;
  document.getElementById('team-name').value = '';
  document.getElementById('team-form-title').textContent = 'Add New Team';
}

function confirmDelete(type, id, name) {
  confirm(`Delete ${type}: "${name}" (${id})? This cannot be undone.`, async () => {
    try {
      await api(`/api/${type}s/${id}`, 'DELETE');
      toast(`${type.charAt(0).toUpperCase()+type.slice(1)} deleted`);
      if (type === 'team')    { loadTeams(); loadStats(); }
      if (type === 'athlete') { loadAthletes(); loadStats(); }
      if (type === 'coach')   { loadCoaches(); loadStats(); }
      if (type === 'event')   { loadEvents(); loadStats(); }
    } catch(e) { toast(e.message,'error'); }
  });
}

// ── ATHLETES ──────────────────────────────────────────────────────────────────
async function loadAthletes() {
  const search = document.getElementById('athlete-search')?.value || '';
  try {
    const rows = await api(`/api/athletes?search=${encodeURIComponent(search)}`);
    const tbody = document.getElementById('athletes-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No athletes found</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><code style="color:var(--accent);background:rgba(245,166,35,0.1);padding:2px 6px;border-radius:4px;font-size:12px">${r.athlete_id}</code></td>
        <td>${r.name}</td>
        <td>${r.age}</td>
        <td>${r.team_name ? `<span class="team-tag">${r.team_name}</span>` : '<span style="color:var(--text2);font-size:12px">—</span>'}</td>
        <td>
          <button class="btn btn-edit" onclick="editAthlete(${JSON.stringify(r).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-del"  onclick="confirmDelete('athlete','${r.athlete_id}','${r.name.replace(/'/g,"\\'")}')">Delete</button>
        </td>
      </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

async function saveAthlete() {
  const id   = document.getElementById('athlete-id').value.trim();
  const name = document.getElementById('athlete-name').value.trim();
  const age  = document.getElementById('athlete-age').value;
  const team = document.getElementById('athlete-team').value;
  if (!name || !age || (!editingAthlete && !id)) return toast('All required fields must be filled','error');
  try {
    if (editingAthlete) {
      await api(`/api/athletes/${editingAthlete}`, 'PUT', { name, age: parseInt(age), team_id: team || null });
      toast('Athlete updated');
    } else {
      await api('/api/athletes', 'POST', { athlete_id: id, name, age: parseInt(age), team_id: team || null });
      toast('Athlete added');
    }
    clearAthleteForm();
    loadAthletes();
    loadStats();
  } catch(e) { toast(e.message,'error'); }
}

function editAthlete(r) {
  editingAthlete = r.athlete_id;
  document.getElementById('athlete-id').value = r.athlete_id;
  document.getElementById('athlete-id').disabled = true;
  document.getElementById('athlete-name').value = r.name;
  document.getElementById('athlete-age').value = r.age;
  document.getElementById('athlete-team').value = r.team_id || '';
  document.getElementById('athlete-form-title').textContent = `Edit Athlete: ${r.athlete_id}`;
}

function clearAthleteForm() {
  editingAthlete = null;
  ['athlete-id','athlete-name','athlete-age'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('athlete-id').disabled = false;
  document.getElementById('athlete-team').value = '';
  document.getElementById('athlete-form-title').textContent = 'Add New Athlete';
}

// ── COACHES ───────────────────────────────────────────────────────────────────
async function loadCoaches() {
  const search = document.getElementById('coach-search')?.value || '';
  try {
    const rows = await api(`/api/coaches?search=${encodeURIComponent(search)}`);
    const tbody = document.getElementById('coaches-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No coaches found</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><code style="color:var(--accent);background:rgba(245,166,35,0.1);padding:2px 6px;border-radius:4px;font-size:12px">${r.coach_id}</code></td>
        <td>${r.name}</td>
        <td>${r.team_name ? `<span class="team-tag">${r.team_name}</span>` : '<span style="color:var(--text2);font-size:12px">—</span>'}</td>
        <td>
          <button class="btn btn-edit" onclick="editCoach(${JSON.stringify(r).replace(/"/g,'&quot;')})">Edit</button>
          <button class="btn btn-del"  onclick="confirmDelete('coach','${r.coach_id}','${r.name.replace(/'/g,"\\'")}')">Delete</button>
        </td>
      </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

async function saveCoach() {
  const id   = document.getElementById('coach-id').value.trim();
  const name = document.getElementById('coach-name').value.trim();
  const team = document.getElementById('coach-team').value;
  if (!name || (!editingCoach && !id)) return toast('All required fields must be filled','error');
  try {
    if (editingCoach) {
      await api(`/api/coaches/${editingCoach}`, 'PUT', { name, team_id: team || null });
      toast('Coach updated');
    } else {
      await api('/api/coaches', 'POST', { coach_id: id, name, team_id: team || null });
      toast('Coach added');
    }
    clearCoachForm();
    loadCoaches();
    loadStats();
  } catch(e) { toast(e.message,'error'); }
}

function editCoach(r) {
  editingCoach = r.coach_id;
  document.getElementById('coach-id').value = r.coach_id;
  document.getElementById('coach-id').disabled = true;
  document.getElementById('coach-name').value = r.name;
  document.getElementById('coach-team').value = r.team_id || '';
  document.getElementById('coach-form-title').textContent = `Edit Coach: ${r.coach_id}`;
}

function clearCoachForm() {
  editingCoach = null;
  ['coach-id','coach-name'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('coach-id').disabled = false;
  document.getElementById('coach-team').value = '';
  document.getElementById('coach-form-title').textContent = 'Add New Coach';
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
async function loadEvents() {
  const search = document.getElementById('event-search')?.value || '';
  try {
    const rows = await api(`/api/events?search=${encodeURIComponent(search)}`);
    const tbody = document.getElementById('events-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No events found</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><code style="color:var(--accent);background:rgba(245,166,35,0.1);padding:2px 6px;border-radius:4px;font-size:12px">${r.event_id}</code></td>
        <td>${r.event_name}</td>
        <td>${r.event_date}</td>
        <td>${(r.teams||[]).map(t=>`<span class="team-tag">${t.team_name}</span>`).join('')||'<span style="color:var(--text2);font-size:12px">None</span>'}</td>
        <td>
          <button class="btn btn-edit" onclick='editEvent(${JSON.stringify(r).replace(/'/g,"\\'")})'> Edit</button>
          <button class="btn btn-del"  onclick="confirmDelete('event','${r.event_id}','${r.event_name.replace(/'/g,"\\'")}')">Delete</button>
        </td>
      </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

async function saveEvent() {
  const id   = document.getElementById('event-id').value.trim();
  const name = document.getElementById('event-name').value.trim();
  const date = document.getElementById('event-date').value;
  const sel  = document.getElementById('event-teams');
  const teamIds = Array.from(sel.selectedOptions).map(o => o.value);
  if (!name || !date || (!editingEvent && !id)) return toast('All required fields must be filled','error');
  try {
    if (editingEvent) {
      await api(`/api/events/${editingEvent}`, 'PUT', { event_name: name, event_date: date, team_ids: teamIds });
      toast('Event updated');
    } else {
      await api('/api/events', 'POST', { event_id: id, event_name: name, event_date: date, team_ids: teamIds });
      toast('Event added');
    }
    clearEventForm();
    loadEvents();
    loadStats();
  } catch(e) { toast(e.message,'error'); }
}

function editEvent(r) {
  editingEvent = r.event_id;
  document.getElementById('event-id').value = r.event_id;
  document.getElementById('event-id').disabled = true;
  document.getElementById('event-name').value = r.event_name;
  document.getElementById('event-date').value = r.event_date;
  const sel = document.getElementById('event-teams');
  const ids = (r.teams||[]).map(t=>t.team_id);
  Array.from(sel.options).forEach(o => o.selected = ids.includes(o.value));
  document.getElementById('event-form-title').textContent = `Edit Event: ${r.event_id}`;
}

function clearEventForm() {
  editingEvent = null;
  ['event-id','event-name','event-date'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('event-id').disabled = false;
  document.getElementById('event-form-title').textContent = 'Add New Event';
  const sel = document.getElementById('event-teams');
  Array.from(sel.options).forEach(o => o.selected = false);
}

// ── QUERIES ───────────────────────────────────────────────────────────────────
const queryTitles = {
  athletes_with_teams: 'Athletes with Teams (JOIN)',
  athletes_per_team:   'Athletes per Team (GROUP BY)',
  coaches_per_team:    'Coaches per Team (GROUP BY)',
  events_with_teams:   'Events with Team Count (JOIN + GROUP BY)'
};

async function runQuery(name) {
  try {
    const rows = await api(`/api/queries/${name}`);
    const card = document.getElementById('query-result-card');
    card.style.display = 'block';
    document.getElementById('query-title').textContent = queryTitles[name];
    document.getElementById('query-count').textContent = `${rows.length} rows`;
    if (!rows.length) {
      document.getElementById('query-table-container').innerHTML =
        `<p style="padding:20px;color:var(--text2)">No data available</p>`;
      return;
    }
    const headers = Object.keys(rows[0]);
    document.getElementById('query-table-container').innerHTML = `
      <table>
        <thead><tr>${headers.map(h=>`<th>${h.replace(/_/g,' ')}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${r[h] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
  } catch(e) { toast(e.message,'error'); }
}

// ── RECORDS ───────────────────────────────────────────────────────────────────
async function loadRecords() {
  const filter = document.getElementById('records-filter')?.value || '';
  try {
    let rows = await api('/api/records');
    if (filter) rows = rows.filter(r => r.type === filter);
    const tbody = document.getElementById('records-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No records found</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><code style="color:var(--accent);background:rgba(245,166,35,0.1);padding:2px 6px;border-radius:4px;font-size:12px">${r.id}</code></td>
        <td>${r.name}</td>
        <td><span class="action-tag ${r.type === 'Athlete' ? 'ADD' : 'UPDATE'}">${r.type}</span></td>
        <td>${r.team_name === 'Unassigned' ? '<span style="color:var(--text2);font-size:12px">Unassigned</span>' : `<span class="team-tag">${r.team_name}</span>`}</td>
      </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const rows = await api('/api/history');
    const tbody = document.getElementById('history-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No history yet</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="color:var(--text2);font-size:12px;white-space:nowrap">${new Date(r.timestamp).toLocaleString()}</td>
        <td><span class="action-tag ${r.action}">${r.action}</span></td>
        <td>${r.module}</td>
        <td>${r.details}</td>
      </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  // Set today's date as min for events
  const today = new Date().toISOString().split('T')[0];
  const eDateEl = document.getElementById('event-date');
  if (eDateEl) eDateEl.setAttribute('min', today);
});
