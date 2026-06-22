import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle, CheckCircle, ChevronRight, ChevronLeft,
  RefreshCw, PackageCheck, ScanLine, XCircle, Lock, Unlock,
} from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function Scan({ sessionId, sessions, user }) {
  const [step, setStep] = useState(1);
  const [cases, setCases] = useState([]);
  const [caseProgress, setCaseProgress] = useState({});
  const [skus, setSkus] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState(null);

  // Scan confirmation (now lives on Step 2)
  const [scanInput, setScanInput] = useState('');
  const [scanConfirmed, setScanConfirmed] = useState(false);
  const [scanError, setScanError] = useState('');
  const [showDestinations, setShowDestinations] = useState(false);
  const scanRef = useRef(null);

  // Case ID scan (Step 1)
  const [caseScanInput, setCaseScanInput] = useState('');
  const [caseScanError, setCaseScanError] = useState('');
  const caseScanRef = useRef(null);

  // Lock tracking
  const activeLockRef = useRef(null);

  const sessionName = sessions.find((s) => s.id === sessionId)?.name || '';

  // ── Lock helpers ───────────────────────────────────────────────
  const acquireLock = async (caseId, sku) => {
    const res = await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, case_id: caseId, sku, operator: user }),
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    activeLockRef.current = { session_id: sessionId, case_id: caseId, sku };
    return data;
  };

  const releaseLock = useCallback(async () => {
    const lock = activeLockRef.current;
    if (!lock) return;
    activeLockRef.current = null;
    try {
      await fetch('/api/lock', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lock, operator: user }),
      });
    } catch (e) {
      console.warn('Could not release lock', e);
    }
  }, [user]);

  useEffect(() => { return () => { releaseLock(); }; }, [releaseLock]);

  useEffect(() => {
    if (sessionId) {
      releaseLock();
      fetchCases();
      fetchCaseProgress();
      setStep(1);
      resetStep2();
    }
  }, [sessionId]);

  // Auto-focus case scan input when step 1 is active
  useEffect(() => {
    if (step === 1 && !loading) {
      setTimeout(() => caseScanRef.current?.focus(), 150);
    }
    if (step !== 1) {
      setCaseScanInput('');
      setCaseScanError('');
    }
  }, [step, loading]);

  // Auto-focus scan input when step 2 opens
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => scanRef.current?.focus(), 150);
    }
  }, [step, selectedCase]);

  // Poll SKU lock/progress info every 5s while on step 2 scan view,
  // so other operators' locks show up without a manual refresh
  useEffect(() => {
    if (step !== 2 || showDestinations || !selectedCase) return;
    const interval = setInterval(() => {
      fetchSkusByCase(selectedCase).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [step, showDestinations, selectedCase]);

  const resetStep2 = () => {
    setSelectedCase('');
    setSelectedSku('');
    setSkus([]);
    setDestinations([]);
    setScanInput('');
    setScanConfirmed(false);
    setScanError('');
    setShowDestinations(false);
    setMessage(null);
  };

  const resetScan = () => {
    setScanInput('');
    setScanConfirmed(false);
    setScanError('');
    setShowDestinations(false);
    setSelectedSku('');
    setDestinations([]);
    setMessage(null);
    releaseLock();
    setTimeout(() => scanRef.current?.focus(), 100);
  };

  // ── Data fetching ──────────────────────────────────────────────
  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/cases`);
      setCases(await res.json());
    } catch {
      setMessage({ type: 'error', text: 'Failed to load cases' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseProgress = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/case-progress`);
      const data = await res.json();
      const map = {};
      data.forEach((item) => { map[item.case_id] = item; });
      setCaseProgress(map);
    } catch (err) {
      console.error('Failed to load case progress:', err);
    }
  };

  const fetchSkusByCase = async (caseId) => {
    const res = await fetch(`/api/sessions/${sessionId}/case/${caseId}/skus`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Case not found');
    setSkus(data);
    return data;
  };

  const fetchDestinations = async (caseId, sku) => {
    const res = await fetch(`/api/sessions/${sessionId}/case/${caseId}/sku/${sku}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'SKU not found');
    return data.map((dest) => ({
      ...dest,
      actual_qty: dest.actual_qty ?? dest.qty,
      remark: dest.remark ?? '',
    }));
  };

  // ── Step 1: Case selection ─────────────────────────────────────
  const getProgressStatus = (percentage) => {
    if (percentage === 100) return 'completed';
    if (percentage > 0) return 'in-progress';
    return 'pending';
  };

  const getCaseStatus = (caseId) => {
    const p = caseProgress[caseId];
    if (!p) return 'pending';
    return getProgressStatus(p.percentage);
  };

  const handleCaseSelect = async (caseId) => {
    try {
      setLoading(true);
      setSelectedCase(caseId);
      await fetchSkusByCase(caseId);
      setStep(2);
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Case not found' });
    } finally {
      setLoading(false);
    }
  };

  const handleCaseScan = (e) => {
    if (e.key !== 'Enter') return;
    const scanned = caseScanInput.trim().toUpperCase();
    if (!scanned) return;

    const matched = cases.find((c) => c.toUpperCase() === scanned);
    if (!matched) {
      setCaseScanError(`Case "${scanned}" not found in this manifest`);
      setCaseScanInput('');
      return;
    }

    setCaseScanError('');
    setCaseScanInput('');
    handleCaseSelect(matched);
  };

  // ── Step 2: Item scan ──────────────────────────────────────────
  const handleItemScan = async (e) => {
    if (e.key !== 'Enter') return;
    const scanned = scanInput.trim().toUpperCase();
    if (!scanned) return;

    // Match scanned value to a SKU in this case
    const matchedSku = skus.find((s) => s.sku.toUpperCase() === scanned);
    if (!matchedSku) {
      setScanError(`"${scanned}" not found in Case ${selectedCase}`);
      setScanInput('');
      return;
    }

    // Check if locked by someone else
    if (matchedSku.locked_by && matchedSku.locked_by !== user) {
      setScanError(`🔒 Locked by ${matchedSku.locked_by} — wait for them to finish`);
      setScanInput('');
      return;
    }

    try {
      setLoading(true);
      setScanError('');

      // Acquire lock
      await acquireLock(selectedCase, matchedSku.sku);

      // Fetch destinations
      const dests = await fetchDestinations(selectedCase, matchedSku.sku);
      setSelectedSku(matchedSku.sku);
      setDestinations(dests);
      setScanConfirmed(true);
      setShowDestinations(true);
      setMessage(null);
    } catch (err) {
      if (err.status === 409) {
        setScanError(`🔒 Locked by ${err.locked_by} — wait for them to finish`);
      } else {
        setScanError(err.message || 'Error loading destinations');
      }
      setScanInput('');
      activeLockRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  // ── Destination handlers ───────────────────────────────────────
  const handleQuantityChange = (id, value) => {
    setDestinations((prev) =>
      prev.map((dest) =>
        dest.id === id
          ? { ...dest, actual_qty: value === '' ? '' : Math.max(0, parseInt(value, 10) || 0) }
          : dest
      )
    );
  };

  const handleRemarkChange = (id, value) => {
    setDestinations((prev) =>
      prev.map((dest) => (dest.id === id ? { ...dest, remark: value } : dest))
    );
  };

  const getDiscrepancy = (dest) => {
    const actual = dest.actual_qty === '' ? 0 : Number(dest.actual_qty ?? dest.qty);
    return actual - Number(dest.qty || 0);
  };

  const handleMarkDone = async (id) => {
    const dest = destinations.find((row) => row.id === id);
    if (!dest) return;

    const actualQty = dest.actual_qty === '' ? NaN : parseInt(dest.actual_qty, 10);
    if (isNaN(actualQty) || actualQty < 0) {
      setMessage({ type: 'error', text: 'Actual qty must be a valid non-negative number' });
      return;
    }

    const discrepancy = actualQty - Number(dest.qty || 0);
    if (discrepancy !== 0 && !String(dest.remark || '').trim()) {
      setMessage({ type: 'error', text: 'Please add a remark when there is a discrepancy' });
      return;
    }

    try {
      setSavingId(id);
      const res = await fetch(`/api/manifest/${id}/done`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_qty: actualQty, remark: dest.remark || '', done: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update item');

      const updatedDests = destinations.map((row) =>
        row.id === id ? { ...row, ...data } : row
      );
      setDestinations(updatedDests);

      await Promise.all([fetchCaseProgress(), fetchSkusByCase(selectedCase)]);

      setMessage({
        type: 'success',
        text: discrepancy === 0 ? 'Sorted ✓' : 'Saved with discrepancy ✓',
      });

      // If all destinations done, release lock and return to SKU list
      if (updatedDests.every((d) => d.done)) {
        await releaseLock();
        setTimeout(() => {
          resetScan();
          setMessage({ type: 'success', text: `${selectedSku} complete — scan next item` });
        }, 800);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update' });
    } finally {
      setSavingId(null);
    }
  };

  const handleBackToCase = async () => {
    await releaseLock();
    setStep(1);
    resetStep2();
    fetchCases();
    fetchCaseProgress();
  };

  if (!sessionId) {
    return (
      <div className="p-8 text-center">
        <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Please select a session first</p>
      </div>
    );
  }

  // ── Nav bar (2 steps now) ──────────────────────────────────────
  const NavBar = () => (
    <div className="flex items-center gap-2 md:gap-4 mb-6">
      {[1, 2].map((n, i) => (
        <Fragment key={n}>
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm flex-shrink-0 transition-all"
            style={
              step >= n
                ? { background: CS_TEAL, color: 'white' }
                : { background: '#F3F4F6', color: '#9CA3AF' }
            }
          >
            {step > n ? <CheckCircle size={18} /> : n}
          </div>
          {i < 1 && (
            <div
              className="flex-1 h-1 rounded-full transition-all"
              style={{ background: step > n ? CS_TEAL : '#E5E7EB' }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold" style={{ color: CS_NAVY }}>Scan Workflow</h2>
        <p className="text-gray-500 mt-1">
          Session: <span className="font-semibold">{sessionName}</span>
          {user && <span className="ml-3 text-xs text-gray-400">· Operator: <span className="font-semibold">{user}</span></span>}
        </p>
      </div>

      <NavBar />

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* ── STEP 1: Select Case ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-8 shadow-sm">
          <h3 className="text-lg font-semibold mb-5" style={{ color: CS_NAVY }}>Step 1: Select Case ID</h3>

          {/* Scan case ID directly */}
          <div
            className="rounded-xl p-4 mb-6 border-2"
            style={{ borderColor: caseScanError ? '#F87171' : '#E5E7EB', background: '#FAFAFA' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <ScanLine size={18} style={{ color: CS_TEAL }} />
              <p className="text-sm font-semibold" style={{ color: CS_NAVY }}>
                Scan Case ID barcode
              </p>
            </div>
            <input
              ref={caseScanRef}
              type="text"
              value={caseScanInput}
              onChange={(e) => { setCaseScanInput(e.target.value.toUpperCase()); setCaseScanError(''); }}
              onKeyDown={handleCaseScan}
              placeholder="Scan barcode or type Case ID + Enter"
              disabled={loading}
              className="w-full px-4 py-3 border rounded-xl text-sm font-mono tracking-widest focus:outline-none disabled:opacity-50"
              style={{ borderColor: caseScanError ? '#F87171' : '#E5E7EB', color: CS_NAVY }}
              onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
              onBlur={(e) => (e.target.style.borderColor = caseScanError ? '#F87171' : '#E5E7EB')}
            />
            {caseScanError && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                <XCircle size={13} />{caseScanError}
              </div>
            )}
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Or select manually
          </p>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw size={28} className="mx-auto animate-spin" style={{ color: CS_TEAL }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cases.map((caseId) => {
                const status = getCaseStatus(caseId);
                const progress = caseProgress[caseId];
                return (
                  <button
                    key={caseId}
                    onClick={() => handleCaseSelect(caseId)}
                    disabled={loading}
                    className={`p-4 border-2 rounded-xl transition-all font-medium disabled:opacity-50 ${
                      status === 'completed' ? 'bg-green-50 border-green-400'
                      : status === 'in-progress' ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-white border-gray-200'
                    }`}
                    onMouseEnter={(e) => { if (status === 'pending') e.currentTarget.style.borderColor = CS_TEAL; }}
                    onMouseLeave={(e) => { if (status === 'pending') e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    <div className="text-base font-bold" style={{ color: CS_NAVY }}>{caseId}</div>
                    {progress && (
                      <div className="text-xs text-gray-400 mt-1">{progress.completed}/{progress.total}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Scan item + SKU reference + destinations ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg md:text-xl font-semibold" style={{ color: CS_NAVY }}>
                Step 2: Scan Item
              </h3>
              <p className="text-gray-500 text-sm mt-0.5">
                Case: <span className="font-semibold">{selectedCase}</span>
              </p>
            </div>
            <button
              onClick={handleBackToCase}
              className="text-sm font-medium flex items-center gap-1"
              style={{ color: CS_TEAL }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          </div>

          {/* Scan input */}
          {!showDestinations && (
            <div
              className="rounded-xl p-4 mb-6 border-2"
              style={{ borderColor: scanError ? '#F87171' : '#E5E7EB', background: '#FAFAFA' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ScanLine size={18} style={{ color: CS_TEAL }} />
                <p className="text-sm font-semibold" style={{ color: CS_NAVY }}>
                  Scan physical item barcode
                </p>
                <span
                  className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full font-mono"
                  style={{ background: '#E6FAF7', color: CS_TEAL }}
                >
                  Case: {selectedCase}
                </span>
              </div>
              <input
                ref={scanRef}
                type="text"
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value.toUpperCase()); setScanError(''); }}
                onKeyDown={handleItemScan}
                placeholder="Scan barcode or type SKU + Enter"
                className="w-full px-4 py-3 border rounded-xl text-sm font-mono tracking-widest focus:outline-none"
                style={{ borderColor: scanError ? '#F87171' : '#E5E7EB', color: CS_NAVY }}
                onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
                onBlur={(e) => (e.target.style.borderColor = scanError ? '#F87171' : '#E5E7EB')}
              />
              {scanError && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                  <XCircle size={13} />{scanError}
                </div>
              )}
            </div>
          )}

          {/* SKU reference grid */}
          {!showDestinations && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                SKUs in this case
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {skus.map((item) => {
                  const status = getProgressStatus(item.percentage);
                  const isLockedByOther = item.locked_by && item.locked_by !== user;
                  const isLockedByMe = item.locked_by === user;
                  return (
                    <div
                      key={item.sku}
                      className={`p-4 border-2 rounded-xl text-left ${
                        isLockedByOther ? 'bg-gray-50 border-gray-200 opacity-60'
                        : status === 'completed' ? 'bg-green-50 border-green-400'
                        : status === 'in-progress' ? 'bg-yellow-50 border-yellow-400'
                        : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-bold text-sm" style={{ color: CS_NAVY }}>{item.sku}</div>
                        {isLockedByOther && <Lock size={12} className="text-gray-400" />}
                        {isLockedByMe && <Unlock size={12} style={{ color: CS_TEAL }} />}
                      </div>
                      <div className="text-xs text-gray-400">{item.completed}/{item.total} destinations</div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="font-semibold" style={{ color: CS_TEAL }}>
                          Qty: {item.total_qty}
                        </span>
                        <span className="font-semibold text-gray-500">
                          Groups: {item.sort_group_count}
                        </span>
                      </div>
                      {isLockedByOther && (
                        <div className="mt-1 text-xs text-gray-400 truncate">🔒 {item.locked_by}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destinations (shown after scan confirmed) */}
          {showDestinations && (
            <div>
              {/* Confirmed scan banner */}
              <div
                className="rounded-xl p-3 mb-5 border-2 flex items-center justify-between"
                style={{ borderColor: '#4ADE80', background: '#F0FDF4' }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-800">
                    ✓ Item confirmed — <span className="font-mono">{selectedSku}</span>
                  </span>
                </div>
                <button
                  onClick={resetScan}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Scan different item
                </button>
              </div>

              {/* Destination rows */}
              <div className="space-y-4">
                {destinations.map((dest) => {
                  const discrepancy = getDiscrepancy(dest);
                  const hasDiscrepancy = discrepancy !== 0;
                  const isSaving = savingId === dest.id;

                  return (
                    <div
                      key={dest.id}
                      className={`p-4 md:p-6 rounded-xl border-2 transition-all ${
                        dest.done
                          ? hasDiscrepancy ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-200'
                          : hasDiscrepancy ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#E6FAF7' }}>
                              <PackageCheck size={18} style={{ color: CS_TEAL }} />
                            </div>
                            <div>
                              <p className="font-bold text-lg md:text-xl" style={{ color: CS_NAVY }}>{dest.dealer}</p>
                              {dest.item_description && (
                                <p className="text-sm text-gray-500 mt-1">{dest.item_description}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                            <div>
                              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Sort Group</p>
                              <p className="font-bold text-lg mt-0.5" style={{ color: CS_TEAL }}>{dest.sort_group}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Original Qty</p>
                              <p className="font-bold text-lg text-gray-700 mt-0.5">{dest.qty}</p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1">Actual Qty</label>
                              <input
                                type="number" min="0"
                                value={dest.actual_qty}
                                onChange={(e) => handleQuantityChange(dest.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Discrepancy</p>
                              <p className={`font-bold text-lg mt-0.5 ${
                                discrepancy === 0 ? 'text-gray-700'
                                : discrepancy > 0 ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1">Remark</label>
                            <textarea
                              rows={2}
                              value={dest.remark}
                              onChange={(e) => handleRemarkChange(dest.id, e.target.value)}
                              placeholder={hasDiscrepancy ? 'Explain shortage / overage...' : 'Optional remark'}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none resize-none"
                            />
                            {hasDiscrepancy && !String(dest.remark || '').trim() && (
                              <p className="text-xs text-amber-600 mt-2">Remark required when discrepancy exists.</p>
                            )}
                          </div>
                        </div>

                        <div className="lg:w-48 flex flex-col gap-3">
                          {dest.done && (
                            <div className={`flex items-center justify-center gap-2 font-semibold rounded-xl px-4 py-2.5 ${
                              hasDiscrepancy ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'
                            }`}>
                              <CheckCircle size={18} />
                              <span>{hasDiscrepancy ? 'Done w/ Discrepancy' : 'Done'}</span>
                            </div>
                          )}
                          <button
                            onClick={() => handleMarkDone(dest.id)}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold transition-opacity disabled:opacity-30"
                            style={{ background: CS_TEAL }}
                          >
                            {isSaving ? 'Saving...' : dest.done ? 'Update' : 'Mark Done ✓'}
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
