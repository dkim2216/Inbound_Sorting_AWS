import { Upload, ScanLine, BarChart3, List, Users, LogOut } from 'lucide-react';

const CS_TEAL  = '#00C9A7';
const CS_NAVY  = '#0D1B4B';
const CS_LIGHT = '#E6FAF7';

const menuItems = [
  { id: 'sessions',  label: 'Sessions',  icon: List },
  { id: 'upload',    label: 'Upload',    icon: Upload },
  { id: 'scan',      label: 'Scan',      icon: ScanLine },
  { id: 'progress',  label: 'Progress',  icon: BarChart3 },
  { id: 'dealers',   label: 'Dealers',   icon: Users },
];

export default function Sidebar({ currentPage, onPageChange, activeSession, user, onLogout }) {
  const items = menuItems.map(item => ({
    ...item,
    disabled: ['scan', 'progress', 'dealers'].includes(item.id) && !activeSession,
  }));

  const handleNavigate = (id) => {
    const item = items.find(m => m.id === id);
    if (!item?.disabled) onPageChange(id);
  };

  return (
    <>
      {/* ── DESKTOP sidebar ── */}
      <div
        className="hidden lg:flex flex-col w-64 h-screen border-r border-gray-100"
        style={{ background: '#FAFCFB' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-lg font-bold leading-tight" style={{ color: CS_NAVY }}>
            Company Name
          </h1>
          <p className="text-xs text-gray-400 font-medium tracking-wide">Inbound Hub Scanner</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {items.map(({ id, label, icon: Icon, disabled }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => handleNavigate(id)}
                disabled={disabled}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium"
                style={
                  isActive
                    ? { background: CS_LIGHT, color: CS_TEAL, fontWeight: 700 }
                    : disabled
                    ? { color: '#CBD5E1', cursor: 'not-allowed' }
                    : { color: '#4B5563' }
                }
                onMouseEnter={e => {
                  if (!isActive && !disabled) e.currentTarget.style.background = '#F3F4F6';
                }}
                onMouseLeave={e => {
                  if (!isActive && !disabled) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  className="w-1 h-5 rounded-full flex-shrink-0 transition-all"
                  style={{ background: isActive ? CS_TEAL : 'transparent' }}
                />
                <Icon size={19} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer: user + logout */}
        <div className="p-5 border-t border-gray-100">
          {user && (
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400">Logged in as</p>
                <p className="text-sm font-bold" style={{ color: CS_NAVY }}>{user}</p>
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                style={{ color: '#9CA3AF' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            © 2026 Made by{' '}
            <span className="font-semibold" style={{ color: CS_TEAL }}>kim.jongwon</span>
            <br />v1.0.0
          </p>
        </div>
      </div>

      {/* ── MOBILE bottom tab bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 flex"
        style={{ background: '#FAFCFB' }}
      >
        {items.map(({ id, label, icon: Icon, disabled }) => {
          const isActive = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => handleNavigate(id)}
              disabled={disabled}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors"
              style={
                isActive
                  ? { color: CS_TEAL }
                  : disabled
                  ? { color: '#CBD5E1' }
                  : { color: '#9CA3AF' }
              }
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: CS_TEAL }}
                />
              )}
              <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} />
              <span
                className="text-[10px] font-medium"
                style={isActive ? { color: CS_TEAL, fontWeight: 700 } : {}}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
