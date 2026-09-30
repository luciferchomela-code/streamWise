import React from 'react';

export const AmbientGlow = () => {
  return (
    <>
      <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(139,92,246,0.15)_0%,rgba(0,0,0,0)_70%)] -top-[200px] -left-[200px] z-0 pointer-events-none" />
      <div className="absolute w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(0,240,255,0.1)_0%,rgba(0,0,0,0)_70%)] -bottom-[300px] right-[30vw] z-0 pointer-events-none" />
    </>
  );
};
