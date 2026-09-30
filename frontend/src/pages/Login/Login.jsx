import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AmbientGlow } from '../../components/common/AmbientGlow/AmbientGlow';
import { GoogleButton } from '../../components/common/GoogleButton/GoogleButton';
import { Header } from '../../components/layout/Header/Header';
import { useAuth } from '../../hooks/useAuth';

export const Login = () => {
  const { loginWithGoogleCode, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (code) => {
    try {
      await loginWithGoogleCode(code);
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex bg-[#06060a] overflow-x-hidden">
      <AmbientGlow />

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row w-full min-h-screen relative z-10">
        
        {/* Left Content Side */}
        <div className="flex-1 flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-10 lg:px-16 lg:py-12 w-full lg:max-w-[55%] min-h-screen lg:min-h-0">
          
          <Header />

          {/* Hero Content */}
          <div className="my-auto py-6 sm:py-8 flex flex-col items-start justify-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-4 sm:mb-6">
              Discover videos<br />that fit your rhythm.
            </h1>
            
            <p className="text-gray-400 text-base sm:text-lg max-w-md leading-relaxed mb-6 sm:mb-8 font-light">
              Personalized learning, stories, and creators—shaped by what you actually enjoy watching.
            </p>

            {error && (
              <div className="text-red-500 text-sm mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20 max-w-md w-full">
                {error}
              </div>
            )}

            <div className="w-full mt-4 sm:mt-6 mb-2">
              <GoogleButton onSuccess={handleGoogleSuccess} loading={loading} />
            </div>

            <div className="text-gray-400 text-xs sm:text-sm mt-4 sm:mt-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] shrink-0" />
              Your watch history stays private.
            </div>
          </div>

        </div>

        {/* Right Visual Side */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-6 lg:p-12 relative min-h-screen lg:min-h-0">
          <div className="relative w-full h-[80vh] max-h-[850px] max-w-xl rounded-[24px] xl:rounded-[30px] overflow-hidden shadow-2xl">
            {/* Ambient edge fades */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#06060a] via-transparent to-transparent pointer-events-none z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06060a] via-transparent to-transparent pointer-events-none z-10" />

            <img
              src="/collage.jpg"
              alt="Video Collage"
              className="w-full h-full object-cover animate-breathe"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
