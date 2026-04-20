import { useState } from 'react';

export default function InfoOverlay({ selectedRoute, onClearRoute, vehicles, gtfsStatus, hiddenRouteIds = new Set(), onToggleRoute, routes = [], onSearchChange, showLive = true, onToggleLive }) {
  const liveCount = vehicles?.length ?? 0;
  const isLive = liveCount > 0;
  const [search, setSearch] = useState('');
  const handleSearch = (val) => {
    setSearch(val);
    onSearchChange?.(val);
  };

  // Sortera: korta linjenummer (1, 2, …) före långa (218, 250, …)
  const sortedRoutes = [...routes].sort((a, b) => {
    const na = parseInt(a.name.replace('Linje ', ''), 10) || 9999;
    const nb = parseInt(b.name.replace('Linje ', ''), 10) || 9999;
    return na - nb;
  });

  const q = search.trim().toLowerCase();
  const matchedRoutes = q
    ? sortedRoutes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.stopNames ?? []).some(s => s.toLowerCase().includes(q))
      )
    : sortedRoutes;
  const matchedIds = new Set(matchedRoutes.map(r => r.id));

  return (
    <div style={s.container}>

      {/* Title */}
      <div>
        <h1 style={s.title}>Helsingborg</h1>
        <div style={s.subtitle}>BUSSTRAFIK 3D</div>
      </div>

      {/* Live status badge + toggle */}
      <div style={{ ...s.badge, background: isLive ? 'rgba(80,255,160,0.1)' : 'rgba(255,255,255,0.05)', borderColor: isLive ? 'rgba(80,255,160,0.3)' : 'rgba(255,255,255,0.1)', pointerEvents: 'auto' }}>
        <span style={{ ...s.dot2, background: isLive && showLive ? '#50ffa0' : '#888', boxShadow: isLive && showLive ? '0 0 8px #50ffa0' : 'none' }} />
        {isLive
          ? <span style={{ ...s.badgeText, flex: 1 }}>{showLive ? `${liveCount} bussar live` : 'Live dolt'}</span>
          : <span style={{ ...s.badgeText, flex: 1 }}>Hämtar realtidsdata…</span>
        }
        {isLive && (
          <button
            onClick={onToggleLive}
            style={{ ...s.toggleBtn, background: showLive ? 'rgba(80,255,160,0.15)' : 'rgba(255,255,255,0.08)', borderColor: showLive ? 'rgba(80,255,160,0.4)' : 'rgba(255,255,255,0.15)', color: showLive ? '#50ffa0' : 'rgba(255,255,255,0.4)' }}
            title={showLive ? 'Dölj livebussar' : 'Visa livebussar'}
          >
            {showLive ? 'Dölj' : 'Visa'}
          </button>
        )}
      </div>

      {/* Sökfält */}
      <div style={s.searchWrap}>
        <input
          style={s.searchInput}
          placeholder="Sök hållplats eller linje…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          spellCheck={false}
        />
        {search && (
          <button style={s.clearSearch} onClick={() => handleSearch('')}>✕</button>
        )}
      </div>

      {/* Route legend */}
      <div style={s.legend}>
        {sortedRoutes.map(route => {
          const active = selectedRoute?.id === route.id;
          const hidden = hiddenRouteIds.has(route.id);
          const dimmed = q && !matchedIds.has(route.id);
          return (
            <div
              key={route.id}
              style={{ ...s.row, opacity: hidden ? 0.25 : dimmed ? 0.2 : selectedRoute && !active ? 0.35 : 1, cursor: 'pointer', pointerEvents: 'auto', transition: 'opacity 0.2s' }}
              onClick={() => onToggleRoute?.(route.id)}
              title={hidden ? 'Visa rutt' : 'Dölj rutt'}
            >
              <span style={{ ...s.dot, background: hidden ? '#555' : `rgb(${route.color})`, boxShadow: hidden ? 'none' : `0 0 6px rgb(${route.color})` }} />
              <span style={{ ...s.lname, textDecoration: hidden ? 'line-through' : 'none', color: hidden ? 'rgba(255,255,255,0.45)' : undefined }}>{route.name}</span>
              <span style={s.ldesc}>{hidden ? '–' : route.description}</span>
            </div>
          );
        })}
        {q && matchedRoutes.length === 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Inga rutter hittades</div>
        )}
      </div>

      {/* Real buses legend */}
      {isLive && (
        <div style={s.row}>
          <span style={{ ...s.dot, background: '#ffe650', boxShadow: '0 0 6px #ffe650' }} />
          <span style={s.lname}>Live</span>
          <span style={s.ldesc}>Skånetrafiken realtid</span>
        </div>
      )}

      {/* Selected route */}
      {selectedRoute && (
        <div style={s.selected}>
          <div style={s.selTitle}>{selectedRoute.name}</div>
          <div style={s.selDesc}>{selectedRoute.description}</div>
          <button style={s.clearBtn} onClick={onClearRoute}>✕ Avmarkera</button>
        </div>
      )}

      <div style={s.hint}>Klicka på rutt · Drag för att rotera · Scroll för zoom</div>
    </div>
  );
}

const s = {
  container: {
    position: 'absolute', top: 24, left: 24, zIndex: 10,
    pointerEvents: 'none', display: 'flex', flexDirection: 'column',
    gap: 18, maxWidth: 250,
    fontFamily: "system-ui, 'Segoe UI', sans-serif",
  },
  title: {
    margin: 0, fontSize: 28, fontWeight: 200, letterSpacing: 4,
    color: '#7df9ff', textShadow: '0 0 20px rgba(125,249,255,0.5)',
  },
  subtitle: { fontSize: 10, letterSpacing: 5, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  badge: {
    display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid', borderRadius: 6, padding: '7px 10px',
  },
  dot2: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  badgeText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', flex: 1 },
  toggleBtn: {
    border: '1px solid', borderRadius: 4, padding: '2px 8px',
    fontSize: 10, cursor: 'pointer', fontFamily: "system-ui, 'Segoe UI', sans-serif",
    letterSpacing: 0.3, transition: 'all 0.2s', flexShrink: 0,
  },
  searchWrap: { position: 'relative', pointerEvents: 'auto' },
  searchInput: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, padding: '7px 28px 7px 10px',
    color: 'rgba(255,255,255,0.9)', fontSize: 12, outline: 'none',
    fontFamily: "system-ui, 'Segoe UI', sans-serif",
  },
  clearSearch: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer', fontSize: 11, padding: 2, lineHeight: 1,
  },
  legend: { display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto', paddingRight: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.3s' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  lname: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500, width: 56 },
  ldesc: { fontSize: 11, color: 'rgba(255,255,255,0.38)' },
  selected: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '12px 14px', pointerEvents: 'auto',
  },
  selTitle: { fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 4 },
  selDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  clearBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.6)', borderRadius: 4,
    padding: '4px 10px', cursor: 'pointer', fontSize: 11,
  },
  hint: { fontSize: 10, color: 'rgba(255,255,255,0.18)', lineHeight: 1.6, letterSpacing: 0.3 },
};
