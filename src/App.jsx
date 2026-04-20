import { useState } from 'react';
import Map3D from './components/Map3D';
import InfoOverlay from './components/InfoOverlay';
import { useVehiclePositions } from './hooks/useVehiclePositions';
import { useStaticGTFS } from './hooks/useStaticGTFS';
import { BUS_ROUTES } from './data/routes';

export default function App() {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [hiddenRouteIds, setHiddenRouteIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showLive, setShowLive] = useState(true);
  const { vehicles, status } = useVehiclePositions();
  const { data: gtfsData } = useStaticGTFS();

  const routes = gtfsData?.routes?.length ? gtfsData.routes : BUS_ROUTES;

  const q = searchQuery.trim().toLowerCase();
  const searchMatchIds = q
    ? new Set(routes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.stopNames ?? []).some(s => s.toLowerCase().includes(q))
      ).map(r => r.id))
    : null;

  const toggleRoute = (id) => setHiddenRouteIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Map3D onRouteSelect={setSelectedRoute} vehicles={showLive ? vehicles : []} hiddenRouteIds={hiddenRouteIds} routes={routes} searchMatchIds={searchMatchIds} />
      <InfoOverlay
        selectedRoute={selectedRoute}
        onClearRoute={() => setSelectedRoute(null)}
        vehicles={vehicles}
        showLive={showLive}
        onToggleLive={() => setShowLive(v => !v)}
        hiddenRouteIds={hiddenRouteIds}
        onToggleRoute={toggleRoute}
        routes={routes}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}
