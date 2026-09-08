import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useEndpoint } from '../App';
import { useEntityMonitor } from '../hooks/useEntityMonitor';
import VerificationBadge from '../components/VerificationBadge';
import RawJsonView from '../components/RawJsonView';
import { formatNumber, formatHbar, formatTxType, formatTransactionId, getStatusVariant, truncate } from '../utils/format';

const ID_PATTERN = /^(?:\d+\.\d+\.)?\d+$/;

function Field({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="tx-field">
      <span className="tx-field-label">{label}</span>
      <span className={`tx-field-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}

function TransferList({ transfers }) {
  if (!transfers?.length) return null;
  return (
    <>
      {transfers.map((t, i) => {
        const amount = Number(t.amount);
        const isPos  = amount >= 0;
        return (
          <div key={i} className="transfer-row">
            <span className="mono" style={{ color: 'var(--text-2)', fontSize: 11 }}>
              {t.accountId?.accountNum ? `0.0.${t.accountId.accountNum}` : '—'}
            </span>
            <span className={`transfer-amount ${isPos ? 'transfer-positive' : 'transfer-negative'}`}>
              {isPos ? '+' : ''}{(amount / 1e8).toFixed(8)} ℏ
            </span>
          </div>
        );
      })}
    </>
  );
}

function TokenTransfers({ tokenTransfers }) {
  if (!tokenTransfers?.length) return null;
  return (
    <div className="tx-detail-extra">
      <div className="tx-section-title">Token Transfers</div>
      {tokenTransfers.map((ttl, i) => {
        const tid = ttl.tokenId
          ? `${ttl.tokenId.shardNum ?? 0}.${ttl.tokenId.realmNum ?? 0}.${ttl.tokenId.tokenNum ?? ttl.tokenId.accountNum ?? '?'}`
          : '—';
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>
              Token: <span className="mono" style={{ color: 'var(--blue)' }}>{tid}</span>
            </div>
            {ttl.transfers?.map((t, j) => (
              <div key={j} className="transfer-row">
                <span className="mono" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                  0.0.{t.accountId?.accountNum}
                </span>
                <span className={`transfer-amount ${Number(t.amount) >= 0 ? 'transfer-positive' : 'transfer-negative'}`}>
                  {Number(t.amount) >= 0 ? '+' : ''}{t.amount}
                </span>
              </div>
            ))}
            {ttl.nftTransfers?.map((n, j) => (
              <div key={`nft-${j}`} className="transfer-row">
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>NFT #{n.serialNumber}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {n.senderAccountId?.accountNum} → {n.receiverAccountId?.accountNum}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TransactionDetailInline({ tx }) {
  const txId    = formatTransactionId(tx.transactionId);
  const status  = tx.receipt?.statusName ?? tx.status;
  const fee     = tx.transactionFee ? formatHbar(tx.transactionFee) : null;
  const payer   = tx.transactionId?.accountId?.accountNum
    ? `0.0.${tx.transactionId.accountId.accountNum}` : null;

  let consensusTs = null;
  if (tx.consensusTimestamp) {
    const sec  = Number(tx.consensusTimestamp.seconds);
    const nano = String(tx.consensusTimestamp.nanos ?? 0).padStart(9, '0');
    consensusTs = `${new Date(sec * 1000).toUTCString()} (${sec}.${nano})`;
  }

  return (
    <div className="tx-inline-detail">
      <div className="tx-inline-grid">
        <div className="tx-detail-section">
          <div className="tx-section-title">Transaction</div>
          <Field label="ID" value={txId} mono />
          <Field label="Type" value={formatTxType(tx.type)} />
          <Field label="Status" value={status} />
          <Field label="Fee" value={fee} mono />
          <Field label="Payer" value={payer} mono />
          <Field label="Block" value={`#${formatNumber(tx.blockNumber)}`} mono />
          <Field label="Consensus time" value={consensusTs} mono />
          {tx.memo && <Field label="Memo" value={tx.memo} />}
        </div>

        <div className="tx-detail-section">
          {tx.receipt && (
            <>
              <div className="tx-section-title">Receipt</div>
              {tx.receipt.accountId?.accountNum && (
                <Field label="Created account" value={`0.0.${tx.receipt.accountId.accountNum}`} mono />
              )}
              {tx.receipt.tokenId?.tokenNum && (
                <Field label="Token ID" value={`0.0.${tx.receipt.tokenId.tokenNum}`} mono />
              )}
              {tx.receipt.topicId?.topicNum && (
                <Field label="Topic ID" value={`0.0.${tx.receipt.topicId.topicNum}`} mono />
              )}
            </>
          )}

          {tx.transfers?.length > 0 && (
            <>
              <div className="tx-section-title" style={{ marginTop: tx.receipt ? 14 : 0 }}>
                HBAR Transfers
              </div>
              <TransferList transfers={tx.transfers} />
            </>
          )}
        </div>
      </div>

      <TokenTransfers tokenTransfers={tx.tokenTransfers} />

      <VerificationBadge verification={tx.verification} />

      <RawJsonView data={tx} />

      <div style={{ marginTop: 10 }}>
        <Link
          to={`/explorer?block=${tx.blockNumber}`}
          className="badge badge-neutral"
          style={{ textDecoration: 'none' }}
        >
          View block #{formatNumber(tx.blockNumber)} →
        </Link>
      </div>
    </div>
  );
}

function MatchRow({ tx }) {
  const [expanded, setExpanded] = useState(false);
  const status  = tx.receipt?.statusName ?? tx.status;
  const statusV = getStatusVariant(status);
  const txId    = formatTransactionId(tx.transactionId);

  return (
    <div className={`stream-item stream-tx-item clickable-row${expanded ? ' row-expanded' : ''}`}>
      <div onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stream-tx-type">{formatTxType(tx.type)}</span>
          {status && <span className={`badge badge-${statusV}`} style={{ fontSize: 10 }}>{status}</span>}
        </div>
        <span className="stream-tx-id">{truncate(txId, 24, 12)}</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>
            blk #{formatNumber(tx.blockNumber)}
          </span>
          {tx.transactionFee && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
              {formatHbar(tx.transactionFee)}
            </span>
          )}
          <span className={`chevron${expanded ? ' open' : ''}`} style={{ marginLeft: 'auto' }}>▶</span>
        </div>
      </div>
      {expanded && <TransactionDetailInline tx={tx} />}
    </div>
  );
}

function MatchFeed({ matches }) {
  return (
    <div className="stream-list">
      {matches.length === 0 && <div className="empty">No matching transactions yet…</div>}
      {matches.map((tx, i) => (
        <MatchRow key={formatTransactionId(tx.transactionId) + '-' + i} tx={tx} />
      ))}
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
