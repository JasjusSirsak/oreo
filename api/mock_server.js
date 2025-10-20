// mock_server.js - zero-dependency in-memory API compatible with api/index.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_DIR = path.join(__dirname, '..', 'data');
let items = [];
let nextId = 1;

function parseCsvFile(filePath, sourceName) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines.shift().split(',').map(h=>h.trim());
  const out = lines.map(ln => {
    const vals = ln.split(',');
    const obj = {};
    header.forEach((h,i)=> obj[h]=vals[i]);
    return obj;
  });
  return out.map(r => ({
    id: nextId++,
    name: r.name || `item-${Date.now()}`,
    metadata: { source: sourceName, note: r.note || null, price: r.price ? Number(r.price) : null },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

function seedFromCsvs() {
  const p1 = path.join(DATA_DIR, 'file1.csv');
  const p2 = path.join(DATA_DIR, 'file2.csv');
  const a = parseCsvFile(p1, 'file1.csv');
  const b = parseCsvFile(p2, 'file2.csv');
  items = items.concat(a, b);
}

seedFromCsvs();

function sendJSON(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(s);
}

function notFound(res) {
  sendJSON(res, 404, { error: 'not_found' });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      if (!data) return resolve(null);
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // GET /items and POST /items
  if (pathname === '/items') {
    if (req.method === 'GET') {
      const q = parsed.query || {};
      const limit = Math.min(100, Number(q.limit) || 100);
      const offset = Number(q.offset) || 0;
      const source = q.source;
      let rows = items.slice();
      if (source) rows = rows.filter(it => it.metadata && it.metadata.source === source);
      // order by id desc
      rows = rows.sort((a,b) => b.id - a.id).slice(offset, offset + limit);
      return sendJSON(res, 200, rows);
    }

    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!body || !body.name) return sendJSON(res, 400, { error: 'name_required' });
        const now = new Date().toISOString();
        const it = {
          id: nextId++,
          name: body.name,
          metadata: body.metadata || {},
          created_at: now,
          updated_at: now,
        };
        items.push(it);
        return sendJSON(res, 201, it);
      } catch (e) {
        return sendJSON(res, 400, { error: 'invalid_json', detail: e.message });
      }
    }
  }

  // GET /items/:id
  const m = pathname.match(/^\/items\/(\d+)$/);
  if (m && req.method === 'GET') {
    const id = Number(m[1]);
    const it = items.find(x => x.id === id);
    if (!it) return notFound(res);
    return sendJSON(res, 200, it);
  }

  // simple health
  if (pathname === '/health' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, items: items.length });
  }

  notFound(res);
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`Mock API listening on port ${port} — items seeded: ${items.length}`));