import { RefreshCw, Plus, Calendar, FileText, Send, XCircle, Lock, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Sessions({ sessions, onSessionSelected, onRefresh, loading, user, isAdmin }) {
  const [sendingId, setSendingId]     = useState(null);
  const [closingId, setClosingId]     = useState(null);
  const [reopeningId, setReopeningId] = useState(null);
  const [deletingId, setDeletingId]   = useState(null);
  const [confirmClose, setConfirmClose]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState(null);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSendReport = async (sessionId, e) => {
    e.stopPropagation();
    try {
      setSendingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent_by: user }),
      });
      if (res.ok) showMsg('success', 'Report emailed to admin successfully.');
      else { const d = await res.json(); showMsg('error', d.error || 'Failed to send report.'); }
    } catch (err) { showMsg('error', err.message); }
    finally { setSendingId(null); }
  };

  const handleCloseSession = (sessionId, e) => { e.stopPropagation(); setConfirmClose(sessionId); };

  const confirmAndClose = async () => {
    const sessionId = confirmClose; setConfirmClose(null);
    try {
      setClosingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_by: user }),
      });
      if (res.ok) { showMsg('success', 'Session completed. Final report emailed.'); onRefresh(); }
      else { const d = await res.json(); showMsg('error', d.error || 'Failed to complete session.'); }
    } catch (err) { showMsg('error', err.message); }
    finally { setClosingId(null); }
  };

  const handleReopen = async (sessionId, e) => {
    e.stopPropagation();
    try {
      setReopeningId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}/reopen`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reopened_by: user }),
      });
      if (res.ok) { showMsg('success', 'Session reopened successfully.'); onRefresh(); }
      else { const d = await res.json(); showMsg('error', d.error || 'Failed to reopen session.'); }
    } catch (err) { showMsg('error', err.message); }
    finally { setReopeningId(null); }
  };

  const handleDelete = (sessionId, e) => { e.stopPropagation(); setConfirmDelete(sessionId); };

  const confirmAndDelete = async () => {
    const sessionId = confirmDelete; setConfirmDelete(null);
    try {
      setDeletingId(sessionId);
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-username': user },
      });
      if (res.ok) { showMsg('success', 'Session deleted permanently.'); onRefresh(); }
      else { const d = await res.json(); showMsg('error', d.error || 'Failed to delete session.'); }
    } catch (err) { showMsg('error', err.message); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">

      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,27,75,0.55)' }} onClick={() => setConfirmClose(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2" style={{ color: CS_NAVY }}>Close this session?</h3>
            <p className="text-sm text-gray-500 mb-6">Marks the session as <strong>complete</strong> and sends a final report. Can be reopened by admin if needed.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClose(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={confirmAndClose} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: CS_NAVY }}>Complete Session</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,27,75,0.55)' }} onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#DC2626' }}>Delete this session?</h3>
            <p className="text-sm text-gray-500 mb-6">This <strong>permanently deletes</strong> the session and all its manifest data. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={confirmAndDelete} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: '#DC2626' }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Sessions</h2>
          <p className="text-gray-500 mt-1">Manage your warehouse sorting sessions</p>
        </div>
        <button onClick={onRefresh} disabled={loading} className="flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl disabled:opacity-50 font-medium" style={{ background: CS_TEAL }}>
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin"><RefreshCw size={32} style={{ color: CS_TEAL }} /></div>
          <p className="text-gray-500 mt-4">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center shadow-sm">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold mb-2" style={{ color: CS_NAVY }}>No sessions yet</h3>
          <p className="text-gray-500 mb-6">Create your first session by uploading a CSV manifest</p>
          <button className="inline-flex items-center gap-2 text-white px-6 py-2.5 rounded-xl font-medium" style={{ background: CS_TEAL }}>
            <Plus size={18} /> Create Session
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map(session => {
            const isClosed    = !!session.closed_at;
            const isSending   = sendingId   === session.id;
            const isClosing   = closingId   === session.id;
            const isReopening = reopeningId === session.id;
            const isDeleting  = deletingId  === session.id;

            return (
              <button
                key={session.id}
                onClick={() => !isClosed && onSessionSelected(session.id)}
                className={`bg-white rounded-2xl border p-4 md:p-6 transition-all text-left shadow-sm ${isClosed ? 'opacity-80 cursor-default' : 'hover:shadow-md'}`}
                style={{ outline: '1px solid #F3F4F6' }}
                onMouseEnter={e => { if (!isClosed) e.currentTarget.style.outline = `2px solid ${CS_TEAL}`; }}
                onMouseLeave={e => e.currentTarget.style.outline = '1px solid #F3F4F6'}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold" style={{ color: CS_NAVY }}>{session.name}</h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={14} />{new Date(session.created_at).toLocaleDateString()}</span>
                      <span className="font-medium" style={{ color: CS_TEAL }}>ID: {session.id}</span>
                      {isClosed && <span className="text-xs font-semibold text-gray-400">Closed {new Date(session.closed_at).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[155px]">
                    {isClosed ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                          <Lock size={13} /> Closed
                        </div>
                        {isAdmin && (
                          <button onClick={(e) => handleReopen(session.id, e)} disabled={isReopening || isDeleting}
                            className="flex items-center justify-center gap-2 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                            style={{ background: CS_TEAL }}>
                            <RotateCcw size={13} />{isReopening ? 'Reopening...' : 'Reopen'}
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={(e) => handleDelete(session.id, e)} disabled={isReopening || isDeleting}
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 border"
                            style={{ borderColor: '#FECACA', color: '#DC2626', background: '#FFF5F5' }}>
                            <Trash2 size={13} />{isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-semibold px-3 py-1 rounded-full text-center" style={{ background: '#E6FAF7', color: CS_TEAL }}>Active</div>
                        <button onClick={(e) => handleSendReport(session.id, e)} disabled={isSending || isClosing}
                          className="flex items-center justify-center gap-2 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                          style={{ background: CS_TEAL }}>
                          <Send size={13} />{isSending ? 'Sending...' : 'Send Report'}
                        </button>
                        <button onClick={(e) => handleCloseSession(session.id, e)} disabled={isSending || isClosing}
                          className="flex items-center justify-center gap-2 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                          style={{ background: CS_NAVY }}>
                          <XCircle size={13} />{isClosing ? 'Completing...' : 'Complete Session'}
                        </button>
                        {isAdmin && (
                          <button onClick={(e) => handleDelete(session.id, e)} disabled={isSending || isClosing || isDeleting}
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 border"
                            style={{ borderColor: '#FECACA', color: '#DC2626', background: '#FFF5F5' }}>
                            <Trash2 size={13} />{isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
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
