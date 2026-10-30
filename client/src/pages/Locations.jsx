import { useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Empty, ErrorText, Field, Input, Loading, Page, Pill, Select, TYPE_COLOR, TYPE_LABEL, useLoad } from '../ui.jsx';

const PH_CENTER = [12.88, 121.77];

export default function Locations() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ type: '', category: '', q: '' });
  const [selected, setSelected] = useState(null);
  const cats = useLoad(() => api.get('/categories'), []);
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { data, error, loading } = useLoad(() => api.get(`/locations${qs ? `?${qs}` : ''}`), [qs]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const center = data?.length ? [data[0].lat, data[0].lng] : PH_CENTER;

  return (
    <Page title="Find a place">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Search"><Input value={filters.q} onChange={set('q')} placeholder="Name, city or address" /></Field>
        <Field label="Kind of place">
          <Select value={filters.type} onChange={set('type')}>
            <option value="">All</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Accepts">
          <Select value={filters.category} onChange={set('category')}>
            <option value="">Any device</option>
            {cats.data?.map((c) => <option key={c.id} value={c.key}>{c.label}</option>)}
          </Select>
        </Field>
      </div>
      <ErrorText error={error} />
      <p className="mb-3 text-sm text-muted">Only places checked by an administrator are shown. Call ahead to confirm hours and what they accept.</p>

      {loading ? <Loading /> : data?.length === 0 ? <Empty>No places match. Try clearing a filter.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="h-[420px] overflow-hidden rounded-md border border-line lg:h-[560px]" role="region" aria-label="Map of places">
            <MapContainer key={`${center[0]},${center[1]}`} center={center} zoom={data?.length ? 11 : 6} className="h-full w-full">
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {data?.map((l) => (
                <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={selected === l.id ? 12 : 8}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: TYPE_COLOR[l.type], fillOpacity: 1 }}
                  eventHandlers={{ click: () => setSelected(l.id) }}>
                  <Popup><strong>{l.name}</strong><br />{TYPE_LABEL[l.type]}</Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <ul className="max-h-[560px] space-y-2 overflow-y-auto">
            {data?.map((l) => <LocationItem key={l.id} l={l} active={selected === l.id} onSelect={() => setSelected(l.id)} canReport={!!user} />)}
          </ul>
        </div>
      )}
    </Page>
  );
}

function LocationItem({ l, active, onSelect, canReport }) {
  const [msg, setMsg] = useState('');
  const report = async () => {
    const note = window.prompt('What is wrong or out of date?');
    if (!note) return;
    try { await api.post(`/locations/${l.id}/report`, { note }); setMsg('Thanks. An administrator will review it.'); } catch (e) { setMsg(e.message); }
  };
  return (
    <li className={`rounded-md border bg-card p-3 text-sm ${active ? 'border-board' : 'border-line'}`}>
      <button className="w-full text-left" onClick={onSelect} aria-pressed={active}>
        <span className="block font-bold">{l.name}</span>
        <span className="text-muted">{TYPE_LABEL[l.type]}{l.city ? ` · ${l.city}` : ''}</span>
      </button>
      {l.services && <p className="mt-1">{l.services}</p>}
      {l.address && <p className="text-muted">{l.address}</p>}
      <p className="mt-1">{[l.phone, l.hours].filter(Boolean).join(' · ')}</p>
      {l.website && <a className="underline" href={l.website} target="_blank" rel="noopener noreferrer">Website</a>}
      <div className="mt-2 flex items-center gap-2">
        {l.verified && <Pill tone="good">Verified</Pill>}
        {canReport && <Button variant="secondary" className="!px-2 !py-1 !text-xs" onClick={report}>Report a problem</Button>}
      </div>
      {msg && <p className="mt-1 text-xs text-muted" role="status">{msg}</p>}
    </li>
  );
}
