import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { useAuth } from '../../hooks/useAuth';

export const panel = 'rounded-2xl border border-white/10 bg-[#151923] p-4 sm:p-5';
export const field = 'rounded-lg border border-white/15 bg-[#0B0D12] px-3 py-2 text-white';
export const action = 'rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400';
export const primary = 'rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white';

export function FeatureLayout({ title, tools, error, children }) {
  const { user, loading } = useAuth();
  return <div className="min-h-screen bg-[#0B0D12] text-white">
    <Navbar />
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {user && tools}
      </header>
      {loading ? <p role="status">Loading account…</p> : !user
        ? <Link className={primary} to="/login">Sign in</Link>
        : <>{error && <p role="alert" className="text-red-300">{error}</p>}{children}</>}
    </main>
  </div>;
}
