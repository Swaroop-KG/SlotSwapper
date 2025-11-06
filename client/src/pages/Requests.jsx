import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Requests() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const reqsQuery = useQuery({
    queryKey: ['requests'],
    queryFn: () => apiFetch('/api/requests', { token }),
  });

  const respondMut = useMutation({
    mutationFn: ({ id, accept }) => apiFetch(`/api/swap-response/${id}`, { method: 'POST', body: { accept }, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['marketplace', 'swappable'] });
      setError('');
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold">Swap Requests</h2>
      {reqsQuery.isLoading && <p className="mt-3 text-gray-600">Loading…</p>}
      {(reqsQuery.error || error) && <p className="mt-3 text-sm text-red-600">{reqsQuery.error?.message || error}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="text-lg font-semibold mb-2">Incoming</h3>
          <ul className="space-y-3">
            {reqsQuery.data?.incoming?.map((r) => (
              <li key={r._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  <strong>{r.requesterUser?.name || r.requesterUser?.email}</strong> offered "{r.mySlot?.title}" for your "{r.theirSlot?.title}"
                </div>
                <div className="text-sm mt-1">Status: <strong>{r.status}</strong></div>
                {r.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <button className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500 disabled:opacity-50" disabled={respondMut.isPending} onClick={() => respondMut.mutate({ id: r._id, accept: true })}>Accept</button>
                    <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm border-gray-300 hover:bg-gray-100 disabled:opacity-50" disabled={respondMut.isPending} onClick={() => respondMut.mutate({ id: r._id, accept: false })}>Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">Outgoing</h3>
          <ul className="space-y-3">
            {reqsQuery.data?.outgoing?.map((r) => (
              <li key={r._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  You offered "{r.mySlot?.title}" for <strong>{r.receiverUser?.name || r.receiverUser?.email}</strong>'s "{r.theirSlot?.title}"
                </div>
                <div className="text-sm mt-1">Status: <strong>{r.status}</strong></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
