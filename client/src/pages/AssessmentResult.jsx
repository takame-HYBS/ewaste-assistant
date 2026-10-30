import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  ACTION_LABEL, AuthImage, Card, ErrorText, Loading, Notice, Page, peso, Pill, TYPE_LABEL, useLoad, variants,
} from '../ui.jsx';

// Which kind of place helps with each action.
const PLACE_TYPES = { repair: ['repair'], donate: ['donation'], recycle: ['recycling'], parts_recovery: ['repair', 'recycling'], reuse: [] };

const RULE_TITLE = (r) => r.rule.replace(/[._]/g, ' ');

export default function AssessmentResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: a, error, loading } = useLoad(() => api.get(`/assessments/${id}`), [id]);
  const places = useLoad(
    () => (a ? api.get(`/locations?category=${a.category_key}`) : Promise.resolve([])),
    [a?.category_key]
  );

  if (loading) return <Loading />;
  if (error) return <Page title="Recommendation"><ErrorText error={error} /></Page>;

  const confTone = { high: 'good', medium: 'warn', low: 'bad' }[a.confidence];
  const relevant = (places.data || []).filter((l) => PLACE_TYPES[a.result_action]?.includes(l.type));
  const hint = a.photo_hint;

  return (
    <Page title="Recommendation" actions={<Link to={`/devices/${a.device_id}`} className={variants.secondary}>Back to device</Link>}>
      <div className="space-y-5">
        {a.safety_notes.map((n) => <Notice key={n} kind="danger"><strong>Safety: </strong>{n}</Notice>)}

        <Card>
          <p className="text-sm text-muted">{a.brand} {a.model} · {a.category_label}</p>
          <h2 className="mt-1 text-4xl font-bold">{ACTION_LABEL[a.result_action]}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={confTone}>{a.confidence} confidence</Pill>
            {a.repair_cost != null && (
              <Pill>Repair cost used: {peso(a.repair_cost)} ({a.repair_cost_source === 'user_quote' ? 'your quote' : 'rough estimate'})</Pill>
            )}
            {a.current_value != null && <Pill>Estimated value: {peso(a.current_value)}</Pill>}
          </div>
          {a.confidence !== 'high' && (
            <p className="mt-3 text-sm text-muted">
              {a.repair_cost_source === 'rough_estimate'
                ? 'Confidence is limited because the repair cost is a rough estimate. Get a written quote and run the questions again.'
                : 'The options scored close together, so treat this as a starting point and check with a technician.'}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-xl font-bold">Why this recommendation</h2>
          <p className="mb-3 text-sm text-muted">Each line is a rule that applied to your answers. Positive points favor an option; negative points count against it.</p>
          {a.explanation.length === 0 ? <p className="text-sm text-muted">No rules adjusted the score.</p> : (
            <ul className="divide-y divide-line">
              {a.explanation.map((r, i) => (
                <li key={i} className="grid grid-cols-[3.5rem_1fr] gap-3 py-2 text-sm">
                  <span className={`font-display text-lg font-bold ${r.points < 0 ? 'text-danger' : 'text-board'}`} aria-label={r.points == null ? 'safety rule' : `${r.points} points for ${ACTION_LABEL[r.action]}`}>
                    {r.points == null ? '!' : r.points > 0 ? `+${r.points}` : r.points}
                  </span>
                  <span>
                    <span className="font-semibold">{ACTION_LABEL[r.action]}</span>
                    <span className="text-muted"> · {RULE_TITLE(r)}</span>
                    <span className="block">{r.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-5 font-bold">All options compared</h3>
          <ol className="flex flex-wrap gap-2">
            {a.ranking.map((r) => (
              <li key={r.action}><Pill tone={r.action === a.result_action ? 'good' : 'neutral'}>{ACTION_LABEL[r.action]}{r.score == null ? '' : `: ${r.score}`}</Pill></li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="mb-2 text-xl font-bold">Next steps</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{a.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
        </Card>

        {PLACE_TYPES[a.result_action]?.length > 0 && (
          <Card>
            <h2 className="mb-2 text-xl font-bold">Places that can help</h2>
            {relevant.length === 0 ? (
              <p className="text-sm text-muted">No verified places match yet. <Link className="underline" to="/locations">Browse the full map</Link>.</p>
            ) : (
              <ul className="divide-y divide-line">
                {relevant.slice(0, 5).map((l) => (
                  <li key={l.id} className="py-2 text-sm">
                    <span className="font-semibold">{l.name}</span> <span className="text-muted">· {TYPE_LABEL[l.type]}{l.city ? ` · ${l.city}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/locations" className="mt-3 inline-block text-sm underline">See all on the map</Link>
          </Card>
        )}

        {a.has_photo && (
          <Card>
            <h2 className="mb-2 text-xl font-bold">Your photo</h2>
            <AuthImage assessmentId={a.id} alt="The device you uploaded" className="max-h-72 rounded-md border border-line" />
            {hint && (
              <p className="mt-2 text-sm text-muted">
                Automatic guess: “{hint.label}”{hint.confidence != null ? ` (${Math.round(hint.confidence * 100)}%)` : ''}. {hint.note}
              </p>
            )}
          </Card>
        )}

        <Notice kind="warn">{a.disclaimer}</Notice>
        <button className={variants.primary} onClick={() => navigate(`/devices/${a.device_id}`)}>Record what you decide to do</button>
      </div>
    </Page>
  );
}
