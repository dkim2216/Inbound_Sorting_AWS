import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';

const CS_TEAL = '#00C9A7';
const CS_NAVY = '#0D1B4B';

export default function UploadPage({ onSessionCreated }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !file) {
      setMessage({ type: 'error', text: 'Name and CSV file required' });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('name', name);
      formData.append('file', file);

      const res = await fetch('/api/sessions', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Session created! ${data.rowsInserted} rows imported.`
        });
        setName('');
        setFile(null);
        setTimeout(() => onSessionCreated(data), 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: CS_NAVY }}>
        Upload CSV Manifest
      </h2>
      <p className="text-gray-500 mb-8">
        Create a new sorting session by uploading your warehouse manifest
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm space-y-6"
      >
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: CS_NAVY }}>
            Session Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Warehouse Batch #1"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none transition-all"
            style={{ '--tw-ring-color': CS_TEAL }}
            onFocus={(e) => (e.target.style.borderColor = CS_TEAL)}
            onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: CS_NAVY }}>
            CSV File
          </label>
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
            style={{
              borderColor: file ? CS_TEAL : '#E5E7EB',
              background: file ? '#E6FAF7' : '#FAFAFA'
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0])}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <Upload
                size={32}
                className="mx-auto mb-2"
                style={{ color: file ? CS_TEAL : '#9CA3AF' }}
              />
              {file ? (
                <p className="font-semibold" style={{ color: CS_TEAL }}>
                  ✓ {file.name}
                </p>
              ) : (
                <>
                  <p className="text-gray-700 font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-400 mt-1">CSV files only</p>
                </>
              )}
            </label>
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ background: '#E6FAF7', border: `1px solid ${CS_TEAL}30` }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: CS_NAVY }}>
            CSV Format Required:
          </p>
          <code className="text-xs block font-mono" style={{ color: CS_TEAL }}>
            case_id, sku, item_description, qty, sort_group, dealer
          </code>
          <p className="text-xs text-gray-500 mt-1">
            Example: C001, SKU-A, Blue T-Shirt Large, 20, GRP-1, Dealer Alpha
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Notes: <span className="font-semibold">case_id</span>, <span className="font-semibold">sku</span>, and <span className="font-semibold">qty</span> are required.
            <span className="ml-1">Description can be blank if needed.</span>
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-opacity"
          style={{ background: CS_TEAL }}
        >
          {loading ? 'Uploading...' : 'Create Session'}
        </button>
      </form>
    </div>
  );
}
