import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button, Card, ErrorText, Field, Input, Loading, Notice, Page, Select, useLoad } from '../ui.jsx';

const YN = [['', 'Not sure'], ['yes', 'Yes'], ['no', 'No']];

// Each question shows only when relevant to the device's reported condition or category.
const QUESTIONS = [
  { key: 'powers_on', label: 'Does it turn on?', opts: [['', 'Not sure'], ['yes', 'Yes'], ['sometimes', 'Sometimes'], ['no', 'No']], when: (d) => d.condition !== 'working' },
  { key: 'screen_damage', label: 'Is the screen damaged?', opts: [['', 'Not sure'], ['none', 'No'], ['cracked', 'Cracked but works'], ['dead', 'Does not display']], when: (d) => d.category_key !== 'peripheral' && d.condition !== 'working' },
  { key: 'water_damage', label: 'Has it been exposed to liquid?', opts: YN, when: (d) => d.condition !== 'working' },
  { key: 'cosmetic_only', label: 'Is the damage only cosmetic, like scratches or dents?', opts: YN, when: (d) => d.condition === 'minor_issues' },
  { key: 'battery_swollen', label: 'Does the battery look swollen, or is the case bulging?', opts: YN, when: (d) => d.has_battery, hint: 'Safety check. Answer yes if the case is lifting or the device sits unevenly.' },
  { key: 'battery_health', label: 'How is the battery?', opts: [['', 'Not sure'], ['ok', 'Fine'], ['poor', 'Drains quickly']], when: (d) => d.has_battery },
  { key: 'software_supported', label: 'Does it still get security updates?', opts: [['', 'Not sure'], ['yes', 'Yes'], ['no', 'No']], when: (d) => d.category_key !== 'peripheral' },
  { key: 'has_personal_data', label: 'Does it hold personal data?', opts: YN, when: (d) => d.stores_data },
  { key: 'still_needed', label: 'Do you still need it?', opts: [['', 'Not sure'], ['yes', 'Yes'], ['no', 'No']] },
];

export default function Assess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: d, error, loading } = useLoad(async () => {
    const [device, cats] = await Promise.all([api.get(`/devices/${id}`), api.get('/categories?all=1')]);
    const cat = cats.find((c) => c.id === device.category_id) || {};
    return { ...device, has_battery: cat.has_battery ?? true, stores_data: cat.stores_data ?? true };
  }, [id]);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) return <Page title="Get a recommendation"><ErrorText error={error} /></Page>;

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    const f = new FormData(e.target);
    const answers = {};
    for (const q of QUESTIONS) { const v = f.get(q.key); if (v) answers[q.key] = v; }
    const quote = f.get('repair_quote');
    if (quote) answers.repair_quote = Number(quote);

    const body = new FormData();
    body.append('answers', JSON.stringify(answers));
    const photo = f.get('photo');
    if (photo && photo.size > 0) body.append('photo', photo);
    try {
      const a = await api.post(`/devices/${d.id}/assessments`, body);
      navigate(`/assessments/${a.id}`);
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <Page title={`Questions about your ${d.brand} ${d.model}`.trim()}>
      <Card className="max-w-2xl">
        <p className="mb-4 text-sm text-muted">
          Skip anything you are unsure about. More answers give a more confident recommendation.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <ErrorText error={formError} />
          {QUESTIONS.filter((q) => !q.when || q.when(d)).map((q) => (
            <Field key={q.key} label={q.label} hint={q.hint}>
              <Select name={q.key} defaultValue="">{q.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
          ))}
          {d.condition !== 'working' && (
            <Field label="Repair quote, if you have one (₱)" hint="A written quote from a shop makes the recommendation more reliable than our rough estimate.">
              <Input name="repair_quote" type="number" min="0" step="1" inputMode="numeric" />
            </Field>
          )}
          <Field label="Photo of the device" hint="Optional. JPEG, PNG or WebP, up to 5 MB. A photo is kept as a reference and cannot show internal damage.">
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" />
          </Field>
          <Notice kind="warn">If the battery is swollen, hot or leaking, stop using and charging the device now.</Notice>
          <Button disabled={busy}>{busy ? 'Working it out…' : 'Get my recommendation'}</Button>
        </form>
      </Card>
    </Page>
  );
}
