import { useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Empty, ErrorText, Field, Input, Loading, Notice, Page, Pill, Select, Textarea, TYPE_LABEL, useLoad } from '../ui.jsx';

// Shared by partners (their own listings) and admins (any listing).
export function LocationForm({ initial, categories, onSaved, onCancel }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const l = initial || {};

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries());
    body.accepted_categories = f.getAll('accepted_categories');
    try {
      initial ? await api.put(`/locations/${initial.id}`, body) : await api.post('/locations', body);
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorText error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input name="name" required maxLength={150} defaultValue={l.name} /></Field>
        <Field label="Kind of place">
          <Select name="type" required defaultValue={l.type ?? ''}>
            <option value="" disabled>Choose one</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Services"><Textarea name="services" maxLength={500} defaultValue={l.services} /></Field>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Devices accepted</legend>
        <p className="mb-1 text-sm text-muted">Tick none to accept all device types.</p>
        <div className="flex flex-wrap gap-4">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="accepted_categories" value={c.key} defaultChecked={l.accepted_categories?.includes(c.key)} /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address"><Input name="address" maxLength={300} defaultValue={l.address} /></Field>
        <Field label="City"><Input name="city" maxLength={100} defaultValue={l.city} /></Field>
        <Field label="Latitude" hint="For example 14.5995. Right-click a spot on openstreetmap.org and choose Show address."><Input name="lat" type="number" step="any" min="-90" max="90" required defaultValue={l.lat} /></Field>
        <Field label="Longitude" hint="For example 120.9842."><Input name="lng" type="number" step="any" min="-180" max="180" required defaultValue={l.lng} /></Field>
        <Field label="Phone"><Input name="phone" maxLength={40} defaultValue={l.phone} /></Field>
        <Field label="Opening hours"><Input name="hours" maxLength={200} defaultValue={l.hours} /></Field>
      </div>
      <Field label="Website"><Input name="website" type="url" maxLength={300} placeholder="https://" defaultValue={l.website} /></Field>
      <div className="flex gap-2">
        <Button disabled={busy}>{busy ? 'Saving…' : 'Save location'}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export default function MyLocations() {
  const [editing, setEditing] = useState(null); // null | 'new' | location
  const [error, setError] = useState('');
  const cats = useLoad(() => api.get('/categories'), []);
  const { data, error: loadError, loading, reload } = useLoad(() => api.get('/locations?mine=1'), []);

  const remove = async (l) => {
    if (!window.confirm(`Delete ${l.name}?`)) return;
    try { await api.del(`/locations/${l.id}`); reload(); } catch (e) { setError(e.message); }
  };

  if (editing) {
    return (
      <Page title={editing === 'new' ? 'Add a location' : 'Edit location'}>
        <Card className="max-w-3xl">
          <LocationForm initial={editing === 'new' ? null : editing} categories={cats.data || []}
            onSaved={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
        </Card>
      </Page>
    );
  }

  return (
    <Page title="My locations" actions={<Button onClick={() => setEditing('new')}>Add a location</Button>}>
      <ErrorText error={error || loadError} />
      <div className="mb-4"><Notice>New and edited listings are checked by an administrator before they appear on the public map.</Notice></div>
      {loading ? <Loading /> : data?.length === 0 ? <Empty>You have no locations yet.</Empty> : (
        <ul className="space-y-3">
          {data?.map((l) => (
            <li key={l.id} className="rounded-md border border-line bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{l.name}</h2>
                <div className="flex gap-2">
                  <Pill tone={l.verified ? 'good' : 'warn'}>{l.verified ? 'Verified' : 'Waiting for review'}</Pill>
                  {l.reported && <Pill tone="bad">Reported by a user</Pill>}
                </div>
              </div>
              <p className="text-sm text-muted">{TYPE_LABEL[l.type]}{l.city ? ` · ${l.city}` : ''}</p>
              {l.reported && l.report_note && <p className="mt-1 text-sm">Reported: {l.report_note}</p>}
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(l)}>Edit</Button>
                <Button variant="danger" onClick={() => remove(l)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
