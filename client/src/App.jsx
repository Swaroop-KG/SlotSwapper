import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Calendar from './pages/Calendar.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Requests from './pages/Requests.jsx';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function Nav() {
  const { isAuthenticated, logout, user } = useAuth();
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link className="font-semibold text-indigo-600" to="/">SlotSwapper</Link>
        {isAuthenticated && <Link className="text-gray-700 hover:text-indigo-600" to="/calendar">Calendar</Link>}
        {isAuthenticated && <Link className="text-gray-700 hover:text-indigo-600" to="/marketplace">Marketplace</Link>}
        {isAuthenticated && <Link className="text-gray-700 hover:text-indigo-600" to="/requests">Requests</Link>}
        <div className="ml-auto flex items-center gap-3">
          {!isAuthenticated && <Link className="text-gray-700 hover:text-indigo-600" to="/login">Login</Link>}
          {!isAuthenticated && <Link className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500" to="/signup">Sign Up</Link>}
          {isAuthenticated && (
            <>
              <span className="hidden sm:inline text-sm text-gray-600">Hi, {user?.name || user?.email}</span>
              <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm border-gray-300 hover:bg-gray-100" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-full">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/requests" element={<Requests />} />
          </Route>

          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </main>
    </div>
  );
}
