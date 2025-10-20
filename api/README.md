# Orion API (local)

This small API exposes /items and can seed/import CSV data into PostgreSQL.

Files:
- index.js - Express API with migration/seed
- import_csv.js - helper to import CSV (fallback mode uses inserts)
- .env.example - example env file

Quick run (Docker):

1. Copy your credentials to `.env` in this folder.
2. Start the API in Docker:

```powershell
docker run -d --name orion-api -v C:\orion\api:/app -w /app --env-file C:\orion\api\.env -p 3000:3000 node:18-slim sh -lc "npm install --no-audit --no-fund; node index.js"
```

3. Browse `http://localhost:3000/items` or open `C:\orion\makan.html`.

Import CSV (optional):

```powershell
# inside host (requires node) or use docker to run the script
node import_csv.js C:\orion\data\file1.csv
```

Notes:
- The import script uses simple inserts as a fallback. For large files use `psql \copy` or adapt script to COPY streaming.
- The frontend (`makan.html`) first tries API then falls back to local CSV files `data/file1.csv` and `data/file2.csv`.
