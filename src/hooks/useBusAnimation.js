import { useState, useEffect, useRef, useMemo } from 'react';
import { BUS_ROUTES } from '../data/routes';
import { getPositionOnPath } from '../utils/pathUtils';

const BUSES_PER_ROUTE = 3;
const BUS_SPEED = 0.035;
const TRAIL_LENGTH = 8;
const TRAIL_INTERVAL_MS = 120;
const BUS_ELEVATION = 25;

export function useBusAnimation() {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const trailRef = useRef({});
  const lastTrailRef = useRef(0);

  useEffect(() => {
    let rafId;
    const tick = () => {
      const now = Date.now();
      const t = (now - startRef.current) / 1000;
      setElapsed(t);

      if (now - lastTrailRef.current >= TRAIL_INTERVAL_MS) {
        lastTrailRef.current = now;
        BUS_ROUTES.forEach(route => {
          for (let i = 0; i < BUSES_PER_ROUTE; i++) {
            const key = `${route.id}-${i}`;
            const progress = (t * BUS_SPEED + i / BUSES_PER_ROUTE) % 1;
            const pos = getPositionOnPath(route.path, progress);
            if (!trailRef.current[key]) trailRef.current[key] = [];
            trailRef.current[key] = [pos, ...trailRef.current[key].slice(0, TRAIL_LENGTH - 1)];
          }
        });
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const busPositions = useMemo(() =>
    BUS_ROUTES.flatMap(route =>
      Array.from({ length: BUSES_PER_ROUTE }, (_, i) => {
        const progress = (elapsed * BUS_SPEED + i / BUSES_PER_ROUTE) % 1;
        const pos = getPositionOnPath(route.path, progress);
        return { position: [...pos, BUS_ELEVATION], color: route.color, routeId: route.id };
      })
    ),
  [elapsed]);

  const trailData = useMemo(() => {
    const data = [];
    BUS_ROUTES.forEach(route => {
      for (let i = 0; i < BUSES_PER_ROUTE; i++) {
        const key = `${route.id}-${i}`;
        const trail = trailRef.current[key] ?? [];
        trail.forEach((pos, age) => {
          data.push({ position: [...pos, BUS_ELEVATION], age, color: route.color });
        });
      }
    });
    return data;
  }, [elapsed]);

  const stopPulse = useMemo(() => 0.5 + 0.5 * Math.sin(elapsed * 1.8), [elapsed]);

  return { busPositions, trailData, stopPulse, elapsed };
}
