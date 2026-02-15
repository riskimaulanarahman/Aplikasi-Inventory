import { redirect } from 'next/navigation';
import { getCurrentUserSession } from '@/lib/auth/session';

export default async function HomePage() {
  const session = await getCurrentUserSession();

  if (session) {
    redirect('/t');
  }

  redirect('/login');
}
