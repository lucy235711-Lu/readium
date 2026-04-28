import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import HomePage from './pages/HomePage';
import ReaderPage from './pages/ReaderPage';
import ZhiyinPage from './pages/ZhiyinPage';
import UniversePage from './pages/UniversePage';

function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(155deg,#f5f3f0 0%,#f0ece6 40%,#ede9e4 100%)',
    }}>
      <div style={{
        background: 'rgba(250,248,244,0.85)',
        backdropFilter: 'blur(28px)',
        borderRadius: '24px',
        border: '0.5px solid rgba(255,255,255,0.78)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.10)',
        padding: '48px 56px',
        textAlign: 'center',
        maxWidth: '360px',
        width: '100%',
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1410', margin: '0 0 8px' }}>Readium</h1>
        <p style={{ color: '#7a6e62', fontSize: '14px', margin: '0 0 36px' }}>Mind in Charge, Tech on Call</p>
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', border: '0.5px solid rgba(200,194,184,0.65)',
            borderRadius: '12px', fontSize: '15px', fontWeight: 500,
            background: 'white', color: '#1c1916', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          {loading ? '跳转中...' : '用 Google 账号登录'}
        </button>
        <p style={{ color: '#a09890', fontSize: '12px', margin: '20px 0 0' }}>
          你的书单和笔记将保存在你的账号下
        </p>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3f0' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid #d0c8be', borderTopColor: '#5a3e28', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/zhiyin" element={<ZhiyinPage />} />
        <Route path="/universe" element={<UniversePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
