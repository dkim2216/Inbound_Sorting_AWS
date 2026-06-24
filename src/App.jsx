import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Sessions from './pages/Sessions';
import Upload from './pages/Upload';
import Scan from './pages/Scan';
import Progress from './pages/Progress';
import Dealers from './pages/Dealers';
import Admin from './pages/Admin';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('sorter_user');
    const savedAdmin = localStorage.getItem('sorter_is_admin') === 'true';
    if (savedUser) { setUser(savedUser); setIsAdmin(savedAdmin); }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSessions().then(() => {
        const savedSessionId = localStorage.getItem('sorter_active_session');
        if (savedSessionId) {
          setActiveSession(Number(savedSessionId));
          setCurrentPage('scan');
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem('sorter_active_session', activeSession);
      localStorage.setItem('sorter_saved_at', new Date().toISOString());
      const s = sessions.find((s) => s.id === activeSession);
      if (s) localStorage.setItem('sorter_active_session_name', s.name);
    }
  }, [activeSession]);

  useEffect(() => {
    const handleUnload = () => {
      const currentUser = localStorage.getItem('sorter_user');
      if (currentUser) {
        navigator.sendBeacon(`/api/lock/operator/${encodeURIComponent(currentUser)}/release`);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
      return data;
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (name, resumeSessionId, adminFlag) => {
    setUser(name);
    setIsAdmin(adminFlag === true);
    localStorage.setItem('sorter_is_admin', adminFlag === true ? 'true' : 'false');
    if (resumeSessionId) {
      setActiveSession(Number(resumeSessionId));
      setCurrentPage('scan');
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await fetch(`/api/lock/operator/${encodeURIComponent(user)}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Could not release locks on logout', e);
      }
    }
    localStorage.setItem('sorter_saved_at', new Date().toISOString());
    localStorage.removeItem('sorter_is_admin');
    setUser(null);
    setIsAdmin(false);
    setCurrentPage('sessions');
  };

  const handleSessionCreated = (newSession) => {
    setSessions([newSession, ...sessions]);
    setActiveSession(newSession.id);
    setCurrentPage('scan');
  };

  const handleSessionSelected = (sessionId) => {
    setActiveSession(sessionId);
    setCurrentPage('scan');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'sessions':
        return (
          <Sessions
            sessions={sessions}
            onSessionSelected={handleSessionSelected}
            onRefresh={fetchSessions}
            loading={loading}
            user={user}
          />
        );
      case 'upload':
        return isAdmin
          ? <Upload onSessionCreated={handleSessionCreated} user={user} />
          : <div className="p-8 text-center text-gray-400">Access restricted to admins.</div>;
      case 'scan':
        return (
          <Scan
            sessionId={activeSession}
            onSessionChange={setActiveSession}
            sessions={sessions}
            user={user}
          />
        );
      case 'progress':
        return <Progress sessionId={activeSession} sessions={sessions} />;
      case 'dealers':
        return <Dealers sessionId={activeSession} sessions={sessions} />;
      case 'admin':
        return isAdmin
          ? <Admin user={user} />
          : <div className="p-8 text-center text-gray-400">Access restricted to admins.</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        activeSession={activeSession}
        user={user}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {renderPage()}
      </main>
    </div>
  );
}
