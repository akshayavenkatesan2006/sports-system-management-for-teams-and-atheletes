# 🏆 Sports Management System

## Project Structure

```
sports_management/
├── app.py              ← Flask backend (all APIs)
├── database.db         ← SQLite database (auto-created)
├── start.bat           ← Run script for Windows
├── README.md
├── templates/
│   └── index.html      ← Main UI
└── static/
    ├── style.css       ← Styling
    └── script.js       ← Frontend logic
```

## Modules

| Module     | Features |
|------------|----------|
| Dashboard  | Stats overview, quick start guide |
| Teams      | Add/Edit/Delete/Search teams |
| Athletes   | Add/Edit/Delete/Search, assign to teams |
| Coaches    | Add/Edit/Delete/Search, assign to teams |
| Events     | Add/Edit/Delete/Search, link multiple teams |
| Queries    | SQL JOIN and GROUP BY analytics |
| Records    | Combined view of athletes + coaches |
| History    | Audit log of all actions |

## Database Tables

- `teams` (team_id PK, team_name)
- `athletes` (athlete_id PK, name, age, team_id FK)
- `coaches` (coach_id PK, name, team_id FK)
- `events` (event_id PK, event_name, event_date)
- `event_teams` (event_id FK, team_id FK)
- `history` (id, action, module, details, timestamp)

