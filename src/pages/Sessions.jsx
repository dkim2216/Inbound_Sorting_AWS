import { RefreshCw, Plus, Calendar, FileText, Send, XCircle, Lock } from 'lucide-react';
import { useState } from 'react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Sessions({ sessions, onSessionSelected, onRefresh, loading }) {
  const [sendingId, setSendingId]   = useState(null);
  const [closingId, setClosingId]   = useState(null);
  const [confirmClose, setConfirmClose] = useState(null); // session to confirm close
  const [message, setMessage]       = useState(null);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── Send interim report (session stays open) ──────────────────
  const handleSendReport = async (sessionId, e) => {
    e.stopPropagation();
    try {
      setSendingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      if (res.ok) {
        showMsg('success', 'Report emailed to admin successfully.');
      } else {
        const d = await res.json();
        showMsg('error', d.error || 'Failed to send report.');
      }
    } catch (err) {
      showMsg('error', err.message);
    } finally {
      setSendingId(null);
    }
  };

  // ── Close session (marks done + sends final email) ────────────
  const handleCloseSession = async (sessionId, e) => {
    e.stopPropagation();
    setConfirmClose(sessionId);
  };

  const confirmAndClose = async () => {
    const sessionId = confirmClose;
    setConfirmClose(null);
    try {
      setClosingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/close`, { method: 'POST' });
      if (res.ok) {
        showMsg('success', 'Session closed. Final report emailed to admin.');
        onRefresh();
      } else {
        const d = await res.json();
        showMsg('error', d.error || 'Failed to close session.');
      }
    } catch (err) {
      showMsg('error', err.message);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {/* Confirm close dialog */}
      {confirmClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,27,75,0.55)' }}
          onClick={() => setConfirmClose(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: CS_NAVY }}>
              Close this session?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              This will mark the session as <strong>closed</strong> and send a final report email to admin. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClose(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndClose}
                className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: CS_NAVY }}
              >
                Close Session
              </button>
            </div>
          </div>
        </div>
      )}

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
          <p className="text-sm">{message.text}</p>
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
          {sessions.map(session => {
            const isClosed   = !!session.closed_at;
            const isSending  = sendingId === session.id;
            const isClosing  = closingId === session.id;

            return (
              <button
                key={session.id}
                onClick={() => !isClosed && onSessionSelected(session.id)}
                className={`bg-white rounded-2xl border p-4 md:p-6 transition-all text-left shadow-sm ${
                  isClosed ? 'opacity-70 cursor-default' : 'hover:shadow-md'
                }`}
                style={{ outline: '1px solid #F3F4F6' }}
                onMouseEnter={e => { if (!isClosed) e.currentTarget.style.outline = `2px solid ${CS_TEAL}`; }}
                onMouseLeave={e => e.currentTarget.style.outline = '1px solid #F3F4F6'}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold" style={{ color: CS_NAVY }}>
                      {session.name}
                    </h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(session.created_at).toLocaleDateString()}
                      </span>
                      <span className="font-medium" style={{ color: CS_TEAL }}>ID: {session.id}</span>
                      {isClosed && (
                        <span className="text-xs font-semibold text-gray-400">
                          Closed {new Date(session.closed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {isClosed ? (
                      /* ── Closed badge ── */
                      <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: '#F3F4F6', color: '#6B7280' }}>
                        <Lock size={13} />
                        Closed
                      </div>
                    ) : (
                      <>
                        {/* ── Status pill ── */}
                        <div
                          className="text-xs font-semibold px-3 py-1 rounded-full text-center"
                          style={{ background: '#E6FAF7', color: CS_TEAL }}
                        >
                          Active
                        </div>

                        {/* ── Send Report button ── */}
                        <button
                          onClick={(e) => handleSendReport(session.id, e)}
                          disabled={isSending || isClosing}
                          className="flex items-center justify-center gap-2 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                          style={{ background: CS_TEAL }}
                        >
                          <Send size={13} />
                          {isSending ? 'Sending...' : 'Send Report'}
                        </button>

                        {/* ── Close Session button ── */}
                        <button
                          onClick={(e) => handleCloseSession(session.id, e)}
                          disabled={isSending || isClosing}
                          className="flex items-center justify-center gap-2 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                          style={{ background: CS_NAVY }}
                        >
                          <XCircle size={13} />
                          {isClosing ? 'Closing...' : 'Close Session'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
