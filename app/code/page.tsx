import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function CodePage() {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_code_verified')?.value === 'true' || cookieStore.get('pirates_demo')?.value === 'true') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pirate-dark)] px-4">
      <div className="card max-w-sm w-full text-center">
        <h1 className="text-xl font-bold text-[var(--pirate-yellow)] mb-2">Team code</h1>
        <p className="text-slate-400 text-sm mb-4">Enter the code to open the dashboard.</p>
        <form action="/api/set-code-cookie" method="POST" className="flex gap-2">
          <input
            type="text"
            name="code"
            placeholder="Code"
            className="input-field flex-1 py-2.5"
            required
            autoFocus
            autoComplete="off"
          />
          <button type="submit" className="btn-primary py-2.5 px-4">
            Go
          </button>
        </form>
        <p className="mt-4 text-slate-500 text-sm">
          <Link href="/login" className="text-amber-400 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
