import JSZip from 'jszip';

const BASE = import.meta.env.DEV ? '/trafiklab' : 'https://opendata.samtrafiken.se';
const RT_KEY = import.meta.env.VITE_TRAFIKLAB_KEY;
const STATIC_KEY = import.meta.env.VITE_TRAFIKLAB_STATIC_KEY;

const HBG_BBOX = { minLat: 55.97, maxLat: 56.13, minLng: 12.56, maxLng: 12.90 };

// ─── Realtime vehicle positions ──────────────────────────────────────────────

export async function fetchVehiclePositions() {
  if (!RT_KEY) return null;

  const res = await fetch(`${BASE}/gtfs-rt/skane/VehiclePositions.pb?key=${RT_KEY}`);
  if (!res.ok) throw new Error(`RT ${res.status}`);

  const buffer = await res.arrayBuffer();
  const mod = await import('gtfs-realtime-bindings');
  const { transit_realtime } = mod.default ?? mod;
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

  return feed.entity
    .filter(({ vehicle: v }) => {
      const p = v?.position;
      if (!p) return false;
      return p.latitude  >= HBG_BBOX.minLat && p.latitude  <= HBG_BBOX.maxLat
          && p.longitude >= HBG_BBOX.minLng && p.longitude <= HBG_BBOX.maxLng;
    })
    .map(({ id, vehicle: v }) => ({
      id,
      position: [v.position.longitude, v.position.latitude, 30],
      routeId: v.trip?.routeId ?? null,
    }));
}

// ─── Static GTFS (routes + stops + shapes) ───────────────────────────────────
// Cached via Cache API to protect the 50 req/30d limit.

const CACHE_NAME = 'gtfs-static-v1';
const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

async function fetchWithCache(url) {
  if ('caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) {
      const age = Date.now() - Number(hit.headers.get('X-Fetched-At') ?? 0);
      if (age < CACHE_TTL_MS) return hit.arrayBuffer();
    }
    const fresh = await fetch(url);
    if (!fresh.ok) throw new Error(`Static ${fresh.status}`);
    const headers = new Headers(fresh.headers);
    headers.set('X-Fetched-At', String(Date.now()));
    await cache.put(url, new Response(await fresh.clone().arrayBuffer(), { headers }));
    return fresh.arrayBuffer();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Static ${res.status}`);
  return res.arrayBuffer();
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].replace(/\r/g, '').split(',');
  return lines.slice(1).map(line => {
    const vals = line.replace(/\r/g, '').split(',');
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

export async function fetchStaticGTFS() {
  if (!STATIC_KEY) return null;

  const url = `${BASE}/gtfs/skane/skane.zip?key=${STATIC_KEY}`;
  const buffer = await fetchWithCache(url);
  const zip = await JSZip.loadAsync(buffer);

  const [stopsText, routesText, shapesText, tripsText] = await Promise.all([
    zip.file('stops.txt')?.async('string'),
    zip.file('routes.txt')?.async('string'),
    zip.file('shapes.txt')?.async('string'),
    zip.file('trips.txt')?.async('string'),
  ]);

  const stops = parseCSV(stopsText ?? '').filter(s => {
    const lat = parseFloat(s.stop_lat);
    const lng = parseFloat(s.stop_lon);
    return lat >= HBG_BBOX.minLat && lat <= HBG_BBOX.maxLat
        && lng >= HBG_BBOX.minLng && lng <= HBG_BBOX.maxLng;
  });

  const routes = parseCSV(routesText ?? '').filter(r => r.route_type === '3'); // bus only

  // Map shape_id → route_id via trips
  const trips = parseCSV(tripsText ?? '');
  const shapeToRoute = {};
  trips.forEach(t => { if (t.shape_id) shapeToRoute[t.shape_id] = t.route_id; });

  // Collect local shape IDs (shapes whose first point is within bbox)
  const allShapeRows = parseCSV(shapesText ?? '');
  const shapePoints = {};
  allShapeRows.forEach(row => {
    if (!shapePoints[row.shape_id]) shapePoints[row.shape_id] = [];
    shapePoints[row.shape_id].push({
      seq: parseInt(row.shape_pt_sequence, 10),
      lat: parseFloat(row.shape_pt_lat),
      lng: parseFloat(row.shape_pt_lon),
    });
  });

  // Keep shapes where ≥20% of points lie within Helsingborg bbox
  const inBbox = p =>
    p.lat >= HBG_BBOX.minLat && p.lat <= HBG_BBOX.maxLat &&
    p.lng >= HBG_BBOX.minLng && p.lng <= HBG_BBOX.maxLng;

  const allLocalShapes = Object.entries(shapePoints)
    .filter(([, pts]) => {
      const count = pts.filter(inBbox).length;
      return count > 0 && count / pts.length >= 0.2;
    })
    .map(([shapeId, pts]) => {
      const sorted = pts.sort((a, b) => a.seq - b.seq);
      const routeId = shapeToRoute[shapeId];
      const route = routes.find(r => r.route_id === routeId);
      const hex = route?.route_color ?? 'ffffff';
      const r2 = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return {
        id: shapeId,
        routeId: routeId ?? shapeId,
        name: route ? `Linje ${route.route_short_name}` : shapeId,
        description: route?.route_long_name ?? '',
        color: isNaN(r2) ? [120, 180, 255] : [r2, g, b],
        path: sorted.map(p => [p.lng, p.lat]),
      };
    });

  // One shape per route_id — keep the one with most waypoints
  const byRoute = new Map();
  allLocalShapes.forEach(shape => {
    const existing = byRoute.get(shape.routeId);
    if (!existing || shape.path.length > existing.path.length) {
      byRoute.set(shape.routeId, shape);
    }
  });
  const localShapes = Array.from(byRoute.values());

  return { stops, routes: localShapes };
}
