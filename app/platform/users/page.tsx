import { redirect } from 'next/navigation';
import { getCurrentUserSession } from '@/lib/auth/session';
import { serverApiJson } from '@/lib/api/server';
import UserList, { UserItem } from '@/components/platform/UserList';
import LogoutButton from '@/components/auth/LogoutButton';
import Link from 'next/link';

export default async function PlatformUsersPage() {
  const session = await getCurrentUserSession();

  if (!session) {
    redirect('/login');
  }

  const { response, payload } = await serverApiJson<{ users: UserItem[] }>('/api/platform/users');

  if (response.status === 403) {
     redirect('/t');
  }

  const users = response.ok && payload ? payload.users : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
             <Link
               href="/platform"
               className="group inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
             >
               <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
               </svg>
             </Link>
             <div>
               <div className="flex items-center gap-2 mb-0.5">
                 <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Control</span>
               </div>
               <h1 className="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">User Management</h1>
             </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <UserList initialUsers={users} />
      </main>
    </div>
  );
}
