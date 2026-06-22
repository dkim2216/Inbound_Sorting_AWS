import { useState, useEffect } from 'react';
import { LogIn, User, Lock, RefreshCw, AlertCircle } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [savedSession, setSavedSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('sorter_user');
    const savedSessionId = localStorage.getItem('sorter_active_session');
    const savedSessionName = localStorage.getItem('sorter_active_session_name');
    const savedAt = localStorage.getItem('sorter_saved_at');

    if (savedUser && savedSessionId) {
      setSavedSession({
        user: savedUser,
        sessionId: savedSessionId,
        sessionName: savedSessionName || `Session #${savedSessionId}`,
        savedAt: savedAt ? new Date(savedAt).toLocaleString() : null,
      });
      setName(savedUser);
    }
  }, []);

  // Resume is only offered when the typed username matches the saved session's owner
  const canResume =
    savedSession &&
    name.trim().toLowerCase() === savedSession.user.trim().toLowerCase();

  const handleLogin = async (resume) => {
    const trimmed = name.trim();
    if (!trimmed || !password) {
      setError('Enter your username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      const verifiedUser = data.username;

      if (!resume) {
        localStorage.removeItem('sorter_active_session');
        localStorage.removeItem('sorter_active_session_name');
        localStorage.removeItem('sorter_saved_at');
      }

      localStorage.setItem('sorter_user', verifiedUser);
      onLogin(verifiedUser, resume ? savedSession?.sessionId : null);
    } catch (err) {
      setError('Cannot reach server — check your connection');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#F8FAFB' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: CS_TEAL }}
          >
            <RefreshCw size={26} color="white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: CS_NAVY }}>
            Company Name
          </h1>
          <p className="text-sm text-gray-400 mt-1 tracking-wide">Inbound Hub Scanner</p>
        </div>

        {/* Resume card — only when username matches saved session owner */}
        {canResume && (
          <div
            className="rounded-2xl p-4 mb-4 border-2"
            style={{ background: '#E6FAF7', borderColor: CS_TEAL }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: CS_TEAL }}>
              ⚡ Active session found
            </p>
            <p className="font-semibold text-sm" style={{ color: CS_NAVY }}>
              {savedSession.sessionName}
            </p>
            {savedSession.savedAt && (
              <p className="text-xs text-gray-400 mt-0.5">Last active: {savedSession.savedAt}</p>
            )}
          </div>
        )}

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: CS_NAVY }}>
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="e.g. David"
                autoFocus
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition-colors"
                onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: CS_NAVY }}>
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(!!canResume)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition-colors"
                onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {canResume ? (
            <div className="space-y-2">
              <button
                onClick={() => handleLogin(true)}
                disabled={!name.trim() || !password || loading}
                className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold disabled:opacity-40 transition-opacity"
                style={{ background: CS_TEAL }}
              >
                <LogIn size={18} />
                {loading ? 'Signing in...' : 'Continue Session'}
              </button>
              <button
                onClick={() => handleLogin(false)}
                disabled={!name.trim() || !password || loading}
                className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Start New Session
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleLogin(false)}
              disabled={!name.trim() || !password || loading}
              className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold disabled:opacity-40 transition-opacity"
              style={{ background: CS_TEAL }}
            >
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
