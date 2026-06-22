import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Progress({ sessionId, sessions }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);

  const sessionName = sessions.find(s => s.id === sessionId)?.name || '';

  useEffect(() => {
    if (sessionId) {
      fetchProgress();
      const interval = setInterval(fetchProgress, 2000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/progress`);
      setProgress(await res.json());
    } catch (err) {
      console.error('Failed to load progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Please select a session first</p>
      </div>
    );
  }

  const pct = progress?.percentage ?? 0;
  const isComplete = pct === 100;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Progress</h2>
          <p className="text-gray-500 mt-1">Session: <span className="font-semibold">{sessionName}</span></p>
        </div>
        <button
          onClick={fetchProgress}
          disabled={loading}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-xl disabled:opacity-50 font-medium"
          style={{ background: CS_TEAL }}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {progress && (
        <div className="space-y-5">
          {/* Overall Progress Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: CS_NAVY }}>Overall Completion</h3>
              {isComplete && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                  <CheckCircle size={16} /> Complete!
                </span>
              )}
            </div>

            {/* Big percentage */}
            <div className="flex items-end gap-2 mb-4">
              <span className="text-6xl font-black" style={{ color: isComplete ? '#16A34A' : CS_TEAL }}>{pct}</span>
              <span className="text-2xl font-bold text-gray-400 mb-2">%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: isComplete
                    ? '#16A34A'
                    : `linear-gradient(90deg, ${CS_TEAL}, #00A88E)`,
                }}
              />
            </div>

            <p className="text-sm text-gray-500">
              {progress.completed} of {progress.total} items sorted ·{' '}
              <span className="font-medium" style={{ color: CS_NAVY }}>
                {isComplete ? 'All done!' : `${progress.total - progress.completed} remaining`}
              </span>
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Items</p>
              <p className="text-4xl font-black mt-2" style={{ color: CS_NAVY }}>{progress.total}</p>
            </div>
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: '#E6FAF7' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: CS_TEAL }}>Completed</p>
              <p className="text-4xl font-black mt-2" style={{ color: CS_NAVY }}>{progress.completed}</p>
            </div>
          </div>

          {/* Remaining */}
          {!isComplete && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Remaining</p>
              <p className="text-4xl font-black mt-2 text-amber-500">{progress.total - progress.completed}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
