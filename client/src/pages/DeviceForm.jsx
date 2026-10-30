import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button, Card, CONDITION_LABEL, ErrorText, Field, Input, Loading, Page, Select, Textarea, useLoad } from '../ui.jsx';

export default function DeviceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cats = useLoad(() => api.get('/categories'), []);
  const existing = useLoad(() => (id ? api.get(`/devices/${id}`) : Promise.resolve(null)), [id]);

  if (cats.loading || existing.loading) return <Loading />;
  const d = existing.data;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries());
    try {
      const saved = id ? await api.put(`/devices/${id}`, body) : await api.post('/devices', body);
      navigate(`/devices/${saved.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Page title={id ? 'Edit device' : 'Add a device'}>
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <ErrorText error={error || cats.error || existing.error} />
          <Field label="Type of device">
            <Select name="category_id" required defaultValue={d?.category_id ?? ''}>
              <option value="" disabled>Choose one</option>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand"><Input name="brand" required maxLength={80} defaultValue={d?.brand} /></Field>
            <Field label="Model" hint="Optional."><Input name="model" maxLength={120} defaultValue={d?.model} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Age in years" hint="Your best guess is fine.">
              <Input name="age_years" type="number" step="0.5" min="0" max="60" required defaultValue={d?.age_years ?? ''} />
            </Field>
            <Field label="Condition">
              <Select name="condition" required defaultValue={d?.condition ?? ''}>
                <option value="" disabled>Choose one</option>
                {Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="What is wrong, if anything?" hint="For example: cracked screen, battery drains in an hour.">
            <Textarea name="description" maxLength={1000} defaultValue={d?.description} />
          </Field>
          <div className="flex gap-2">
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save device'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
