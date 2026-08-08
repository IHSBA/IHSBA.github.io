import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles/theme.css';

// HashRouter (not BrowserRouter): GitHub Pages is a static host with no
// server-side rewrite, so a real path like /players/123 would 404 on a
// hard refresh. Hash routes (/#/players/123) always resolve to index.html.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
