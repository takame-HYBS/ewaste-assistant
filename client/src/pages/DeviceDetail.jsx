import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  ACTION_LABEL, Button, Card, CONDITION_LABEL, dateText, Empty, ErrorText, Field, Input, Loading, Notice, Page, Pill,
  Select, STATUS_LABEL, Textarea, useLoad, variants,
} from '../ui.jsx';

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: d, error, loading, reload } = useLoad(() => api.get(`/devices/${id}`), [id]);
  const [actionError, setActionError] = useState('');

  if (loading) return <Loading />;
  if (error) return <Page title="Device"><ErrorText error={error} /></Page>;

  const locked = d.status === 'completed';

  const remove = async () => {
    if (!window.confirm('Delete this device and its assessments? This cannot be undone.')) return;
    try { await api.del(`/devices/${d.id}`); navigate('/devices'); } catch (e) { setActionError(e.message); }
  };

  return (
    <Page
      title={`${d.brand} ${d.model}`}
      actions={
        <>
          <Link to={`/devices/${d.id}/assess`} className={variants.primary}>Get a recommendation</Link>
          {!locked && <Link to={`/devices/${d.id}/edit`} className={variants.secondary}>Edit</Link>}
          <Button variant="danger" onClick={remove}>Delete</Button>
        </>
      }
    >
      <ErrorText error={actionError} />
      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        <Card>
          <h2 className="mb-2 text-xl font-bold">Details</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Type" v={d.category_label} />
            <Row k="Age" v={`${Number(d.age_years)} years`} />
            <Row k="Condition" v={CONDITION_LABEL[d.condition]} />
            <Row k="Status" v={<Pill tone={locked ? 'good' : 'neutral'}>{STATUS_LABEL[d.status]}</Pill>} />
            {d.description && <Row k="Notes" v={d.description} />}
          </dl>
          {locked && <div className="mt-4"><Notice>This device has a completed action, so its details are locked to keep the record accurate.</Notice></div>}
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-xl font-bold">Recommendations</h2>
            {d.assessments.length === 0 ? <Empty>No recommendation yet. Answer a few questions to get one.</Empty> : (
              <ul className="divide-y divide-line">
                {d.assessments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <Link className="font-semibold underline" to={`/assessments/${a.id}`}>{ACTION_LABEL[a.result_action]}</Link>
                    <span className="text-sm text-muted">{dateText(a.created_at)} · {a.confidence} confidence</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ActionsCard device={d} onChange={reload} />
        </div>
      </div>
    </Page>
  );
}

const Row = ({ k, v }) => (
  <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">{k}</dt><dd>{v}</dd></div>
);

function ActionsCard({ device, onChange }) {
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const locations = useLoad(() => api.get('/locations'), []);

  const run = async (fn) => { setError(''); try { await fn(); onChange(); } catch (e) { setError(e.message); } };
  const setStatus = (a, status) => run(() => api.put(`/actions/${a.id}`, { status }));
  const remove = (a) => window.confirm('Remove this action?') && run(() => api.del(`/actions/${a.id}`));

  const add = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    await run(async () => {
      await api.post(`/devices/${device.id}/actions`, { ...f, assessment_id: device.assessments[0]?.id });
      setAdding(false);
    });
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">What you did with it</h2>
        {!adding && <Button variant="secondary" onClick={() => setAdding(true)}>Record an action</Button>}
      </div>
      <ErrorText error={error} />
      {adding && (
        <form onSubmit={add} className="mb-4 space-y-3 rounded-md border border-line bg-paper p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Action">
              <Select name="action" required defaultValue={device.assessments[0]?.result_action ?? ''}>
                <option value="" disabled>Choose one</option>
                {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="planned">
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
            <Field label="Place" hint="Optional.">
              <Select name="location_id" defaultValue="">
                <option value="">No place chosen</option>
                {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
            <Field label="Date" hint="Leave blank to use today if completed."><Input name="action_date" type="date" /></Field>
          </div>
          <Field label="Notes" hint="Optional."><Textarea name="notes" maxLength={1000} /></Field>
          <div className="flex gap-2">
            <Button>Save action</Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {device.actions.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
        <ul className="divide-y divide-line">
          {device.actions.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{ACTION_LABEL[a.action]}</span>
                <Pill tone={a.status === 'completed' ? 'good' : a.status === 'cancelled' ? 'bad' : 'warn'}>{STATUS_LABEL[a.status]}</Pill>
              </div>
              <p className="text-sm text-muted">
                {[a.location_name, a.action_date && dateText(a.action_date)].filter(Boolean).join(' · ') || 'No place or date'}
              </p>
              {a.notes && <p className="mt-1 text-sm">{a.notes}</p>}
              {a.status !== 'completed' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.status === 'planned' && <Button variant="secondary" onClick={() => setStatus(a, 'in_progress')}>Start</Button>}
                  <Button variant="secondary" onClick={() => setStatus(a, 'completed')}>Mark completed</Button>
                  {a.status !== 'cancelled' && <Button variant="secondary" onClick={() => setStatus(a, 'cancelled')}>Cancel</Button>}
                  <Button variant="danger" onClick={() => remove(a)}>Remove</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
