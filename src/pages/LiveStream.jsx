import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useEndpoint } from '../App';
import { useBlockStream } from '../hooks/useBlockStream';
import { formatNumber, formatTxType, getStatusVariant, truncate, timeAgo } from '../utils/format';

function ConnBar({ status, onConnect, onDisconnect, blockCount }) {
  const labels = {
    idle: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Live',
    error: 'Error',
  };
  const dotClass = `dot dot-${status}`;

  return (
    <div className="conn-bar">
      <div className="conn-indicator">
        <span className={dotClass} />
        <span style={{ color: status === 'error' ? 'var(--red)' : status === 'connected' ? 'var(--green)' : 'var(--text-2)' }}>
          {labels[status]}
        </span>
        {status === 'connected' && blockCount > 0 && (
          <span className="badge badge-neutral">{blockCount} blocks received</span>
        )}
      </div>
      <div className="btn-row">
        {status === 'idle' || status === 'error'
          ? <button className="btn btn-success" onClick={onConnect}>Connect</button>
          : <button className="btn btn-danger" onClick={onDisconnect} disabled={status === 'connecting'}>Disconnect</button>
        }
      </div>
    </div>
  );
}

function BlockFeed({ blocks }) {
  return (
    <div className="stream-list">
      {blocks.length === 0 && <div className="empty">Waiting for blocks…</div>}
      {blocks.map((b, i) => (
        <div key={b.blockNumber + '-' + i} className="stream-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link
              to={`/explorer?block=${b.blockNumber}`}
              className="stream-block-number"
              style={{ textDecoration: 'none' }}
            >
              #{formatNumber(b.blockNumber)}
            </Link>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeAgo(b.receivedAt)}</span>
          </div>
          <div className="stream-meta">
            <span>{formatNumber(b.itemCount)} items</span>
            <span>{formatNumber(b.txCount)} txs</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TxFeed({ transactions }) {
  return (
    <div className="stream-list">
      {transactions.length === 0 && <div className="empty">Waiting for transactions…</div>}
      {transactions.map((tx, i) => {
        const statusV = getStatusVariant(tx.status);
        return (
          <div key={(tx.transactionId || '') + '-' + i} className="stream-item stream-tx-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stream-tx-type">{formatTxType(tx.type)}</span>
              {tx.status && (
                <span className={`badge badge-${statusV}`} style={{ fontSize: 10 }}>{tx.status}</span>
              )}
            </div>
            {tx.transactionId && (
              <span className="stream-tx-id">{truncate(tx.transactionId, 24, 12)}</span>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                blk #{formatNumber(tx.blockNumber)}
              </span>
              {tx.fee && (
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  {(Number(tx.fee) / 1e8).toFixed(4)} ℏ
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LiveStream() {
  const endpoint = useEndpoint();
  const { connStatus, blocks, transactions, connect, disconnect } = useBlockStream(endpoint);
  const prevEndpoint = useRef(endpoint);

  useEffect(() => {
    if (prevEndpoint.current !== endpoint) {
      prevEndpoint.current = endpoint;
      if (connStatus === 'connected') {
        disconnect();
      }
    }
  }, [endpoint, connStatus, disconnect]);

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <div className="page-header">
        <h1>Live Stream</h1>
        <span className="badge badge-neutral" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
          {endpoint.split('.')[2] || endpoint}
        </span>
      </div>

      <ConnBar
        status={connStatus}
        onConnect={connect}
        onDisconnect={disconnect}
        blockCount={blocks.length}
      />

      <div className="stream-layout">
        <div className="stream-card">
          <div className="stream-card-header">
            <h2>Recent Blocks</h2>
            <span className="badge badge-neutral">{blocks.length}</span>
          </div>
          <BlockFeed blocks={blocks} />
        </div>

        <div className="stream-card">
          <div className="stream-card-header">
            <h2>Recent Transactions</h2>
            <span className="badge badge-neutral">{transactions.length}</span>
          </div>
          <TxFeed transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
