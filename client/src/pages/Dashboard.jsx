import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ACTION_PAST, Card, Empty, ErrorText, Loading, Page, STATUS_LABEL, useLoad } from '../ui.jsx';

// Plain horizontal bars: labelled and sized by value, readable without color.
function Bars({ rows, label, value }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={label(r)} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-sm">
          <span>{label(r)}</span>
          <span className="h-3 rounded-sm bg-paper" aria-hidden="true">
            <span className="block h-3 rounded-sm bg-board" style={{ width: `${(value(r) / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold">{value(r)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [scope, setScope] = useState('mine');
  const { data: s, error, loading } = useLoad(() => api.get(`/stats?scope=${scope}`), [scope]);

  return (
    <Page
      title="Your impact"
      actions={user.role === 'admin' && (
        <select aria-label="Whose numbers" className="rounded-md border border-line bg-white px-3 py-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="mine">My devices</option>
          <option value="all">Everyone</option>
        </select>
      )}
    >
      <ErrorText error={error} />
      {loading ? <Loading /> : s && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat n={s.totalDevices} label="Devices registered" />
            <Stat n={s.completed} label="Actions completed" />
            <Stat n={s.keptInUse} label="Kept in use instead of recycled" />
          </div>
          {s.completed === 0 ? (
            <Empty>Nothing completed yet. When you finish repairing, donating or recycling a device, record it on the device page and it will show up here.</Empty>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <h2 className="mb-3 text-xl font-bold">What happened to them</h2>
                <Bars rows={Object.entries(s.actions)} label={([k]) => ACTION_PAST[k]} value={([, n]) => n} />
              </Card>
              <Card>
                <h2 className="mb-3 text-xl font-bold">By device type</h2>
                <Bars rows={s.byCategory} label={(r) => r.category.split(' (')[0]} value={(r) => r.count} />
              </Card>
              {s.monthly.length > 0 && (
                <Card className="md:col-span-2">
                  <h2 className="mb-3 text-xl font-bold">Completed per month</h2>
                  <Bars rows={s.monthly} label={(r) => r.month} value={(r) => r.count} />
                </Card>
              )}
            </div>
          )}
          <Card>
            <h2 className="mb-3 text-xl font-bold">Where your devices stand</h2>
            <Bars rows={Object.entries(s.deviceStatus)} label={([k]) => STATUS_LABEL[k]} value={([, n]) => n} />
          </Card>
        </div>
      )}
    </Page>
  );
}

const Stat = ({ n, label }) => (
  <div className="rounded-md border border-line bg-card p-4">
    <p className="font-display text-4xl font-bold text-board-dark">{n}</p>
    <p className="text-sm text-muted">{label}</p>
  </div>
);
