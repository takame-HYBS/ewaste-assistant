import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CONDITION_LABEL, Empty, ErrorText, Loading, Page, Pill, STATUS_LABEL, useLoad, variants } from '../ui.jsx';

const tone = { registered: 'neutral', assessed: 'warn', in_progress: 'warn', completed: 'good' };

export default function Devices() {
  const { user } = useAuth();
  const { data, error, loading } = useLoad(() => api.get(user.role === 'admin' ? '/devices?all=1' : '/devices'), [user.role]);
  return (
    <Page title="My devices" actions={<Link to="/devices/new" className={variants.primary}>Add a device</Link>}>
      <ErrorText error={error} />
      {loading ? <Loading /> : data?.length === 0 ? (
        <Empty>
          <p className="mb-3">You have not added any devices yet.</p>
          <Link to="/devices/new" className={variants.primary}>Add your first device</Link>
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data?.map((d) => (
            <li key={d.id}>
              <Link to={`/devices/${d.id}`} className="block rounded-md border border-line bg-card p-4 hover:border-board">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{d.brand} {d.model}</h2>
                  <Pill tone={tone[d.status]}>{STATUS_LABEL[d.status]}</Pill>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {d.category_label} · {Number(d.age_years)} yr old · {CONDITION_LABEL[d.condition]}
                </p>
                {user.role === 'admin' && <p className="mt-1 text-xs text-muted">Owner: {d.owner_name}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
