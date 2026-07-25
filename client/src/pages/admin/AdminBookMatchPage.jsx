import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UploadCloud, CheckCircle2, XCircle, Sparkles, Download, ArrowLeft } from 'lucide-react';
import { usersApi, bookMatchApi } from '../../api/endpoints';

const HIGH_CONFIDENCE = 85;

export default function AdminBookMatchPage() {
  const [step, setStep] = useState(1); // 1 = upload, 2 = review, 3 = report
  const [selectedUserId, setSelectedUserId] = useState('');
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [colMap, setColMap] = useState({ party: '', credit: '', debit: '' });
  const [matching, setMatching] = useState(false);
  const [targetUserName, setTargetUserName] = useState('');
  const [reviewRows, setReviewRows] = useState([]); // [{ partyName, credit, debit, suggestions, selectedIndex, decision }]
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list().then((r) => r.data.users),
  });

  // ---------- Step 1: upload + parse ----------
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const okExt = /\.(xlsx|csv)$/i.test(f.name);
    if (!okExt) {
      toast.error('Only .xlsx and .csv files are supported');
      return;
    }
    setFile(f);
  };

  const handleParse = async () => {
    if (!selectedUserId) return toast.error('Select which user this book belongs to first');
    if (!file) return toast.error('Choose a file first');
    setParsing(true);
    try {
      const { data } = await bookMatchApi.parseSheet(file);
      setParsed(data);
      const lower = data.headers.map((h) => String(h || '').toLowerCase());
      const guess = (keywords) => {
        const idx = lower.findIndex((h) => keywords.some((k) => h.includes(k)));
        return idx === -1 ? '' : String(idx);
      };
      setColMap({
        party: guess(['party', 'name', 'customer']),
        credit: guess(['credit']),
        debit: guess(['debit']),
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const handleRunMatch = async () => {
    if (colMap.party === '') return toast.error('Select which column is the Party Name');
    const partyIdx = Number(colMap.party);
    const creditIdx = colMap.credit === '' ? null : Number(colMap.credit);
    const debitIdx = colMap.debit === '' ? null : Number(colMap.debit);

    const entries = parsed.rows
      .map((row) => ({
        partyName: row[partyIdx] || '',
        credit: creditIdx != null ? row[creditIdx] || '' : '',
        debit: debitIdx != null ? row[debitIdx] || '' : '',
      }))
      .filter((e) => e.partyName.trim() !== '');

    if (entries.length === 0) return toast.error('No party names found in the selected column');

    setMatching(true);
    try {
      const { data } = await bookMatchApi.matchParties(selectedUserId, entries);
      setTargetUserName(data.targetUserName);
      setReviewRows(
        data.results.map((r) => ({
          ...r,
          selectedIndex: r.suggestions.length > 0 && r.suggestions[0].confidence >= HIGH_CONFIDENCE ? 0 : null,
          decision: r.suggestions.length > 0 && r.suggestions[0].confidence >= HIGH_CONFIDENCE ? 'matched' : 'pending',
        }))
      );
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Matching failed');
    } finally {
      setMatching(false);
    }
  };

  // ---------- Step 2: review ----------
  const confirmAllHighConfidence = () => {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.decision !== 'pending') return r;
        if (r.suggestions.length > 0 && r.suggestions[0].confidence >= HIGH_CONFIDENCE) {
          return { ...r, selectedIndex: 0, decision: 'matched' };
        }
        return r;
      })
    );
    toast.success('High-confidence matches confirmed');
  };

  const setRowDecision = (idx, decision, selectedIndex = null) => {
    setReviewRows((prev) => prev.map((r, i) => (i === idx ? { ...r, decision, selectedIndex } : r)));
  };

  const pendingCount = reviewRows.filter((r) => r.decision === 'pending').length;

  const handleFinalize = () => {
    if (pendingCount > 0) {
      toast.error(`${pendingCount} rows still need a decision`);
      return;
    }
    setStep(3);
  };

  // ---------- Step 3: report ----------
  const finalRows = useMemo(() => {
    return reviewRows.map((r) => {
      const chosen = r.selectedIndex != null ? r.suggestions[r.selectedIndex] : null;
      let status;
      if (r.decision === 'no_match') status = 'possible_new_lead';
      else if (chosen && chosen.leadCountForUser > 0) status = 'matched_this_user';
      else if (chosen && chosen.totalLeadCount > 0) status = 'matched_other_user';
      else if (chosen) status = 'matched_no_lead';
      else status = 'possible_new_lead';

      return {
        partyName: r.partyName,
        credit: r.credit,
        debit: r.debit,
        matchedCustomer: chosen ? chosen.customerName : '',
        leadCountForUser: chosen ? chosen.leadCountForUser : '',
        otherOwners: chosen ? chosen.otherOwners.map((o) => `${o.name} (${o.count})`) : [],
        status,
      };
    });
  }, [reviewRows]);

  const summary = useMemo(() => {
    const total = finalRows.length;
    const matchedInCrm = finalRows.filter((r) => r.status !== 'possible_new_lead').length;
    const thisUser = finalRows.filter((r) => r.status === 'matched_this_user').length;
    const otherUser = finalRows.filter((r) => r.status === 'matched_other_user').length;
    const possibleNew = finalRows.filter((r) => r.status === 'possible_new_lead').length;
    return { total, matchedInCrm, thisUser, otherUser, possibleNew };
  }, [finalRows]);

  const statusLabel = {
    matched_this_user: `${targetUserName}'s Lead`,
    matched_other_user: 'Owned by Someone Else',
    matched_no_lead: 'In CRM, No Lead Yet',
    possible_new_lead: 'Possible New Lead',
  };
  const statusColor = {
    matched_this_user: 'bg-green-100 text-green-700',
    matched_other_user: 'bg-amber-100 text-amber-700',
    matched_no_lead: 'bg-gray-100 text-gray-600',
    possible_new_lead: 'bg-blue-100 text-blue-700',
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await bookMatchApi.exportReport(
        finalRows.map((r) => ({ ...r, status: statusLabel[r.status] })),
        targetUserName
      );
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'book-match-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setSelectedUserId('');
    setFile(null);
    setParsed(null);
    setColMap({ party: '', credit: '', debit: '' });
    setReviewRows([]);
    setTargetUserName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">Book Match</h2>
      <p className="text-sm text-gray-500 mb-6">
        Upload a party ledger sheet and see which parties already have leads in the CRM — and who owns them.
        Nothing from the sheet is ever saved to the database.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs font-medium text-gray-500">
        <span className={step === 1 ? 'text-brand-600' : ''}>1. Upload</span>
        <span>→</span>
        <span className={step === 2 ? 'text-brand-600' : ''}>2. Review Matches</span>
        <span>→</span>
        <span className={step === 3 ? 'text-brand-600' : ''}>3. Report</span>
      </div>

      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Whose book is this?</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a user...</option>
              {users?.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload sheet (.xlsx or .csv)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-md px-4 py-3 text-sm text-gray-600 cursor-pointer hover:border-brand-400">
                <UploadCloud size={18} />
                {file ? file.name : 'Choose file'}
                <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          <button
            onClick={handleParse}
            disabled={parsing || !file || !selectedUserId}
            className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-700 disabled:opacity-50"
          >
            {parsing ? 'Reading file...' : 'Continue'}
          </button>

          {parsed && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Map your columns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {['party', 'credit', 'debit'].map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                      {field === 'party' ? 'Party Name (required)' : `${field} (optional)`}
                    </label>
                    <select
                      value={colMap[field]}
                      onChange={(e) => setColMap((c) => ({ ...c, [field]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    >
                      <option value="">— none —</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">{parsed.rows.length} rows found in the file.</p>
              <button
                onClick={handleRunMatch}
                disabled={matching}
                className="mt-4 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-700 disabled:opacity-50"
              >
                {matching ? 'Matching against CRM...' : 'Run Match'}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {reviewRows.length} parties · {pendingCount} still need a decision
            </p>
            <button
              onClick={confirmAllHighConfidence}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 border border-brand-300 rounded-md px-3 py-1.5 hover:bg-brand-50"
            >
              <Sparkles size={14} /> Confirm All High-Confidence
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Party Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Suggested Match</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Confidence</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Decision</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.partyName}</td>
                    <td className="px-4 py-2.5">
                      {r.suggestions.length > 0 ? (
                        <select
                          value={r.selectedIndex ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRowDecision(idx, v === '' ? 'no_match' : 'matched', v === '' ? null : Number(v));
                          }}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm max-w-[220px]"
                        >
                          <option value="">— No Match —</option>
                          {r.suggestions.map((s, si) => (
                            <option key={si} value={si}>{s.customerName} ({s.confidence}%)</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-xs">No candidates found</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.selectedIndex != null && r.suggestions[r.selectedIndex] ? (
                        <span className={r.suggestions[r.selectedIndex].confidence >= HIGH_CONFIDENCE ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                          {r.suggestions[r.selectedIndex].confidence}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.decision === 'matched' && (
                        <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium"><CheckCircle2 size={14} /> Confirmed</span>
                      )}
                      {r.decision === 'no_match' && (
                        <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-medium"><XCircle size={14} /> No Match</span>
                      )}
                      {r.decision === 'pending' && (
                        <span className="text-xs text-gray-400">Pending review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={handleFinalize}
              className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-700"
            >
              Generate Report
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Parties', value: summary.total },
              { label: 'Matched in CRM', value: summary.matchedInCrm },
              { label: `${targetUserName}'s Leads`, value: summary.thisUser },
              { label: 'Owned by Others', value: summary.otherUser },
              { label: 'Possible New Leads', value: summary.possibleNew },
            ].map((c) => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className="text-xl font-semibold text-gray-800">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Detailed Report</h3>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-brand-700 disabled:opacity-50"
            >
              <Download size={14} /> {exporting ? 'Exporting...' : 'Download Excel'}
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Party Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Matched Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Also Owned By</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Credit</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Debit</th>
                </tr>
              </thead>
              <tbody>
                {finalRows.map((r, idx) => (
                  <tr key={idx} className={`border-b border-gray-100 ${r.status === 'possible_new_lead' ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.partyName}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.matchedCustomer || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[r.status]}`}>
                        {statusLabel[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{r.otherOwners.join(', ') || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.credit}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.debit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
              <ArrowLeft size={14} /> Back to Review
            </button>
            <button onClick={resetAll} className="text-sm font-medium text-gray-600 hover:text-gray-800">
              Start New Book Match
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
