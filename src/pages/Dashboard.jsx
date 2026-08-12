import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEndpoint } from '../App';
import { formatNumber, formatHbar, formatTxType, formatTransactionId, getStatusVariant, truncate } from '../utils/format';

function useDashboardData(endpoint) {
  const [data, setData] = useState({ status: null, detail: null, latestBlock: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const ep = encodeURIComponent(endpoint);

    Promise.all([
      fetch(`/api/status?endpoint=${ep}`).then(r => r.json()),
      fetch(`/api/status/detail?endpoint=${ep}`).then(r => r.json()),
      fetch(`/api/block/latest?endpoint=${ep}`).then(r => r.json()),
    ])
      .then(([status, detail, latestBlock]) => {
        if (status.error) throw new Error(status.error);
        setData({ status, detail, latestBlock });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [endpoint]);

  return { ...data, loading, error };
}

function itemSummary(items) {
  if (!items?.length) return {};
  const counts = {};
  for (const item of items) {
    counts[item.kind] = (counts[item.kind] || 0) + 1;
  }
  return counts;
}

function VersionCard({ detail }) {
  const vi = detail?.versionInformation;
  const bn = vi?.blockNodeVersion;
  const hapi = vi?.hapiVersion;
  const sdk = vi?.sdkVersion;

  return (
    <div className="card">
      <div className="card-title">Software Versions</div>
      <dl className="data-list">
        <dt>Block Node</dt>
        <dd className="mono">
          {bn ? `${bn.major ?? 0}.${bn.minor ?? 0}.${bn.patch ?? 0}` : '—'}
        </dd>
        <dt>HAPI</dt>
        <dd className="mono">
          {hapi ? `${hapi.major ?? 0}.${hapi.minor ?? 0}.${hapi.patch ?? 0}` : '—'}
        </dd>
        {sdk && (
          <>
            <dt>SDK</dt>
            <dd className="mono">{`${sdk.major ?? 0}.${sdk.minor ?? 0}.${sdk.patch ?? 0}`}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function RangesCard({ detail }) {
  const ranges = detail?.availableRanges;
  if (!ranges?.length) return null;

  return (
    <div className="card">
      <div className="card-title">Available Block Ranges</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th style={{ textAlign: 'right' }}>Blocks</th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((r, i) => {
              const count = BigInt(r.rangeEnd) - BigInt(r.rangeStart) + 1n;
              return (
                <tr key={i}>
                  <td className="mono">{formatNumber(r.rangeStart)}</td>
                  <td className="mono">{formatNumber(r.rangeEnd)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{formatNumber(count.toString())}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LatestBlockCard({ latestBlock }) {
  if (!latestBlock) return null;
  if (latestBlock.error) return (
    <div className="card">
      <div className="card-title">Latest Block</div>
      <div className="error-banner">{latestBlock.error}</div>
    </div>
  );

  const items = latestBlock.block || [];
  const counts = itemSummary(items);
  const header = items.find(i => i.kind === 'block_header');
  const blockNum = header?.payload?.number;
  const txCount = (counts.event_transaction || 0) + (
    items.filter(i => i.kind === 'record_file')
      .reduce((s, i) => s + (i.payload?.transactions?.length || 0), 0)
  );

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Latest Block</span>
        {blockNum != null && (
          <Link to={`/explorer?block=${blockNum}`} className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 12 }}>
            View →
          </Link>
        )}
      </div>

      {blockNum != null && (
        <div style={{ marginBottom: 16 }}>
          <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
            #{formatNumber(blockNum)}
          </span>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 0 }}>
        <div className="stat-tile" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <div className="stat-value">{formatNumber(items.length)}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-tile" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <div className="stat-value">{formatNumber(txCount)}</div>
          <div className="stat-label">Transactions</div>
        </div>
        <div className="stat-tile" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
          <div className="stat-value">
            <span className={`badge badge-${getStatusVariant(latestBlock.statusName)}`}>
              {latestBlock.statusName || '—'}
            </span>
          </div>
          <div className="stat-label">Status</div>
        </div>
      </div>

      {Object.keys(counts).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Item breakdown</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(counts).map(([kind, count]) => (
              <span key={kind} className="badge badge-neutral">
                {kind.replace(/_/g, ' ')}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const endpoint = useEndpoint();
  const { status, detail, latestBlock, loading, error } = useDashboardData(endpoint);

  const epLabel = endpoint.split('.')[2] || endpoint;

  if (loading) {
    return (
      <div className="page">
        <div className="state-center">
          <div className="spinner" />
          <div>Connecting to block node…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Dashboard</h1>
          <span className="badge badge-error">Offline</span>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="badge badge-success">Online</span>
        <span className="badge badge-neutral" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{epLabel}</span>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Node Status</div>
          <dl className="data-list">
            <dt>First Available Block</dt>
            <dd className="mono">{formatNumber(status?.firstAvailableBlock)}</dd>
            <dt>Last Available Block</dt>
            <dd className="mono">{formatNumber(status?.lastAvailableBlock)}</dd>
            <dt>Latest State Only</dt>
            <dd>{status?.onlyLatestState ? 'Yes' : 'No'}</dd>
          </dl>
        </div>

        <VersionCard detail={detail} />
      </div>

      <RangesCard detail={detail} />

      <LatestBlockCard latestBlock={latestBlock} />
    </div>
  );
}
