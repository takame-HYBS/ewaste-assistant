// Thin fetch wrapper. Stores the JWT in memory + localStorage (wrapped: storage can be unavailable).
let token = null;
try { token = localStorage.getItem('token'); } catch { /* storage unavailable */ }

export function setToken(t) {
  token = t;
  try { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); } catch { /* ignore */ }
}
export const getToken = () => token;

async function request(method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};

// Photos are private, so they need the auth header and can't be used as a plain <img src>.
export async function fetchPhotoUrl(assessmentId) {
  const res = await fetch(`/api/assessments/${assessmentId}/photo`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}
