import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Sessions from './pages/Sessions';
import Upload from './pages/Upload';
import Scan from './pages/Scan';
import Progress from './pages/Progress';
import Dealers from './pages/Dealers';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  // Restore user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('sorter_user');
    if (savedUser) setUser(savedUser);
  }, []);

  // Once user is set, fetch sessions and restore active session
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

  // Persist active session to localStorage whenever it changes
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem('sorter_active_session', activeSession);
      localStorage.setItem('sorter_saved_at', new Date().toISOString());
      const s = sessions.find((s) => s.id === activeSession);
      if (s) localStorage.setItem('sorter_active_session_name', s.name);
    }
  }, [activeSession]);

  // Release all locks when the tab/window closes
  useEffect(() => {
    const handleUnload = () => {
      const currentUser = localStorage.getItem('sorter_user');
      if (currentUser) {
        // sendBeacon can only send POST — must use the POST release route
        navigator.sendBeacon(
          `/api/lock/operator/${encodeURIComponent(currentUser)}/release`
        );
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

  const handleLogin = (name, resumeSessionId) => {
    setUser(name);
    if (resumeSessionId) {
      setActiveSession(Number(resumeSessionId));
      setCurrentPage('scan');
    }
  };

  const handleLogout = async () => {
    // Release all locks held by this operator
    if (user) {
      try {
        await fetch(`/api/lock/operator/${encodeURIComponent(user)}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Could not release locks on logout', e);
      }
    }
    localStorage.setItem('sorter_saved_at', new Date().toISOString());
    setUser(null);
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
          />
        );
      case 'upload':
        return <Upload onSessionCreated={handleSessionCreated} />;
      case 'scan':
        return (
          <Scan
            sessionId={activeSession}
            onSessionChange={setActiveSession}
            sessions={sessions}
            user={user}                  // ← passed for locking
          />
        );
      case 'progress':
        return <Progress sessionId={activeSession} sessions={sessions} />;
      case 'dealers':
        return <Dealers sessionId={activeSession} sessions={sessions} />;
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
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {renderPage()}
      </main>
    </div>
  );
}
