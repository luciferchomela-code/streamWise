import React from 'react';
import { Link } from 'react-router-dom';

export const Header = ({ explorePath = '/explore' }) => {
  return (
    <header className="flex justify-between items-center w-full z-20 shrink-0">
      <Link to="/" className="no-underline">
        <div className="text-xl sm:text-2xl font-bold tracking-widest bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
          STREAMWISE
        </div>
      </Link>
      <Link to={explorePath} className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
        Explore &bull;
      </Link>
    </header>
  );
};
