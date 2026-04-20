import { useState, useEffect } from 'react';

export function useStaticGTFS() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch(`${import.meta.env.BASE_URL}helsingborg-routes.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(result => { if (mounted) setData(result); })
      .catch(err => console.error('[GTFS] helsingborg-routes.json saknas — kör scripts/preprocess-gtfs.mjs:', err))
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, []);

  return { data, loading };
}
