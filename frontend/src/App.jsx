import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Movements from './pages/Movements';
import Orders from './pages/Orders';
import Production from './pages/Production';
import Stock from './pages/Stock';
import { selectIsAuthenticated, useAuthStore } from './store/authStore';

function RequireAuth({ children }) {
  const authed = useAuthStore(selectIsAuthenticated);
  return authed ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuthed({ children }) {
  const authed = useAuthStore(selectIsAuthenticated);
  return authed ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/production" element={<Production />} />
          <Route path="/movements" element={<Movements />} />
          <Route path="/orders" element={<Orders />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
