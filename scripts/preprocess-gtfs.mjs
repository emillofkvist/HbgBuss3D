/**
 * Laddar ner Skåne GTFS, filtrerar ut Helsingborg-rutter och sparar
 * public/helsingborg-routes.json som appen sedan kan ladda direkt.
 *
 * Kör med:  node scripts/preprocess-gtfs.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import JSZip from 'jszip';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Läs API-nyckel från .env.local eller process.env (CI) ──────────────────
function readEnv() {
  const env = { ...process.env };
  const envPath = path.join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf8').split('\n').forEach(l => {
      const idx = l.indexOf('=');
      if (idx > 0) env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });
  }
  return env;
}

// ─── Nedladdning till buffer med inbyggd fetch (med lokal cache) ─────────────
const CACHE_FILE = path.join(__dirname, '..', 'node_modules', '.gtfs-cache', 'skane.zip');

async function download(url) {
  if (existsSync(CACHE_FILE)) {
    console.log('Använder cachad ZIP:', CACHE_FILE);
    return readFileSync(CACHE_FILE);
  }
  console.log('Laddar ner:', url.replace(/key=\S+/, 'key=***'));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) process.stdout.write(`\r  ${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`);
  }
  process.stdout.write('\n');
  const buf = Buffer.concat(chunks);
  // Spara ZIP lokalt för snabbare körning nästa gång
  const cacheDir = path.dirname(CACHE_FILE);
  if (!existsSync(cacheDir)) { const { mkdirSync } = await import('fs'); mkdirSync(cacheDir, { recursive: true }); }
  writeFileSync(CACHE_FILE, buf);
  return buf;
}

// ─── CSV-parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].replace(/\r/g, '').split(',');
  return lines.slice(1).map(line => {
    const vals = line.replace(/\r/g, '').split(',');
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

// ─── Distinkt färg per linjenummer via HSL-färghjul ──────────────────────────
function routeColor(shortName) {
  const n = parseInt(shortName, 10);
  if (isNaN(n)) {
    // Icke-numeriska namn: grå-blå
    return [120, 160, 220];
  }
  // Sprid linjenumren jämnt över färghjulet.
  // Stadsbussar (1–99) och regionala (100–999) får separata färgrymder.
  let hue;
  if (n < 100) {
    // 36 möjliga värden → 10° steg, gyllene snitt för bra spridning
    hue = (n * 137.508) % 360;
  } else {
    hue = ((n - 100) * 47.3) % 360;
  }
  // HSL → RGB
  const h = hue / 360;
  const s = n < 100 ? 0.85 : 0.65;
  const l = n < 100 ? 0.55 : 0.50;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1/3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1/3) * 255),
  ];
}

// ─── Helsingborg bounding box ─────────────────────────────────────────────────
const BBOX = { minLat: 55.97, maxLat: 56.13, minLng: 12.56, maxLng: 12.90 };
const inBbox = (lat, lng) =>
  lat >= BBOX.minLat && lat <= BBOX.maxLat &&
  lng >= BBOX.minLng && lng <= BBOX.maxLng;

// ─── Huvudlogik ───────────────────────────────────────────────────────────────
async function main() {
  const env = readEnv();
  const key = env.VITE_TRAFIKLAB_STATIC_KEY;
  if (!key) throw new Error('VITE_TRAFIKLAB_STATIC_KEY saknas i .env.local');

  const url = `https://opendata.samtrafiken.se/gtfs/skane/skane.zip?key=${key}`;
  const buffer = await download(url);

  console.log('Packar upp ZIP…');
  const zip = await JSZip.loadAsync(buffer);

  console.log('Parsar routes.txt…');
  const allRoutes = parseCSV(await zip.file('routes.txt').async('string'));
  // GTFS Extended: 700-799 = buss (700=generic, 701=regional, 714=ersättningsbuss etc.)
  const routes = allRoutes.filter(r => {
    const t = parseInt(r.route_type, 10);
    return t === 3 || (t >= 700 && t <= 799);
  });

  console.log('Parsar trips.txt…');
  const trips = parseCSV(await zip.file('trips.txt').async('string'));
  const shapeToRoute = {};
  trips.forEach(t => { if (t.shape_id) shapeToRoute[t.shape_id] = t.route_id; });

  console.log('Parsar stops.txt…');
  const stops = parseCSV(await zip.file('stops.txt').async('string'))
    .filter(s => inBbox(parseFloat(s.stop_lat), parseFloat(s.stop_lon)))
    .map(s => ({
      id: s.stop_id,
      name: s.stop_name,
      position: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)],
      importance: 0.5,
    }));

  console.log(`Hittade ${stops.length} hållplatser i Helsingborg`);

  console.log('Parsar shapes.txt (kan ta en stund)…');
  const shapesText = await zip.file('shapes.txt').async('string');
  const shapeLines = shapesText.trim().split('\n');
  console.log(`  shapes.txt: ${shapeLines.length.toLocaleString()} rader`);

  const shapePoints = {};
  const headers = shapeLines[0].replace(/\r/g, '').split(',');
  const idIdx  = headers.indexOf('shape_id');
  const seqIdx = headers.indexOf('shape_pt_sequence');
  const latIdx = headers.indexOf('shape_pt_lat');
  const lonIdx = headers.indexOf('shape_pt_lon');

  for (let i = 1; i < shapeLines.length; i++) {
    const vals = shapeLines[i].replace(/\r/g, '').split(',');
    const shapeId = vals[idIdx];
    if (!shapeId) continue;
    if (!shapePoints[shapeId]) shapePoints[shapeId] = [];
    shapePoints[shapeId].push({
      seq: parseInt(vals[seqIdx], 10),
      lat: parseFloat(vals[latIdx]),
      lng: parseFloat(vals[lonIdx]),
    });
    if (i % 500_000 === 0) process.stdout.write(`\r  Rad ${(i / 1e6).toFixed(1)}M…`);
  }
  process.stdout.write('\n');

  console.log(`  Unika shape_id: ${Object.keys(shapePoints).length}`);

  // Filtrera shapes med ≥20% punkter i Helsingborg bbox
  const allLocalShapes = Object.entries(shapePoints)
    .filter(([, pts]) => {
      const n = pts.filter(p => inBbox(p.lat, p.lng)).length;
      return n > 0 && n / pts.length >= 0.2;
    })
    .map(([shapeId, pts]) => {
      const sorted = pts.sort((a, b) => a.seq - b.seq);
      const routeId = shapeToRoute[shapeId] ?? shapeId;
      const route = routes.find(r => r.route_id === routeId);
      const shortName = route?.route_short_name ?? '';
      const color = routeColor(shortName);
      return {
        id: shapeId,
        routeId,
        name: route ? `Linje ${shortName}` : shapeId,
        description: route?.route_long_name ?? '',
        color,
        path: sorted.map(p => [p.lng, p.lat]),
      };
    });

  // Filtrera bort shapes med för få waypoints (raka linjer = brus)
  const MIN_WAYPOINTS = 20;
  const cleanShapes = allLocalShapes.filter(s => s.path.length >= MIN_WAYPOINTS);

  // En shape per route_id — välj den med flest waypoints
  const byRoute = new Map();
  cleanShapes.forEach(s => {
    const ex = byRoute.get(s.routeId);
    if (!ex || s.path.length > ex.path.length) byRoute.set(s.routeId, s);
  });
  const routeShapes = Array.from(byRoute.values());

  // Koppla hållplatser till rutter geografiskt (stop inom 150m av närmaste waypoint)
  // 150m ≈ 0.00135° lat, 0.00215° lng vid Helsingborgs breddgrad
  const LAT_THRESH = 0.00135;
  const LNG_THRESH = 0.00215;

  console.log('Kopplar hållplatser till rutter…');
  routeShapes.forEach(route => {
    const matchedStops = new Set();
    stops.forEach(stop => {
      const [sLng, sLat] = stop.position;
      const nearby = route.path.some(([pLng, pLat]) =>
        Math.abs(pLat - sLat) < LAT_THRESH && Math.abs(pLng - sLng) < LNG_THRESH
      );
      if (nearby) matchedStops.add(stop.name);
    });
    route.stopNames = Array.from(matchedStops).sort();
  });

  console.log(`\nResultat: ${routeShapes.length} rutter, ${stops.length} hållplatser`);
  routeShapes.slice(0, 5).forEach(r =>
    console.log(`  ${r.name} (${r.description}) — ${r.path.length} waypoints, ${r.stopNames.length} hållplatser`)
  );

  const outPath = path.join(__dirname, '..', 'public', 'helsingborg-routes.json');
  writeFileSync(outPath, JSON.stringify({ routes: routeShapes, stops }));
  console.log(`\nSparad: ${outPath} (${(readFileSync(outPath).length / 1e3).toFixed(0)} kB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
