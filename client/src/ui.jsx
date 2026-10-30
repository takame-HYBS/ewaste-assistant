import { useEffect, useState } from 'react';
import { fetchPhotoUrl } from './api.js';

export const ACTION_LABEL = {
  reuse: 'Keep using it',
  repair: 'Repair it',
  donate: 'Donate it',
  parts_recovery: 'Recover parts',
  recycle: 'Recycle it',
};
export const ACTION_PAST = {
  reuse: 'Kept in use', repair: 'Repaired', donate: 'Donated', parts_recovery: 'Parts recovered', recycle: 'Recycled',
};
export const CONDITION_LABEL = {
  working: 'Works fine', minor_issues: 'Minor issues', major_issues: 'Major issues', not_working: 'Not working',
};
export const STATUS_LABEL = {
  registered: 'Registered', assessed: 'Assessed', in_progress: 'In progress', completed: 'Completed',
  planned: 'Planned', cancelled: 'Cancelled',
};
export const TYPE_LABEL = { repair: 'Repair shop', donation: 'Donation point', recycling: 'E-waste collection' };
export const TYPE_COLOR = { repair: '#1b6b4d', donation: '#8a5a00', recycling: '#2a5f9e' };

export const peso = (n) => (n == null ? '' : `₱${Math.round(Number(n)).toLocaleString('en-PH')}`);
// Plain dates (YYYY-MM-DD) are parsed as local midnight so they never display a day early.
export const dateText = (d) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

export function Page({ title, actions, children }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </main>
  );
}

export const Card = ({ className = '', children }) => (
  <section className={`rounded-md border border-line bg-card p-5 ${className}`}>{children}</section>
);

const btn = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const variants = {
  primary: `${btn} bg-board text-white hover:bg-board-dark`,
  secondary: `${btn} border border-line bg-card text-ink hover:bg-board-tint`,
  danger: `${btn} border border-danger text-danger hover:bg-danger-tint`,
};
export const Button = ({ variant = 'primary', className = '', ...p }) => (
  <button className={`${variants[variant]} ${className}`} {...p} />
);

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}
export const inputCls = 'w-full rounded-md border border-line bg-white px-3 py-2 text-base focus:border-board';
export const Input = (p) => <input className={inputCls} {...p} />;
export const Select = ({ children, ...p }) => <select className={inputCls} {...p}>{children}</select>;
export const Textarea = (p) => <textarea className={inputCls} rows={3} {...p} />;

export function Notice({ kind = 'info', children }) {
  const styles = {
    info: 'border-board bg-board-tint',
    warn: 'border-amber bg-amber-tint',
    danger: 'border-danger bg-danger-tint',
  };
  return (
    <div role={kind === 'info' ? 'status' : 'alert'} className={`rounded-md border-l-4 px-4 py-3 text-sm ${styles[kind]}`}>
      {children}
    </div>
  );
}

export const ErrorText = ({ error }) => (error ? <Notice kind="danger">{error}</Notice> : null);

export function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-paper text-muted border-line',
    good: 'bg-board-tint text-board-dark border-board/30',
    warn: 'bg-amber-tint text-amber border-amber/30',
    bad: 'bg-danger-tint text-danger border-danger/30',
  };
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export const Empty = ({ children }) => (
  <div className="rounded-md border border-dashed border-line bg-card px-5 py-10 text-center text-muted">{children}</div>
);

export const Loading = () => <p className="py-10 text-center text-muted" role="status">Loading…</p>;

// Loads a private photo (needs the auth header) into an <img>.
export function AuthImage({ assessmentId, alt, className }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    let cancelled = false;
    fetchPhotoUrl(assessmentId).then((u) => { url = u; if (!cancelled) setSrc(u); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [assessmentId]);
  return src ? <img src={src} alt={alt} className={className} /> : null;
}

// Small hook for loading data with loading + error state.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => live && setState({ data, error: '', loading: false }))
      .catch((e) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
