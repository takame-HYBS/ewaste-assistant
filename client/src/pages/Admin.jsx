import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Button, Card, dateText, Empty, ErrorText, Field, Input, Loading, Page, Pill, Select, TYPE_LABEL, useLoad,
} from '../ui.jsx';
import { LocationForm } from './MyLocations.jsx';

const TABS = [['users', 'Users'], ['locations', 'Locations'], ['reports', 'Reports'], ['categories', 'Categories']];

export default function Admin() {
  const [tab, setTab] = useState('users');
  return (
    <Page title="Administration">
      <div role="tablist" aria-label="Admin sections" className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([k, v]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-board text-white' : 'border border-line bg-card hover:bg-board-tint'}`}>{v}</button>
        ))}
      </div>
      {tab === 'users' && <Users />}
      {tab === 'locations' && <AdminLocations />}
      {tab === 'reports' && <Reports />}
      {tab === 'categories' && <Categories />}
    </Page>
  );
}

function useAction(reload) {
  const [error, setError] = useState('');
  const run = async (fn) => { setError(''); try { await fn(); reload(); } catch (e) { setError(e.message); } };
  return { error, run };
}

function Users() {
  const { user: me } = useAuth();
  const { data, error: loadError, loading, reload } = useLoad(() => api.get('/admin/users'), []);
  const { error, run } = useAction(reload);
  const [adding, setAdding] = useState(false);

  const add = (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    run(async () => { await api.post('/admin/users', body); setAdding(false); });
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">Users</h2>
        <Button variant="secondary" onClick={() => setAdding(!adding)}>{adding ? 'Close' : 'Add a user'}</Button>
      </div>
      <ErrorText error={error || loadError} />
      {adding && (
        <form onSubmit={add} className="mb-4 grid gap-3 rounded-md border border-line bg-paper p-4 sm:grid-cols-2">
          <Field label="Name"><Input name="name" required /></Field>
          <Field label="Email"><Input name="email" type="email" required /></Field>
          <Field label="Temporary password"><Input name="password" type="password" minLength={8} required /></Field>
          <Field label="Role">
            <Select name="role" defaultValue="user">
              <option value="user">Device owner</option><option value="partner">Partner</option><option value="admin">Administrator</option>
            </Select>
          </Field>
          <div><Button>Create user</Button></div>
        </form>
      )}
      {loading ? <Loading /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted"><tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Devices</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-line">
              {data?.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-2">{u.name} {!u.active && <Pill tone="bad">Deactivated</Pill>}</td>
                  <td className="pr-2">{u.email}</td>
                  <td className="pr-2">
                    <select aria-label={`Role for ${u.name}`} className="rounded-md border border-line bg-white px-2 py-1" value={u.role}
                      onChange={(e) => run(() => api.put(`/admin/users/${u.id}`, { role: e.target.value }))}>
                      <option value="user">Device owner</option><option value="partner">Partner</option><option value="admin">Administrator</option>
                    </select>
                  </td>
                  <td className="pr-2">{u.device_count}</td>
                  <td className="pr-2">{dateText(u.created_at)}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    <Button variant="secondary" className="!px-2 !py-1 !text-xs" onClick={() => run(() => api.put(`/admin/users/${u.id}`, { active: !u.active }))}>
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                    {u.id !== me.id && (
                      <Button variant="danger" className="!px-2 !py-1 !text-xs"
                        onClick={() => window.confirm(`Delete ${u.name}?`) && run(() => api.del(`/admin/users/${u.id}`))}>Delete</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AdminLocations() {
  const cats = useLoad(() => api.get('/categories'), []);
  const { data, error: loadError, loading, reload } = useLoad(() => api.get('/locations'), []);
  const { error, run } = useAction(reload);
  const [editing, setEditing] = useState(null);

  if (editing) {
    return (
      <Card>
        <h2 className="mb-3 text-xl font-bold">{editing === 'new' ? 'Add a location' : 'Edit location'}</h2>
        <LocationForm initial={editing === 'new' ? null : editing} categories={cats.data || []}
          onSaved={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">All locations</h2>
        <Button variant="secondary" onClick={() => setEditing('new')}>Add a location</Button>
      </div>
      <ErrorText error={error || loadError} />
      {loading ? <Loading /> : data?.length === 0 ? <Empty>No locations yet.</Empty> : (
        <ul className="divide-y divide-line">
          {data?.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold">{l.name} <Pill tone={l.verified ? 'good' : 'warn'}>{l.verified ? 'Verified' : 'Unverified'}</Pill> {l.reported && <Pill tone="bad">Reported</Pill>}</p>
                <p className="text-sm text-muted">{TYPE_LABEL[l.type]}{l.city ? ` · ${l.city}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => run(() => api.post(`/locations/${l.id}/verify`, { verified: !l.verified }))}>{l.verified ? 'Unverify' : 'Verify'}</Button>
                <Button variant="secondary" onClick={() => setEditing(l)}>Edit</Button>
                <Button variant="danger" onClick={() => window.confirm(`Delete ${l.name}?`) && run(() => api.del(`/locations/${l.id}`))}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Reports() {
  const { data, error: loadError, loading, reload } = useLoad(() => api.get('/admin/reports'), []);
  const { error, run } = useAction(reload);
  return (
    <Card>
      <h2 className="mb-3 text-xl font-bold">Reported listings</h2>
      <ErrorText error={error || loadError} />
      {loading ? <Loading /> : data?.length === 0 ? <Empty>No reports to review.</Empty> : (
        <ul className="divide-y divide-line">
          {data?.map((r) => (
            <li key={r.id} className="py-3">
              <p className="font-semibold">{r.name} <span className="font-normal text-muted">· {TYPE_LABEL[r.type]}</span></p>
              <p className="text-sm">“{r.report_note}”</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={() => run(() => api.post(`/admin/reports/${r.id}/dismiss`))}>Dismiss report</Button>
                <Button variant="secondary" onClick={() => run(() => api.post(`/locations/${r.id}/verify`, { verified: false }))}>Unverify listing</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Categories() {
  const { data, error: loadError, loading, reload } = useLoad(() => api.get('/categories?all=1'), []);
  const { error, run } = useAction(reload);
  const add = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries());
    body.has_battery = f.has('has_battery');
    body.stores_data = f.has('stores_data');
    run(async () => { await api.post('/categories', body); e.target.reset(); });
  };
  const toggle = (c) => run(() => api.put(`/categories/${c.id}`, { ...c, active: !c.active }));
  return (
    <Card>
      <h2 className="mb-3 text-xl font-bold">Device categories</h2>
      <ErrorText error={error || loadError} />
      <form onSubmit={add} className="mb-4 grid gap-3 rounded-md border border-line bg-paper p-4 sm:grid-cols-4">
        <Field label="Key" hint="Lowercase, e.g. camera"><Input name="key" required maxLength={40} /></Field>
        <Field label="Label"><Input name="label" required maxLength={100} /></Field>
        <Field label="Typical lifespan (years)"><Input name="typical_lifespan_years" type="number" min="1" max="30" defaultValue="5" required /></Field>
        <div className="flex flex-col justify-end gap-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="has_battery" defaultChecked /> Has a battery</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="stores_data" defaultChecked /> Stores personal data</label>
          <Button className="mt-1">Add category</Button>
        </div>
      </form>
      <p className="mb-3 text-sm text-muted">Recommendation rules have built-in price estimates for phones, laptops, tablets and peripherals. Other categories use general defaults.</p>
      {loading ? <Loading /> : (
        <ul className="divide-y divide-line">
          {data?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><span className="font-semibold">{c.label}</span> <span className="text-muted">({c.key}) · ~{c.typical_lifespan_years} yrs</span> {!c.active && <Pill tone="bad">Inactive</Pill>}</span>
              <span className="flex gap-2">
                <Button variant="secondary" onClick={() => toggle(c)}>{c.active ? 'Deactivate' : 'Reactivate'}</Button>
                <Button variant="danger" onClick={() => window.confirm(`Delete ${c.label}?`) && run(() => api.del(`/categories/${c.id}`))}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
