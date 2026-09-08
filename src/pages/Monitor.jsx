import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useEndpoint } from '../App';
import { useEntityMonitor } from '../hooks/useEntityMonitor';
import { formatNumber, formatHbar, formatTxType, formatTransactionId, getStatusVariant, truncate } from '../utils/format';

const ID_PATTERN = /^(?:\d+\.\d+\.)?\d+$/;

function MatchFeed({ matches }) {
  return (
    <div className="stream-list">
      {matches.length === 0 && <div className="empty">No matching transactions yet…</div>}
      {matches.map((tx, i) => {
        const status  = tx.receipt?.statusName ?? tx.status;
        const statusV = getStatusVariant(status);
        const txId    = formatTransactionId(tx.transactionId);
        return (
          <div key={txId + '-' + i} className="stream-item stream-tx-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stream-tx-type">{formatTxType(tx.type)}</span>
              {status && <span className={`badge badge-${statusV}`} style={{ fontSize: 10 }}>{status}</span>}
            </div>
            <span className="stream-tx-id">{truncate(txId, 24, 12)}</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
              <Link
                to={`/explorer?block=${tx.blockNumber}`}
                className="badge badge-neutral"
                style={{ fontSize: 10, textDecoration: 'none' }}
              >
                blk #{formatNumber(tx.blockNumber)}
              </Link>
              {tx.transactionFee && (
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  {formatHbar(tx.transactionFee)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Monitor() {
  const endpoint = useEndpoint();
  const [entityType, setEntityType] = useState('account');
  const [entityId, setEntityId] = useState('');
  const [activeLabel, setActiveLabel] = useState(null);
  const { connStatus, matches, scannedBlock, streamStatus, connect, disconnect } = useEntityMonitor(endpoint);
  const prevEndpoint = useRef(endpoint);

  const isLive = connStatus === 'connected' || connStatus === 'connecting';
  const isValid = ID_PATTERN.test(entityId.trim());

  useEffect(() => {
    if (prevEndpoint.current !== endpoint) {
      prevEndpoint.current = endpoint;
      if (isLive) disconnect();
    }
  }, [endpoint, isLive, disconnect]);

  function handleSubmit(e) {
    e.preventDefault();
    const id = entityId.trim();
    if (!ID_PATTERN.test(id)) return;
    setActiveLabel({ type: entityType, id });
    connect(entityType, id);
  }

  const statusLabels = {
    idle: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Monitoring',
    error: 'Error',
  };

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div className="page-header">
        <h1>Account / Token Monitor</h1>
        <span className="badge badge-neutral" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          {endpoint.split('.')[2] || endpoint}
        </span>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              disabled={isLive}
              style={{ maxWidth: 140 }}
            >
              <option value="account">Account ID</option>
              <option value="token">Token ID</option>
            </select>
            <div className="search-box" style={{ flex: '1 1 220px' }}>
              <input
                type="text"
                placeholder="0.0.1234"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                disabled={isLive}
                autoFocus
              />
            </div>
            {isLive
              ? <button className="btn btn-danger" type="button" onClick={disconnect}>Stop</button>
              : <button className="btn btn-primary" type="submit" disabled={!isValid}>Start Monitoring</button>
            }
          </div>
        </form>

        <div className="conn-indicator">
          <span className={`dot dot-${connStatus}`} />
          <span style={{ color: connStatus === 'error' ? 'var(--red)' : connStatus === 'connected' ? 'var(--green)' : 'var(--text-2)' }}>
            {statusLabels[connStatus]}
          </span>
          {connStatus === 'connected' && scannedBlock != null && (
            <span className="badge badge-neutral">scanning block #{formatNumber(scannedBlock)}</span>
          )}
        </div>

        {streamStatus?.name && connStatus === 'error' && (
          <div className="error-banner" style={{ marginTop: 12 }}>{streamStatus.name}</div>
        )}
      </div>

      {activeLabel && (
        <div className="stream-card" style={{ height: 'auto', maxHeight: '60vh' }}>
          <div className="stream-card-header">
            <h2>
              Matching Transactions — {activeLabel.type === 'token' ? 'Token' : 'Account'}{' '}
              <span className="mono">{activeLabel.id}</span>
            </h2>
            <span className="badge badge-neutral">{matches.length}</span>
          </div>
          <MatchFeed matches={matches} />
        </div>
      )}

      <div className="card" style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 16 }}>
        <div className="card-title">How this works</div>
        <p>
          Monitoring starts from a few blocks back and watches the live block stream, checking
          every transaction as it arrives for the account (payer, transfer participant, or newly
          created account) or token (transfers or token creation) you specify. Very recent blocks
          only expose the payer account reliably — full transfer detail becomes available once a
          block settles into record-file format.
        </p>
      </div>
    </div>
  );
}
