from flask import Flask, request, jsonify, render_template
import sqlite3
import os

app = Flask(__name__)
DB = 'database.db'

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS teams (
                team_id TEXT PRIMARY KEY,
                team_name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS athletes (
                athlete_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                team_id TEXT,
                FOREIGN KEY (team_id) REFERENCES teams(team_id)
            );
            CREATE TABLE IF NOT EXISTS coaches (
                coach_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                team_id TEXT,
                FOREIGN KEY (team_id) REFERENCES teams(team_id)
            );
            CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                event_name TEXT NOT NULL,
                event_date TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS event_teams (
                event_id TEXT,
                team_id TEXT,
                PRIMARY KEY (event_id, team_id),
                FOREIGN KEY (event_id) REFERENCES events(event_id),
                FOREIGN KEY (team_id) REFERENCES teams(team_id)
            );
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                module TEXT NOT NULL,
                details TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        ''')

@app.route('/')
def index():
    return render_template('index.html')

# ─── TEAMS ───────────────────────────────────────────────────────────────────

@app.route('/api/teams', methods=['GET'])
def get_teams():
    search = request.args.get('search', '')
    with get_db() as conn:
        if search:
            rows = conn.execute("SELECT * FROM teams WHERE team_id LIKE ? OR team_name LIKE ?",
                                (f'%{search}%', f'%{search}%')).fetchall()
        else:
            rows = conn.execute("SELECT * FROM teams").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/teams', methods=['POST'])
def add_team():
    data = request.json
    if not data.get('team_id') or not data.get('team_name'):
        return jsonify({'error': 'All fields are required'}), 400
    with get_db() as conn:
        existing = conn.execute("SELECT 1 FROM teams WHERE team_id=?", (data['team_id'],)).fetchone()
        if existing:
            return jsonify({'error': 'This ID already exists'}), 409
        conn.execute("INSERT INTO teams VALUES (?,?)", (data['team_id'], data['team_name']))
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('ADD', 'Teams', f"Added team {data['team_name']} ({data['team_id']})"))
    return jsonify({'message': 'Team added successfully'})

@app.route('/api/teams/<tid>', methods=['PUT'])
def update_team(tid):
    data = request.json
    if not data.get('team_name'):
        return jsonify({'error': 'Team name is required'}), 400
    with get_db() as conn:
        r = conn.execute("UPDATE teams SET team_name=? WHERE team_id=?", (data['team_name'], tid))
        if r.rowcount == 0:
            return jsonify({'error': 'Team not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('UPDATE', 'Teams', f"Updated team {tid} to {data['team_name']}"))
    return jsonify({'message': 'Team updated successfully'})

@app.route('/api/teams/<tid>', methods=['DELETE'])
def delete_team(tid):
    with get_db() as conn:
        r = conn.execute("DELETE FROM teams WHERE team_id=?", (tid,))
        if r.rowcount == 0:
            return jsonify({'error': 'Team not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('DELETE', 'Teams', f"Deleted team {tid}"))
    return jsonify({'message': 'Team deleted successfully'})

# ─── ATHLETES ────────────────────────────────────────────────────────────────

@app.route('/api/athletes', methods=['GET'])
def get_athletes():
    search = request.args.get('search', '')
    with get_db() as conn:
        if search:
            rows = conn.execute("""
                SELECT a.*, t.team_name FROM athletes a
                LEFT JOIN teams t ON a.team_id=t.team_id
                WHERE a.athlete_id LIKE ? OR a.name LIKE ? OR t.team_name LIKE ?
            """, (f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
        else:
            rows = conn.execute("""
                SELECT a.*, t.team_name FROM athletes a
                LEFT JOIN teams t ON a.team_id=t.team_id
            """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/athletes', methods=['POST'])
def add_athlete():
    data = request.json
    if not all([data.get('athlete_id'), data.get('name'), data.get('age')]):
        return jsonify({'error': 'All fields are required'}), 400
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM athletes WHERE athlete_id=?", (data['athlete_id'],)).fetchone():
            return jsonify({'error': 'This ID already exists'}), 409
        conn.execute("INSERT INTO athletes VALUES (?,?,?,?)",
                     (data['athlete_id'], data['name'], data['age'], data.get('team_id') or None))
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('ADD', 'Athletes', f"Added athlete {data['name']} ({data['athlete_id']})"))
    return jsonify({'message': 'Athlete added successfully'})

@app.route('/api/athletes/<aid>', methods=['PUT'])
def update_athlete(aid):
    data = request.json
    with get_db() as conn:
        r = conn.execute("UPDATE athletes SET name=?,age=?,team_id=? WHERE athlete_id=?",
                         (data['name'], data['age'], data.get('team_id') or None, aid))
        if r.rowcount == 0:
            return jsonify({'error': 'Athlete not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('UPDATE', 'Athletes', f"Updated athlete {aid}"))
    return jsonify({'message': 'Athlete updated successfully'})

@app.route('/api/athletes/<aid>', methods=['DELETE'])
def delete_athlete(aid):
    with get_db() as conn:
        r = conn.execute("DELETE FROM athletes WHERE athlete_id=?", (aid,))
        if r.rowcount == 0:
            return jsonify({'error': 'Athlete not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('DELETE', 'Athletes', f"Deleted athlete {aid}"))
    return jsonify({'message': 'Athlete deleted successfully'})

# ─── COACHES ─────────────────────────────────────────────────────────────────

@app.route('/api/coaches', methods=['GET'])
def get_coaches():
    search = request.args.get('search', '')
    with get_db() as conn:
        if search:
            rows = conn.execute("""
                SELECT c.*, t.team_name FROM coaches c
                LEFT JOIN teams t ON c.team_id=t.team_id
                WHERE c.coach_id LIKE ? OR c.name LIKE ? OR t.team_name LIKE ?
            """, (f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
        else:
            rows = conn.execute("""
                SELECT c.*, t.team_name FROM coaches c
                LEFT JOIN teams t ON c.team_id=t.team_id
            """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/coaches', methods=['POST'])
def add_coach():
    data = request.json
    if not all([data.get('coach_id'), data.get('name')]):
        return jsonify({'error': 'All fields are required'}), 400
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM coaches WHERE coach_id=?", (data['coach_id'],)).fetchone():
            return jsonify({'error': 'This ID already exists'}), 409
        conn.execute("INSERT INTO coaches VALUES (?,?,?)",
                     (data['coach_id'], data['name'], data.get('team_id') or None))
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('ADD', 'Coaches', f"Added coach {data['name']} ({data['coach_id']})"))
    return jsonify({'message': 'Coach added successfully'})

@app.route('/api/coaches/<cid>', methods=['PUT'])
def update_coach(cid):
    data = request.json
    with get_db() as conn:
        r = conn.execute("UPDATE coaches SET name=?,team_id=? WHERE coach_id=?",
                         (data['name'], data.get('team_id') or None, cid))
        if r.rowcount == 0:
            return jsonify({'error': 'Coach not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('UPDATE', 'Coaches', f"Updated coach {cid}"))
    return jsonify({'message': 'Coach updated successfully'})

@app.route('/api/coaches/<cid>', methods=['DELETE'])
def delete_coach(cid):
    with get_db() as conn:
        r = conn.execute("DELETE FROM coaches WHERE coach_id=?", (cid,))
        if r.rowcount == 0:
            return jsonify({'error': 'Coach not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('DELETE', 'Coaches', f"Deleted coach {cid}"))
    return jsonify({'message': 'Coach deleted successfully'})

# ─── EVENTS ──────────────────────────────────────────────────────────────────

@app.route('/api/events', methods=['GET'])
def get_events():
    search = request.args.get('search', '')
    with get_db() as conn:
        if search:
            rows = conn.execute("SELECT * FROM events WHERE event_id LIKE ? OR event_name LIKE ?",
                                (f'%{search}%', f'%{search}%')).fetchall()
        else:
            rows = conn.execute("SELECT * FROM events ORDER BY event_date").fetchall()
        events = [dict(r) for r in rows]
        for e in events:
            teams = conn.execute("""
                SELECT t.team_id, t.team_name FROM event_teams et
                JOIN teams t ON et.team_id=t.team_id WHERE et.event_id=?
            """, (e['event_id'],)).fetchall()
            e['teams'] = [dict(t) for t in teams]
    return jsonify(events)

@app.route('/api/events', methods=['POST'])
def add_event():
    data = request.json
    if not all([data.get('event_id'), data.get('event_name'), data.get('event_date')]):
        return jsonify({'error': 'All fields are required'}), 400
    with get_db() as conn:
        if conn.execute("SELECT 1 FROM events WHERE event_id=?", (data['event_id'],)).fetchone():
            return jsonify({'error': 'This ID already exists'}), 409
        conn.execute("INSERT INTO events VALUES (?,?,?)",
                     (data['event_id'], data['event_name'], data['event_date']))
        for tid in (data.get('team_ids') or []):
            conn.execute("INSERT OR IGNORE INTO event_teams VALUES (?,?)", (data['event_id'], tid))
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('ADD', 'Events', f"Added event {data['event_name']} ({data['event_id']})"))
    return jsonify({'message': 'Event added successfully'})

@app.route('/api/events/<eid>', methods=['PUT'])
def update_event(eid):
    data = request.json
    with get_db() as conn:
        r = conn.execute("UPDATE events SET event_name=?,event_date=? WHERE event_id=?",
                         (data['event_name'], data['event_date'], eid))
        if r.rowcount == 0:
            return jsonify({'error': 'Event not found'}), 404
        conn.execute("DELETE FROM event_teams WHERE event_id=?", (eid,))
        for tid in (data.get('team_ids') or []):
            conn.execute("INSERT OR IGNORE INTO event_teams VALUES (?,?)", (eid, tid))
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('UPDATE', 'Events', f"Updated event {eid}"))
    return jsonify({'message': 'Event updated successfully'})

@app.route('/api/events/<eid>', methods=['DELETE'])
def delete_event(eid):
    with get_db() as conn:
        conn.execute("DELETE FROM event_teams WHERE event_id=?", (eid,))
        r = conn.execute("DELETE FROM events WHERE event_id=?", (eid,))
        if r.rowcount == 0:
            return jsonify({'error': 'Event not found'}), 404
        conn.execute("INSERT INTO history (action,module,details) VALUES (?,?,?)",
                     ('DELETE', 'Events', f"Deleted event {eid}"))
    return jsonify({'message': 'Event deleted successfully'})

# ─── QUERIES ─────────────────────────────────────────────────────────────────

@app.route('/api/queries/athletes_with_teams', methods=['GET'])
def query_athletes_with_teams():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT a.athlete_id, a.name AS athlete_name, a.age, 
                   COALESCE(t.team_name, 'Unassigned') AS team_name
            FROM athletes a LEFT JOIN teams t ON a.team_id=t.team_id
            ORDER BY t.team_name, a.name
        """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/queries/athletes_per_team', methods=['GET'])
def query_athletes_per_team():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT t.team_name, COUNT(a.athlete_id) AS athlete_count
            FROM teams t LEFT JOIN athletes a ON t.team_id=a.team_id
            GROUP BY t.team_id, t.team_name ORDER BY athlete_count DESC
        """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/queries/coaches_per_team', methods=['GET'])
def query_coaches_per_team():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT t.team_name, COUNT(c.coach_id) AS coach_count
            FROM teams t LEFT JOIN coaches c ON t.team_id=c.team_id
            GROUP BY t.team_id, t.team_name ORDER BY coach_count DESC
        """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/queries/events_with_teams', methods=['GET'])
def query_events_with_teams():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT e.event_name, e.event_date, COUNT(et.team_id) AS team_count
            FROM events e LEFT JOIN event_teams et ON e.event_id=et.event_id
            GROUP BY e.event_id ORDER BY e.event_date
        """).fetchall()
    return jsonify([dict(r) for r in rows])

# ─── STATS & HISTORY ─────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def get_stats():
    with get_db() as conn:
        return jsonify({
            'teams': conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0],
            'athletes': conn.execute("SELECT COUNT(*) FROM athletes").fetchone()[0],
            'coaches': conn.execute("SELECT COUNT(*) FROM coaches").fetchone()[0],
            'events': conn.execute("SELECT COUNT(*) FROM events").fetchone()[0],
            'upcoming_events': conn.execute(
                "SELECT COUNT(*) FROM events WHERE event_date >= date('now')").fetchone()[0]
        })

@app.route('/api/history', methods=['GET'])
def get_history():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/records', methods=['GET'])
def get_records():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT a.athlete_id AS id, a.name, 'Athlete' AS type,
                   COALESCE(t.team_name,'Unassigned') AS team_name
            FROM athletes a LEFT JOIN teams t ON a.team_id=t.team_id
            UNION ALL
            SELECT c.coach_id, c.name, 'Coach',
                   COALESCE(t.team_name,'Unassigned')
            FROM coaches c LEFT JOIN teams t ON c.team_id=t.team_id
            ORDER BY type, name
        """).fetchall()
    return jsonify([dict(r) for r in rows])

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
