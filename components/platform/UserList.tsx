'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientApiJson } from '@/lib/api/client';

interface Membership {
  tenantId: string;
  tenantName: string;
  role: string;
}

export interface UserItem {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  memberships: Membership[];
}

interface UserListProps {
  initialUsers: UserItem[];
}

export default function UserList({ initialUsers }: UserListProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filteredUsers = users.filter((user) => {
    const term = search.toLowerCase();
    return (
      user.email.toLowerCase().includes(term) ||
      (user.name && user.name.toLowerCase().includes(term)) ||
      (user.phone && user.phone.includes(term))
    );
  });

  const handleToggleStatus = async (user: UserItem) => {
    if (!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} this user?`)) {
      return;
    }

    setLoadingId(user.id);
    try {
      const result = await clientApiJson<{ isActive: boolean }>(`/api/platform/users/${user.id}/toggle-status`, {
        method: 'POST',
      });

      if (!result.response.ok) {
        throw new Error('Failed to update status');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: result.payload.isActive } : u))
      );
    } catch (error) {
      alert('Failed to update status');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search users by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border-slate-200 pl-10 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">User</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">Tenants & Roles</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="group hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-9 w-9 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                         {user.name ? user.name.substring(0, 2).toUpperCase() : user.email.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-semibold text-slate-900">{user.name || '-'}</div>
                        <div className="text-xs text-slate-400">Created {new Date(user.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-slate-600">{user.email}</div>
                    <div className="text-xs text-slate-400 font-mono">{user.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {user.memberships.length > 0 ? (
                        user.memberships.map((m, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                             <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                             <Link
                               href={`/platform/tenants/${m.tenantId}`}
                               className="font-medium text-slate-900 hover:text-indigo-600 hover:underline flex items-center gap-1"
                             >
                               {m.tenantName}
                               <svg className="h-3 w-3 text-slate-400 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                               </svg>
                             </Link>
                             <span className="text-slate-400">({m.role})</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No memberships</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <button
                       onClick={() => handleToggleStatus(user)}
                       disabled={loadingId === user.id}
                       className={`font-medium transition-colors ${
                         user.isActive 
                           ? 'text-rose-600 hover:text-rose-900' 
                           : 'text-emerald-600 hover:text-emerald-900'
                       } ${loadingId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {loadingId === user.id ? 'Updating...' : (user.isActive ? 'Deactivate' : 'Activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
             <div className="py-12 text-center text-sm text-slate-500">
               No users found matching your search.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
