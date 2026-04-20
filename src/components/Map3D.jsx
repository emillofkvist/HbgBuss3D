import { useState, useRef, useCallback, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, ScatterplotLayer, ColumnLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { BUS_STOPS } from '../data/stops';
import { useStaticGTFS } from '../hooks/useStaticGTFS';

const INITIAL_VIEW = {
  longitude: 12.700,
  latitude: 56.047,
  zoom: 14.5,
  pitch: 55,
  bearing: -18,
};

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
  : null;

const ROUTE_Z = 20;
const AUTO_ROTATE_RESUME_MS = 5000;

function add3DBuildings(map) {
  if (map.getLayer('buildings-3d')) return;
  if (map.getLayer('Building')) map.setLayoutProperty('Building', 'visibility', 'none');
  if (map.getLayer('Building top')) map.setLayoutProperty('Building top', 'visibility', 'none');
  // Must be inserted before 'Building' in layer stack to render correctly
  const beforeId = map.getLayer('Building') ? 'Building' : undefined;
  map.addLayer({
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'maptiler_planet',
    'source-layer': 'building',
    paint: {
      'fill-extrusion-color': [
        'interpolate', ['linear'],
        ['get', 'render_height'],
        0,   '#1e3d70',
        20,  '#2a54a0',
        50,  '#3468c0',
        100, '#4080e0',
      ],
      'fill-extrusion-height': ['get', 'render_height'],
      'fill-extrusion-base': ['get', 'render_min_height'],
      'fill-extrusion-opacity': 1.0,
      'fill-extrusion-vertical-gradient': false,
    },
  }, beforeId);
}

export default function Map3D({ onRouteSelect, vehicles, hiddenRouteIds = new Set(), routes: routesProp, searchMatchIds }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const autoRotateRef = useRef(true);
  const lastTickRef = useRef(Date.now());
  const resumeTimerRef = useRef(null);
  const rafRef = useRef(null);
  // requestAnimationFrame-driven rotation — no setState inside render cycle
  useEffect(() => {
    const tick = () => {
      if (autoRotateRef.current) {
        const now = Date.now();
        const delta = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        setViewState(vs => ({ ...vs, bearing: (vs.bearing + delta * 2.5) % 360 }));
      } else {
        lastTickRef.current = Date.now();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Callback ref — fires when Map component mounts/unmounts
  const setMapRef = useCallback((mapInstance) => {
    if (!mapInstance) return;
    const map = mapInstance.getMap();
    window.__hbgMap = map; // expose for debugging
    if (map.isStyleLoaded()) {
      add3DBuildings(map);
    } else {
      map.once('load', () => add3DBuildings(map));
    }
    map.on('styledata', () => {
      if (map.isStyleLoaded()) add3DBuildings(map);
    });
  }, []);

  const [stopPulse, setStopPulse] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      setStopPulse(0.5 + 0.5 * Math.sin(t * 1.8));
    }, 50);
    return () => clearInterval(iv);
  }, []);

  const { data: gtfsData } = useStaticGTFS();

  const routes = routesProp ?? [];
  const stops  = gtfsData?.stops?.length
    ? gtfsData.stops.map(s => ({
        position: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)],
        importance: 0.5,
        name: s.stop_name,
      }))
    : BUS_STOPS;

  const handleViewChange = useCallback(({ viewState: vs }) => {
    setViewState(vs);
    autoRotateRef.current = false;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      lastTickRef.current = Date.now();
      autoRotateRef.current = true;
    }, AUTO_ROTATE_RESUME_MS);
  }, []);

  const visibleRoutes = routes.filter(r => !hiddenRouteIds.has(r.id));

  const layers = [
    ...visibleRoutes.flatMap(route => {
      const dimmed = searchMatchIds && !searchMatchIds.has(route.id);
      const outerA = dimmed ? 5  : 25;
      const midA   = dimmed ? 15 : 80;
      const coreA  = dimmed ? 35 : 230;
      return [
        new PathLayer({
          id: `route-outer-${route.id}`,
          data: [route],
          getPath: d => d.path.map(p => [...p, ROUTE_Z]),
          getColor: d => [...d.color, outerA],
          getWidth: 28,
          widthUnits: 'pixels',
          capRounded: true,
          jointRounded: true,
          updateTriggers: { getColor: outerA },
        }),
        new PathLayer({
          id: `route-mid-${route.id}`,
          data: [route],
          getPath: d => d.path.map(p => [...p, ROUTE_Z]),
          getColor: d => [...d.color, midA],
          getWidth: 14,
          widthUnits: 'pixels',
          capRounded: true,
          jointRounded: true,
          updateTriggers: { getColor: midA },
        }),
        new PathLayer({
          id: `route-core-${route.id}`,
          data: [route],
          getPath: d => d.path.map(p => [...p, ROUTE_Z]),
          getColor: d => [...d.color, coreA],
          getWidth: 4,
          widthUnits: 'pixels',
          capRounded: true,
          jointRounded: true,
          pickable: true,
          onClick: ({ object }) => onRouteSelect?.(object),
          updateTriggers: { getColor: coreA },
        }),
      ];
    }),

    new ColumnLayer({
      id: 'stops-glow',
      data: stops,
      getPosition: d => d.position,
      getElevation: d => (d.importance ?? 0.5) * 90 * (1 + 0.12 * stopPulse),
      getFillColor: () => [40, 220, 255, 55],
      radius: 24,
      diskResolution: 32,
      updateTriggers: { getElevation: stopPulse },
    }),
    new ColumnLayer({
      id: 'stops-core',
      data: stops,
      getPosition: d => d.position,
      getElevation: d => (d.importance ?? 0.5) * 90 * (1 + 0.12 * stopPulse),
      getFillColor: () => [100, 235, 255, 190],
      radius: 9,
      diskResolution: 32,
      updateTriggers: { getElevation: stopPulse },
    }),

    ...(vehicles?.length ? [
      new ScatterplotLayer({
        id: 'real-glow',
        data: vehicles,
        getPosition: d => d.position,
        getRadius: 42,
        getFillColor: () => [255, 210, 50, 60],
        radiusUnits: 'pixels',
      }),
      new ScatterplotLayer({
        id: 'real-core',
        data: vehicles,
        getPosition: d => d.position,
        getRadius: 16,
        getFillColor: () => [255, 230, 80, 250],
        radiusUnits: 'pixels',
      }),
    ] : []),
  ];

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={handleViewChange}
      controller={{ doubleClickZoom: false }}
      layers={layers}
      style={{ background: '#050a15' }}
    >
      {MAP_STYLE && <Map ref={setMapRef} mapStyle={MAP_STYLE} reuseMaps />}
    </DeckGL>
  );
}
