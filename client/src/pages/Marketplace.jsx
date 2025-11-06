import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Marketplace() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [selectedOffer, setSelectedOffer] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const swappableQuery = useQuery({
    queryKey: ['marketplace', 'swappable'],
    queryFn: () => apiFetch('/api/swappable-slots', { token }),
  });

  const myEventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => apiFetch('/api/events', { token }),
  });

  const mySwappable = useMemo(() => (myEventsQuery.data || []).filter((e) => e.status === 'SWAPPABLE'), [myEventsQuery.data]);

  const requestMut = useMutation({
    mutationFn: ({ mySlotId, theirSlotId }) => apiFetch('/api/swap-request', { method: 'POST', body: { mySlotId, theirSlotId }, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'swappable'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      setSelectedOffer({});
      setError('');
      setSuccess('Swap request sent!');
      setTimeout(() => setSuccess(''), 2500);
    },
    onError: (e) => {
      setSuccess('');
      setError(e.message);
    },
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold">Marketplace</h2>
      <p className="text-gray-600">Available swappable slots from other users.</p>

      {success && <p className="mt-3 text-sm text-green-700">{success}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {swappableQuery.isLoading && <p className="mt-3 text-gray-600">Loading…</p>}
      {swappableQuery.error && <p className="mt-3 text-sm text-red-600">{swappableQuery.error.message}</p>}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {swappableQuery.data?.map((ev) => (
          <li key={ev._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-gray-900">{ev.title}</div>
            <div className="text-sm text-gray-600">{new Date(ev.startTime).toLocaleString()} → {new Date(ev.endTime).toLocaleString()}</div>
            <div className="mt-1 text-sm text-gray-700">Owner: {ev.owner?.name || ev.owner?.email || 'Other user'}</div>

            {mySwappable.length === 0 ? (
              <em className="mt-2 block text-sm text-gray-600">You have no swappable slots to offer. Mark one of your events as SWAPPABLE.</em>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedOffer[ev._id] || ''}
                  onChange={(e) => setSelectedOffer((s) => ({ ...s, [ev._id]: e.target.value }))}
                >
                  <option value="">Select your offer…</option>
                  {mySwappable.map((mine) => (
                    <option key={mine._id} value={mine._id}>
                      {mine.title} ({new Date(mine.startTime).toLocaleString()})
                    </option>
                  ))}
                </select>
                <button
                  className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500 disabled:opacity-50"
                  disabled={!selectedOffer[ev._id] || requestMut.isPending}
                  onClick={() => requestMut.mutate({ mySlotId: selectedOffer[ev._id], theirSlotId: ev._id })}
                >
                  {requestMut.isPending ? 'Sending…' : 'Request Swap'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
