import { useState, useMemo } from 'react';

// Collapses byte-array noise and truncates long strings so the raw JSON
// dump stays readable — mirrors the same cleanup Block Explorer already
// does for raw BlockItem payloads. rawTransaction/rawRecord are pulled out
// before this runs and shown in full below instead, since hiding those is
// exactly the opposite of the point of this view.
function cleanPayload(val, depth = 0) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return [];
    if (val.every(v => typeof v === 'number' && v >= 0 && v <= 255) && val.length > 8) {
      return `<${val.length} bytes>`;
    }
    if (val.length > 30) return `[${val.length} items — first 30 shown]`;
    return val.slice(0, 30).map(v => cleanPayload(v, depth + 1));
  }
  const result = {};
  for (const [k, v] of Object.entries(val)) {
    if (typeof v === 'string' && v.length > 300) {
      result[k] = `${v.slice(0, 60)}… (${v.length} chars)`;
    } else if (depth < 5) {
      result[k] = cleanPayload(v, depth + 1);
    } else {
      result[k] = '…';
    }
  }
  return result;
}

function bufferToHex(buf) {
  if (!buf || !Array.isArray(buf.data)) return null;
  return buf.data.map(b => b.toString(16).padStart(2, '0')).join('');
}

function RawBytesBlock({ label, hex }) {
  if (!hex) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="payload-label">{label} ({hex.length / 2} bytes)</div>
      <pre className="payload-json" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
        {hex}
      </pre>
    </div>
  );
}

export default function RawJsonView({ data, label = 'View Raw JSON' }) {
  const [expanded, setExpanded] = useState(false);

  const view = useMemo(() => {
    if (!expanded) return null;
    const { rawTransaction, rawRecord, ...rest } = data;
    return {
      cleaned: cleanPayload(rest),
      rawTxHex: bufferToHex(rawTransaction),
      rawRecordHex: bufferToHex(rawRecord),
    };
  }, [data, expanded]);

  return (
    <div className="tx-section">
      <button
        type="button"
        className="btn btn-secondary"
        style={{ fontSize: 12, padding: '6px 12px' }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? 'Hide Raw JSON' : label}
      </button>
      {expanded && (
        <div
          className="payload-panel"
          style={{ marginTop: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
        >
          <pre className="payload-json">{JSON.stringify(view.cleaned, null, 2)}</pre>
          <RawBytesBlock label="Raw Transaction Bytes (protobuf)" hex={view.rawTxHex} />
          <RawBytesBlock label="Raw Record Bytes (record_file blocks only)" hex={view.rawRecordHex} />
        </div>
      )}
    </div>
  );
}
