import { useState, useEffect } from 'react';
import { fetchVehiclePositions } from '../api/trafiklab';

const POLL_MS = 15_000;

export function useVehiclePositions() {
  const [vehicles, setVehicles] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'live' | 'error' | 'no-key'

  useEffect(() => {
    if (!import.meta.env.VITE_TRAFIKLAB_KEY) {
      setStatus('no-key');
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const data = await fetchVehiclePositions();
        if (!mounted) return;
        setVehicles(data);
        setStatus(data && data.length > 0 ? 'live' : 'loading');
      } catch {
        if (mounted) setStatus('error');
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return { vehicles, status };
}
