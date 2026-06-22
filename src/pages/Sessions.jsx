import { RefreshCw, Plus, Calendar, FileText, Send } from 'lucide-react';
import { useState } from 'react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Sessions({ sessions, onSessionSelected, onRefresh, loading }) {
  const [sendingId, setSendingId] = useState(null);
  const [message, setMessage] = useState(null);

  const handleComplete = async (sessionId, e) => {
    e.stopPropagation();
    try {
      setSendingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Email sent successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to send email' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Sessions</h2>
          <p className="text-gray-500 mt-1">Manage your warehouse sorting sessions</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl disabled:opacity-50 font-medium transition-opacity"
          style={{ background: CS_TEAL }}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <p>{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <RefreshCw size={32} style={{ color: CS_TEAL }} />
          </div>
          <p className="text-gray-500 mt-4">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center shadow-sm">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2" style={{ color: CS_NAVY }}>No sessions yet</h3>
          <p className="text-gray-500 mb-6">Create your first session by uploading a CSV manifest</p>
          <button
            className="inline-flex items-center gap-2 text-white px-6 py-2.5 rounded-xl font-medium"
            style={{ background: CS_TEAL }}
          >
            <Plus size={18} /> Create Session
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSessionSelected(session.id)}
              className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 hover:shadow-md transition-all text-left group shadow-sm"
              style={{ borderColor: 'transparent', outline: '1px solid #F3F4F6' }}
              onMouseEnter={e => e.currentTarget.style.outline = `2px solid ${CS_TEAL}`}
              onMouseLeave={e => e.currentTarget.style.outline = '1px solid #F3F4F6'}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold" style={{ color: CS_NAVY }}>{session.name}</h3>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-medium" style={{ color: CS_TEAL }}>ID: {session.id}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div
                    className="text-xs font-semibold px-3 py-1 rounded-full text-center"
                    style={{ background: '#E6FAF7', color: CS_TEAL }}
                  >
                    Ready
                  </div>
                  <button
                    onClick={(e) => handleComplete(session.id, e)}
                    disabled={sendingId === session.id}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap transition-colors"
                  >
                    <Send size={14} />
                    {sendingId === session.id ? 'Sending...' : 'Complete'}
                  </button>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
