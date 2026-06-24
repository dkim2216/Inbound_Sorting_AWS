import { useState, useEffect } from 'react';
import { UserPlus, Trash2, KeyRound, Shield, ShieldOff, RefreshCw, ClipboardList, Users } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Admin({ user }) {
  const [tab, setTab] = useState('users');

  // ── Users state ───────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [msg, setMsg] = useState(null);

  // ── Audit log state ───────────────────────────────────────────
  const [auditLog, setAuditLog] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'x-username': user };

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', { headers });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else showMsg('error', data.error || 'Failed to load users');
    } catch { showMsg('error', 'Cannot reach server'); }
    finally { setLoadingUsers(false); }
  };

  const fetchAudit = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/audit?limit=100', { headers });
      const data = await res.json();
      if (res.ok) setAuditLog(data);
      else showMsg('error', data.error || 'Failed to load audit log');
    } catch { showMsg('error', 'Cannot reach server'); }
    finally { setLoadingAudit(false); }
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { if (tab === 'audit') fetchAudit(); }, [tab]);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      showMsg('error', 'Username and password are required');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, is_admin: newIsAdmin }),
      });
      const data = await res.json();
      if (res.ok) {
        showMsg('success', `User "${newUsername}" created successfully`);
        setNewUsername(''); setNewPassword(''); setNewIsAdmin(false);
        fetchUsers();
      } else {
        showMsg('error', data.error || 'Failed to create user');
      }
    } catch { showMsg('error', 'Cannot reach server'); }
    finally { setAdding(false); }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (res.ok) { showMsg('success', `User "${username}" deleted`); fetchUsers(); }
      else showMsg('error', data.error || 'Failed to delete user');
    } catch { showMsg('error', 'Cannot reach server'); }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.trim()) { showMsg('error', 'New password is required'); return; }
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(resetTarget)}/password`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) { showMsg('success', `Password reset for "${resetTarget}"`); setResetTarget(null); setResetPassword(''); }
      else showMsg('error', data.error || 'Failed to reset password');
    } catch { showMsg('error', 'Cannot reach server'); }
  };

  const actionColor = (action) => {
    if (action.includes('LOGIN_FAILED') || action.includes('DELETED')) return '#DC2626';
    if (action.includes('LOGIN')) return '#059669';
    if (action.includes('CLOSED')) return '#7C3AED';
    if (action.includes('CREATED')) return CS_TEAL;
    if (action.includes('SENT') || action.includes('SCANNED')) return '#2563EB';
    if (action.includes('RESET') || action.includes('PASSWORD')) return '#D97706';
    return '#6B7280';
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: CS_NAVY }}>Admin Panel</h2>
      <p className="text-gray-500 mb-6">Manage users and view activity logs</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'users', label: 'Users', icon: Users },
          { id: 'audit', label: 'Audit Log', icon: ClipboardList },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === id
              ? { background: CS_TEAL, color: '#fff' }
              : { background: '#F3F4F6', color: '#6B7280' }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Message banner */}
      {msg && (
        <div className={`mb-5 p-3 rounded-xl text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="space-y-6">

          {/* Add user card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold mb-4" style={{ color: CS_NAVY }}>Add New User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: CS_NAVY }}>Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="e.g. john"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = CS_TEAL}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: CS_NAVY }}>Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = CS_TEAL}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
            </div>
            <div className="flex items-center gap-6 mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={e => setNewIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Grant admin access</span>
              </label>
            </div>
            <button
              onClick={handleAddUser}
              disabled={adding}
              className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              style={{ background: CS_TEAL }}
            >
              <UserPlus size={15} />
              {adding ? 'Adding...' : 'Add User'}
            </button>
          </div>

          {/* User list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold" style={{ color: CS_NAVY }}>All Users ({users.length})</h3>
              <button onClick={fetchUsers} disabled={loadingUsers} className="p-2 rounded-xl hover:bg-gray-50">
                <RefreshCw size={15} className={loadingUsers ? 'animate-spin' : ''} style={{ color: CS_TEAL }} />
              </button>
            </div>

            {users.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No users found</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: u.is_admin ? CS_NAVY : CS_TEAL }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm" style={{ color: CS_NAVY }}>{u.username}</span>
                          {u.is_admin && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#E6FAF7', color: CS_TEAL }}>
                              Admin
                            </span>
                          )}
                          {u.username.toLowerCase() === user.toLowerCase() && (
                            <span className="text-xs text-gray-400">(you)</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          Created {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Reset password */}
                      <button
                        onClick={() => { setResetTarget(u.username); setResetPassword(''); }}
                        className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                        title="Reset password"
                      >
                        <KeyRound size={15} style={{ color: '#D97706' }} />
                      </button>
                      {/* Delete — can't delete yourself */}
                      {u.username.toLowerCase() !== user.toLowerCase() && (
                        <button
                          onClick={() => handleDeleteUser(u.username)}
                          className="p-2 rounded-xl hover:bg-red-50 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={15} style={{ color: '#DC2626' }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset password modal */}
          {resetTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,27,75,0.55)' }} onClick={() => setResetTarget(null)}>
              <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-1" style={{ color: CS_NAVY }}>Reset Password</h3>
                <p className="text-sm text-gray-500 mb-4">Set a new password for <strong>{resetTarget}</strong></p>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none mb-4"
                  onFocus={e => e.target.style.borderColor = CS_TEAL}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setResetTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
                  <button onClick={handleResetPassword} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: CS_TEAL }}>Reset</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold" style={{ color: CS_NAVY }}>Recent Activity ({auditLog.length})</h3>
            <button onClick={fetchAudit} disabled={loadingAudit} className="p-2 rounded-xl hover:bg-gray-50">
              <RefreshCw size={15} className={loadingAudit ? 'animate-spin' : ''} style={{ color: CS_TEAL }} />
            </button>
          </div>

          {loadingAudit ? (
            <div className="text-center py-12">
              <RefreshCw size={28} className="animate-spin mx-auto" style={{ color: CS_TEAL }} />
            </div>
          ) : auditLog.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No activity yet</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {auditLog.map(entry => (
                <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: actionColor(entry.action) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: CS_NAVY }}>{entry.username}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: actionColor(entry.action) + '20', color: actionColor(entry.action) }}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {entry.details && <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.details}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
