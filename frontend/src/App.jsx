import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppRoutes } from './routes/AppRoutes';
import './index.css';

import { AuthProvider } from './hooks/useAuth';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '21441959275-0bojkheugd6qvsikdmm2r45gtvvpld46.apps.googleusercontent.com';

const App = () => {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
