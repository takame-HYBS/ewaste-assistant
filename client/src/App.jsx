import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Loading } from './ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import Devices from './pages/Devices.jsx';
import DeviceForm from './pages/DeviceForm.jsx';
import DeviceDetail from './pages/DeviceDetail.jsx';
import Assess from './pages/Assess.jsx';
import AssessmentResult from './pages/AssessmentResult.jsx';
import Locations from './pages/Locations.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyLocations from './pages/MyLocations.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  const where = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: where.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-board text-white' : 'text-ink hover:bg-board-tint'}`;
  return (
    <header className="border-b border-line bg-card">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-3">
        <Link to="/" className="mr-4 font-display text-xl font-bold text-board-dark">Second Life</Link>
        {user?.role === 'user' || user?.role === 'admin' ? (
          <>
            <NavLink to="/devices" className={link}>My devices</NavLink>
            <NavLink to="/dashboard" className={link}>Impact</NavLink>
          </>
        ) : null}
        <NavLink to="/locations" className={link}>Find a place</NavLink>
        {user?.role === 'partner' && <NavLink to="/my-locations" className={link}>My locations</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
              <button className="rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-board-tint"
                onClick={() => { logout(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={link}>Sign in</NavLink>
              <NavLink to="/register" className={link}>Create account</NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2">Skip to content</a>
      <Nav />
      <div id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/devices" element={<Protected roles={['user', 'admin']}><Devices /></Protected>} />
          <Route path="/devices/new" element={<Protected roles={['user', 'admin']}><DeviceForm /></Protected>} />
          <Route path="/devices/:id" element={<Protected roles={['user', 'admin']}><DeviceDetail /></Protected>} />
          <Route path="/devices/:id/edit" element={<Protected roles={['user', 'admin']}><DeviceForm /></Protected>} />
          <Route path="/devices/:id/assess" element={<Protected roles={['user', 'admin']}><Assess /></Protected>} />
          <Route path="/assessments/:id" element={<Protected roles={['user', 'admin']}><AssessmentResult /></Protected>} />
          <Route path="/dashboard" element={<Protected roles={['user', 'admin']}><Dashboard /></Protected>} />
          <Route path="/my-locations" element={<Protected roles={['partner']}><MyLocations /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
          <Route path="*" element={<main className="p-10 text-center">Page not found. <Link className="underline" to="/">Go home</Link></main>} />
        </Routes>
      </div>
    </>
  );
}
