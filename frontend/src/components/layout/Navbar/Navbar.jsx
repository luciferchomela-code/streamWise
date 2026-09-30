import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

export const Navbar = ({ onSearch }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpenMobile, setIsSearchOpenMobile] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const [searchValue, setSearchValue] = useState('');
  const searchDebounce = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSearchChange = (val) => {
    setSearchValue(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      if (onSearch) {
        navigate('/');
        onSearch(val);
      }
    }, 400);
  };

  // Fallback for demo purposes if not logged in
  const displayUser = user || {
    name: 'Streamwise User',
    email: 'user@streamwise.com',
    picture: 'https://ui-avatars.com/api/?name=SU&background=151923&color=fff',
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-[#0B0D12]/90 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Logo */}
        <Link to="/" className="no-underline shrink-0 flex items-center gap-2" aria-label="Streamwise Home">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="text-xl font-bold tracking-wide hidden sm:block text-white">
            Streamwise
          </div>
        </Link>

        {/* Center: Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-2xl mx-4">
          <div className="relative w-full group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-cyan-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-[#151923] border border-white/5 rounded-full py-2.5 pl-12 pr-16 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:bg-[#1A1F2B] focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-inner"
              placeholder="Search videos, creators, and topics"
              aria-label="Search"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
              <kbd className="hidden lg:inline-block px-2 py-0.5 text-xs font-semibold text-gray-500 bg-white/5 border border-white/10 rounded-md">
                /
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Mobile Search Toggle */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            onClick={() => setIsSearchOpenMobile(!isSearchOpenMobile)}
            aria-label="Toggle search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <Link to="/upload" className="hidden sm:flex items-center gap-2 p-2 px-3 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50" aria-label="Upload Video">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">Upload</span>
          </Link>

          <button className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors relative focus:outline-none focus:ring-2 focus:ring-cyan-400/50" aria-label="Notifications">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-violet-500 rounded-full border border-[#0B0D12]"></span>
          </button>
          
          <Link to="/watch-later" className="hidden sm:block p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50" aria-label="Watch Later">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </Link>

        <div className="relative">
          <button 
            className="ml-2 w-8 h-8 rounded-full overflow-hidden border border-white/10 hover:border-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50" 
            aria-label="Profile menu"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          >
            <img src={displayUser.picture || `https://ui-avatars.com/api/?name=${displayUser.name}&background=151923&color=fff`} alt="User Profile" className="w-full h-full object-cover" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileMenuOpen(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-64 bg-[#151923] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden flex flex-col py-2">
                
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-white/5 flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                    <img src={displayUser.picture || `https://ui-avatars.com/api/?name=${displayUser.name}&background=151923&color=fff`} alt="User Profile" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-semibold text-sm truncate">{displayUser.name}</span>
                    <span className="text-gray-400 text-xs truncate">{displayUser.email}</span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2 flex flex-col">
                  <Link to="/channel" onClick={() => setIsProfileMenuOpen(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Your Channel
                  </Link>
                  
                  <Link to="/watch-later" onClick={() => setIsProfileMenuOpen(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    Watch Later
                  </Link>

                  <Link to="/subscriptions" onClick={() => setIsProfileMenuOpen(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Subscriptions
                  </Link>
                  
                  <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Settings
                  </Link>
                </div>

                <div className="py-2 border-t border-white/5">
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign Out
                  </button>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Mobile Search Bar (Expandable) */}
      {isSearchOpenMobile && (
        <div className="md:hidden px-4 pb-4 bg-[#0B0D12] border-b border-white/5 shadow-lg">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              autoFocus
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-[#151923] border border-white/5 rounded-full py-2.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50"
              placeholder="Search..."
            />
          </div>
        </div>
      )}
    </header>
  );
};
