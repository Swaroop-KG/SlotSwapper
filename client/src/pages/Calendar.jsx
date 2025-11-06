import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function toLocalDateTimeValue(d) {
  // Format Date for datetime-local input (no timezone)
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function Calendar() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [form, setForm] = useState({ title: '', startTime: toLocalDateTimeValue(now), endTime: toLocalDateTimeValue(new Date(now.getTime() + 60*60*1000)) });
  const [error, setError] = useState('');

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => apiFetch('/api/events', { token }),
  });

  const createMut = useMutation({
    mutationFn: (payload) => apiFetch('/api/events', { method: 'POST', body: payload, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      setForm({ title: '', startTime: toLocalDateTimeValue(new Date()), endTime: '' });
      setError('');
    },
    onError: (e) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }) => apiFetch(`/api/events/${id}`, { method: 'PUT', body: updates, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
    onError: (e) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiFetch(`/api/events/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
    onError: (e) => setError(e.message),
  });

  const onCreate = (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.startTime || !form.endTime) {
      setError('Please fill all fields');
      return;
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setError('End time must be after start time');
      return;
    }
    createMut.mutate(form);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Your Events</h2>

      <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Start</label>
          <input className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" type="datetime-local" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End</label>
          <input className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" type="datetime-local" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        </div>
        <div className="lg:col-span-4">
          <button type="submit" disabled={createMut.isPending} className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50">{createMut.isPending ? 'Adding…' : 'Add'}</button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {eventsQuery.isLoading && <p className="mt-3 text-gray-600">Loading…</p>}
      {eventsQuery.error && <p className="mt-3 text-sm text-red-600">{eventsQuery.error.message}</p>}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {eventsQuery.data?.map((ev) => (
          <li key={ev._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-gray-900">{ev.title}</div>
            <div className="text-sm text-gray-600">{new Date(ev.startTime).toLocaleString()} → {new Date(ev.endTime).toLocaleString()}</div>
            <div className="mt-1 text-sm">Status: <span className="font-semibold">{ev.status}</span></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ev.status === 'BUSY' && (
                <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm border-gray-300 hover:bg-gray-100" onClick={() => updateMut.mutate({ id: ev._id, updates: { status: 'SWAPPABLE' } })}>Make Swappable</button>
              )}
              {ev.status === 'SWAPPABLE' && (
                <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm border-gray-300 hover:bg-gray-100" onClick={() => updateMut.mutate({ id: ev._id, updates: { status: 'BUSY' } })}>Make Busy</button>
              )}
              {ev.status !== 'SWAP_PENDING' && (
                <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm border-red-300 text-red-700 hover:bg-red-50" onClick={() => deleteMut.mutate(ev._id)}>Delete</button>
              )}
              {ev.status === 'SWAP_PENDING' && <span className="text-sm text-amber-600">Swap Pending…</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
