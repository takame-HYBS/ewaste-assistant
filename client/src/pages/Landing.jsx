import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { variants } from '../ui.jsx';

const options = [
  ['Repair', 'Worth fixing when the cost is small next to what the device is worth.'],
  ['Reuse', 'A working device you still need is already the greenest choice.'],
  ['Donate', 'Working devices you have outgrown can help someone else.'],
  ['Recover parts', 'Dead devices often hold screens, storage and batteries worth saving.'],
  ['Recycle', 'When nothing else fits, hand it to a proper collection point.'],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
        Old phone, laptop or tablet? Find out whether to fix it, pass it on or recycle it.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Describe your device and answer a few questions. You get a clear recommendation, the reasons behind it,
        and nearby places that can help.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to={user ? '/devices/new' : '/register'} className={variants.primary}>
          {user ? 'Add a device' : 'Create a free account'}
        </Link>
        <Link to="/locations" className={variants.secondary}>Find repair and recycling places</Link>
      </div>

      <h2 className="mb-4 mt-16 text-2xl font-bold">Five possible outcomes</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {options.map(([name, text]) => (
          <li key={name} className="rounded-md border border-line bg-card p-4">
            <h3 className="font-bold">{name}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>

      <p className="mt-10 max-w-2xl rounded-md border-l-4 border-amber bg-amber-tint px-4 py-3 text-sm">
        Recommendations are general guidance based on your answers, not a diagnosis. A qualified technician should
        confirm any repair, especially for batteries and liquid damage.
      </p>
    </main>
  );
}
