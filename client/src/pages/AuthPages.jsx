import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Button, Card, ErrorText, Field, Input, Select } from '../ui.jsx';

const home = (u) => (u.role === 'partner' ? '/my-locations' : u.role === 'admin' ? '/admin' : '/devices');

function useSubmit(fn) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await fn(new FormData(e.target)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return { error, busy, submit };
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  const { error, busy, submit } = useSubmit(async (f) => {
    const user = await login(f.get('email'), f.get('password'));
    navigate(from || home(user), { replace: true });
  });
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Card>
        <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
        <form onSubmit={submit} className="space-y-4">
          <ErrorText error={error} />
          <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
          <Button disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="mt-4 text-sm text-muted">New here? <Link className="underline" to="/register">Create an account</Link></p>
      </Card>
    </main>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { error, busy, submit } = useSubmit(async (f) => {
    const user = await register({ name: f.get('name'), email: f.get('email'), password: f.get('password'), role: f.get('role') });
    navigate(home(user), { replace: true });
  });
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Card>
        <h1 className="mb-4 text-2xl font-bold">Create an account</h1>
        <form onSubmit={submit} className="space-y-4">
          <ErrorText error={error} />
          <Field label="Name"><Input name="name" autoComplete="name" required maxLength={100} /></Field>
          <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Password" hint="At least 8 characters."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
          <Field label="I am" hint="Partners list their shop or collection point. Listings are checked by an administrator before they appear publicly.">
            <Select name="role" defaultValue="user">
              <option value="user">A device owner</option>
              <option value="partner">A repair or recycling partner</option>
            </Select>
          </Field>
          <Button disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create account'}</Button>
        </form>
        <p className="mt-4 text-sm text-muted">Already registered? <Link className="underline" to="/login">Sign in</Link></p>
      </Card>
    </main>
  );
}
