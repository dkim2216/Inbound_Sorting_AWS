import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, ChevronRight, ArrowLeft, Users, Layers, Package, CheckCircle, Clock } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';
const CS_LIGHT = '#E6FAF7';

export default function Dealers({ sessionId, sessions }) {
  const [dealers, setDealers] = useState([]);
  const [caseProgress, setCaseProgress] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [selectedDealer, setSelectedDealer] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const sessionName = sessions.find(s => s.id === sessionId)?.name || '';

  useEffect(() => {
    if (sessionId) fetchAll();
    setSelectedDealer(null);
    setSelectedGroup(null);
  }, [sessionId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const [dealerRes, progressRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/dealer-summary`),
        fetch(`/api/sessions/${sessionId}/case-progress`),
      ]);
      if (!dealerRes.ok) throw new Error('Failed to load dealer summary');
      const dealerData  = await dealerRes.json();
      const progressData = progressRes.ok ? await progressRes.json() : [];
      setDealers(dealerData || []);
      const map = {};
      progressData.forEach(item => { map[item.case_id] = item; });
      setCaseProgress(map);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setDealers([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Status helpers ────────────────────────────────────────────
  const getCaseStatus = (caseId) => {
    const p = caseProgress[caseId];
    if (!p) return 'pending';
    if (p.percentage === 100) return 'completed';
    if (p.percentage > 0) return 'in-progress';
    return 'pending';
  };

  const getAggregateStatus = (caseIds) => {
    if (!caseIds.length) return 'pending';
    const s = caseIds.map(getCaseStatus);
    if (s.every(x => x === 'completed')) return 'completed';
    if (s.some(x => x === 'completed' || x === 'in-progress')) return 'in-progress';
    return 'pending';
  };

  const STATUS = {
    completed:    { card: { background: '#F0FDF4', borderColor: '#4ADE80' }, badge: { background: '#DCFCE7', color: '#15803D' }, label: 'Complete',     Icon: CheckCircle },
    'in-progress':{ card: { background: '#FEFCE8', borderColor: '#FACC15' }, badge: { background: '#FEF9C3', color: '#A16207' }, label: 'In Progress',  Icon: Clock },
    pending:      { card: { background: 'white',   borderColor: '#E5E7EB' }, badge: null,                                        label: null,            Icon: null },
  };

  const StatusBadge = ({ status }) => {
    const s = STATUS[status];
    if (!s.badge) return null;
    const Icon = s.Icon;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={s.badge}>
        <Icon size={11} />{s.label}
      </span>
    );
  };

  // ── Data helpers ──────────────────────────────────────────────
  const groupsForDealer  = (d) => d.groups || [];
  const casesForGroup    = (d, g) => (d.cases || []).filter(c => c.sort_group === g);
  const caseIdsForGroup  = (d, g) => [...new Set(casesForGroup(d, g).map(c => c.case_id))];
  const totalQtyForGroup = (d, g) => casesForGroup(d, g).reduce((sum, c) => sum + (c.qty || 0), 0);
  const allCaseIds       = (d) => [...new Set((d.cases || []).map(c => c.case_id))];

  // ── Navigation ────────────────────────────────────────────────
  const goToDealer = (d) => { setSelectedDealer(d); setSelectedGroup(null); };
  const goToGroup  = (g) => setSelectedGroup(g);
  const goBack     = () => {
    if (selectedGroup)  { setSelectedGroup(null); return; }
    if (selectedDealer) { setSelectedDealer(null); }
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Please select a session first</p>
      </div>
    );
  }

  const Breadcrumb = () => (
    <nav className="flex items-center gap-1 text-sm text-gray-400 mb-6 flex-wrap">
      <button onClick={() => { setSelectedDealer(null); setSelectedGroup(null); }}
        className="hover:underline transition-colors"
        style={!selectedDealer ? { color: CS_NAVY, fontWeight: 700 } : {}}>
        All Dealers
      </button>
      {selectedDealer && (<>
        <ChevronRight size={13} />
        <button onClick={() => setSelectedGroup(null)}
          className="hover:underline transition-colors"
          style={!selectedGroup ? { color: CS_NAVY, fontWeight: 700 } : {}}>
          {selectedDealer.name}
        </button>
      </>)}
      {selectedGroup && (<>
        <ChevronRight size={13} />
        <span style={{ color: CS_NAVY, fontWeight: 700 }}>{selectedGroup}</span>
      </>)}
    </nav>
  );

  const StatusMsg = () => (
    <>
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200'
                                     : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <AlertCircle size={18} /><p className="text-sm">{message.text}</p>
        </div>
      )}
      {loading && (
        <div className="text-center py-16">
          <RefreshCw size={30} className="mx-auto animate-spin" style={{ color: CS_TEAL }} />
          <p className="text-gray-400 mt-4 text-sm">Loading...</p>
        </div>
      )}
    </>
  );

  const PageHeader = () => (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Dealer Summary</h2>
        <p className="text-gray-500 mt-1">Session: <span className="font-semibold">{sessionName}</span></p>
      </div>
      <button onClick={fetchAll} disabled={loading}
        className="flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl disabled:opacity-50 font-medium"
        style={{ background: CS_TEAL }}>
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // LEVEL 3 — Cases inside a Sort Group
  // ══════════════════════════════════════════════════════════════
  if (selectedDealer && selectedGroup) {
    const cases    = casesForGroup(selectedDealer, selectedGroup);
    const totalQty = totalQtyForGroup(selectedDealer, selectedGroup);
    const st       = getAggregateStatus(caseIdsForGroup(selectedDealer, selectedGroup));

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader />
        <Breadcrumb />
        <button onClick={goBack} className="flex items-center gap-2 mb-6 font-medium text-sm" style={{ color: CS_TEAL }}>
          <ArrowLeft size={16} /> Back to {selectedDealer.name}
        </button>

        <div className="border-2 rounded-2xl p-6 mb-6" style={STATUS[st].card}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Package size={20} style={{ color: CS_TEAL }} />
              <h3 className="text-xl font-bold" style={{ color: CS_NAVY }}>{selectedGroup}</h3>
            </div>
            <StatusBadge status={st} />
          </div>
          <p className="text-gray-500 text-sm ml-9">
            {cases.length} item{cases.length !== 1 ? 's' : ''} · Total qty: <span className="font-semibold" style={{ color: CS_TEAL }}>{totalQty}</span>
          </p>
        </div>

        <StatusMsg />

        {!loading && (cases.length === 0 ? <EmptyState message="No cases found in this group" /> : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: '#FAFAFA' }}>
                  <th className="text-left px-5 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wide">Case ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wide">SKU</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wide">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cases.map((c, i) => {
                  const cst = getCaseStatus(c.case_id);
                  const p   = caseProgress[c.case_id];
                  return (
                    <tr key={i} className={`transition-colors ${
                      cst === 'completed' ? 'bg-green-50' : cst === 'in-progress' ? 'bg-yellow-50' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-5 py-3.5 font-semibold" style={{ color: CS_TEAL }}>{c.case_id}</td>
                      <td className="px-5 py-3.5 text-gray-600">{c.sku}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={cst} />
                          {p && cst !== 'completed' && <span className="text-xs text-gray-300">{p.completed}/{p.total}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-green-600">{c.qty}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100" style={{ background: '#FAFAFA' }}>
                  <td className="px-5 py-3 font-semibold text-gray-500" colSpan={3}>Total</td>
                  <td className="px-5 py-3 text-right font-bold text-green-600">{totalQty}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LEVEL 2 — Sort Groups inside a Dealer
  // ══════════════════════════════════════════════════════════════
  if (selectedDealer) {
    const groups   = groupsForDealer(selectedDealer);
    const dealerSt = getAggregateStatus(allCaseIds(selectedDealer));

    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader />
        <Breadcrumb />
        <button onClick={goBack} className="flex items-center gap-2 mb-6 font-medium text-sm" style={{ color: CS_TEAL }}>
          <ArrowLeft size={16} /> Back to All Dealers
        </button>

        <div className="border-2 rounded-2xl p-6 mb-6" style={STATUS[dealerSt].card}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Users size={20} style={{ color: CS_TEAL }} />
              <h3 className="text-2xl font-bold" style={{ color: CS_NAVY }}>{selectedDealer.name}</h3>
            </div>
            <StatusBadge status={dealerSt} />
          </div>
          <div className="flex gap-5 mt-3 ml-9 text-sm text-gray-500">
            <span><span className="font-bold" style={{ color: CS_NAVY }}>{groups.length}</span> group{groups.length !== 1 ? 's' : ''}</span>
            <span><span className="font-bold text-green-600">{selectedDealer.totalQty || 0}</span> total qty</span>
          </div>
        </div>

        <StatusMsg />

        {!loading && (groups.length === 0 ? <EmptyState message="No sort groups found for this dealer" /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group, i) => {
              const cases = casesForGroup(selectedDealer, group);
              const qty   = totalQtyForGroup(selectedDealer, group);
              const gst   = getAggregateStatus(caseIdsForGroup(selectedDealer, group));
              return (
                <button key={i} onClick={() => goToGroup(group)}
                  className="text-left border-2 rounded-2xl p-5 hover:shadow-md transition-all group"
                  style={STATUS[gst].card}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-xl" style={{ background: CS_LIGHT }}>
                      <Layers size={17} style={{ color: CS_TEAL }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={gst} />
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </div>
                  <p className="font-bold text-lg" style={{ color: CS_NAVY }}>Group: {group}</p>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400">
                    <span>{cases.length} item{cases.length !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-green-600">Qty: {qty}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LEVEL 1 — All Dealers
  // ══════════════════════════════════════════════════════════════
  const completedCount  = dealers.filter(d => getAggregateStatus(allCaseIds(d)) === 'completed').length;
  const inProgressCount = dealers.filter(d => getAggregateStatus(allCaseIds(d)) === 'in-progress').length;
  const totalSortGroups = new Set(dealers.flatMap(d => d.groups || [])).size;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader />
      <StatusMsg />

      {!loading && dealers.length === 0 && !message && <EmptyState message="This session doesn't have any dealers assigned" />}

      {!loading && dealers.length > 0 && (<>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Dealers',      value: dealers.length,  color: CS_NAVY },
            { label: 'Total Sort Groups',  value: totalSortGroups, color: CS_TEAL },
            { label: 'Complete',           value: completedCount,  color: '#16A34A' },
            { label: 'In Progress',        value: inProgressCount, color: '#D97706' },
            { label: 'Total Qty',          value: dealers.reduce((s, d) => s + (d.totalQty || 0), 0), color: '#6366F1' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-3xl font-black mt-1.5" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Complete</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" /> Pending</span>
        </div>

        {/* Dealer cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dealers.map((dealer, i) => {
            const st = getAggregateStatus(allCaseIds(dealer));
            return (
              <button key={i} onClick={() => goToDealer(dealer)}
                className="text-left border-2 rounded-2xl p-6 hover:shadow-md transition-all group"
                style={STATUS[st].card}>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl" style={{ background: CS_LIGHT }}>
                    <Users size={18} style={{ color: CS_TEAL }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={st} />
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
                <p className="font-bold text-xl mb-3" style={{ color: CS_NAVY }}>{dealer.name}</p>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Sort Groups</span>
                    <span className="font-bold" style={{ color: CS_TEAL }}>{dealer.groups ? dealer.groups.length : 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Qty</span>
                    <span className="font-bold text-green-600">{dealer.totalQty || 0}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
      <AlertCircle size={44} className="mx-auto text-gray-200 mb-4" />
      <p className="text-gray-400">{message}</p>
    </div>
  );
}
