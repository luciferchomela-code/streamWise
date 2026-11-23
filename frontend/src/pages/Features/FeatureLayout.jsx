import React from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

export const panel = 'surface';
export const field = 'input-control';
export const action = 'sub-control';
export const primary = 'primary-control';

export function FeatureLayout({ title, tools, error, children }) {
  const { user, loading } = useAuth();
  return <div className="min-h-screen bg-[#101010] text-white">
    
    <main className="desk">
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
