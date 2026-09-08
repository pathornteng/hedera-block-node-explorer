import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEndpoint } from '../App';
import VerificationBadge from '../components/VerificationBadge';
import RawJsonView from '../components/RawJsonView';
import { formatNumber, formatHbar, formatTxType, formatTransactionId, getStatusVariant } from '../utils/format';

function Field({ label, value, mono = false, className = '' }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="tx-field">
      <span className="tx-field-label">{label}</span>
      <span className={`tx-field-value ${mono ? 'mono' : ''} ${className}`}>{value}</span>
    </div>
  );
}

function TransferList({ transfers }) {
  if (!transfers?.length) return null;
  return (
    <div>
      {transfers.map((t, i) => {
        const amount = Number(t.amount);
        const isPos  = amount >= 0;
        return (
          <div key={i} className="transfer-row">
            <span className="mono" style={{ color: 'var(--text-2)' }}>
              {t.accountId?.accountNum ? `0.0.${t.accountId.accountNum}` : '—'}
            </span>
            <span className={`transfer-amount ${isPos ? 'transfer-positive' : 'transfer-negative'}`}>
              {isPos ? '+' : ''}{(amount / 1e8).toFixed(8)} ℏ
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TokenTransferSection({ tokenTransfers }) {
  if (!tokenTransfers?.length) return null;
  return (
    <div className="tx-section">
      <div className="tx-section-title">Token Transfers</div>
      {tokenTransfers.map((ttl, i) => {
        const tokenId = ttl.tokenId
          ? `${ttl.tokenId.shardNum ?? 0}.${ttl.tokenId.realmNum ?? 0}.${ttl.tokenId.tokenNum ?? ttl.tokenId.accountNum ?? '?'}`
          : '—';
        return (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
              Token: <span className="mono" style={{ color: 'var(--blue)' }}>{tokenId}</span>
            </div>
            {ttl.transfers?.map((t, j) => (
              <div key={j} className="transfer-row">
                <span className="mono" style={{ color: 'var(--text-2)' }}>
                  {t.accountId?.accountNum ? `0.0.${t.accountId.accountNum}` : '—'}
                </span>
                <span className={`transfer-amount ${Number(t.amount) >= 0 ? 'transfer-positive' : 'transfer-negative'}`}>
                  {Number(t.amount) >= 0 ? '+' : ''}{t.amount}
                </span>
              </div>
            ))}
            {ttl.nftTransfers?.map((n, j) => (
              <div key={`nft-${j}`} className="transfer-row">
                <span className="mono" style={{ color: 'var(--text-2)' }}>
                  NFT #{n.serialNumber} · {n.senderAccountId?.accountNum} → {n.receiverAccountId?.accountNum}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return null;
  const sec  = Number(ts.seconds);
  const nanos = String(ts.nanos ?? 0).padStart(9, '0');
  const date  = new Date(sec * 1000);
  return `${date.toUTCString()}  (${sec}.${nanos})`;
}

function TxResult({ result }) {
  const { tx, blockNumber } = result;

  const txId     = formatTransactionId(tx.transactionId);
  const status   = tx.receipt?.statusName ?? tx.status;
  const statusV  = getStatusVariant(status);
  const type     = formatTxType(tx.type);
  const fee      = tx.transactionFee ? formatHbar(tx.transactionFee) : null;
  const ts       = formatTimestamp(tx.consensusTimestamp);
  const payer    = tx.transactionId?.accountId?.accountNum
    ? `0.0.${tx.transactionId.accountId.accountNum}` : null;

  return (
    <div className="tx-result-card">
      <div className="tx-result-header">
        <div className="tx-result-header-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div className="tx-result-type">{type}</div>
          {status && <span className={`badge badge-${statusV}`}>{status}</span>}
          <Link
            to={`/explorer?block=${blockNumber}`}
            className="badge badge-neutral block-link"
            style={{ textDecoration: 'none', marginLeft: 'auto' }}
          >
            Block #{formatNumber(blockNumber)} →
          </Link>
        </div>
        <div className="tx-result-id">{txId}</div>
      </div>

      <div className="tx-result-body">
        <div className="tx-section">
          <div className="tx-section-title">Summary</div>
          <Field label="Transaction ID" value={txId} mono />
          <Field label="Payer"          value={payer} mono />
          <Field label="Fee"            value={fee} mono />
          <Field label="Consensus Time" value={ts} mono />
          <Field label="Block"          value={`#${formatNumber(blockNumber)}`} mono />
          {tx.memo && <Field label="Memo" value={tx.memo} />}
        </div>

        {tx.receipt && (
          <div className="tx-section">
            <div className="tx-section-title">Receipt</div>
            <Field label="Status" value={status} />
            {tx.receipt.accountId?.accountNum && (
              <Field label="Created Account" value={`0.0.${tx.receipt.accountId.accountNum}`} mono />
            )}
            {tx.receipt.tokenId?.tokenNum && (
              <Field label="Token ID" value={`0.0.${tx.receipt.tokenId.tokenNum}`} mono />
            )}
            {tx.receipt.topicId?.topicNum && (
              <Field label="Topic ID" value={`0.0.${tx.receipt.topicId.topicNum}`} mono />
            )}
            {tx.receipt.topicSequenceNumber && (
              <Field label="Topic Sequence" value={String(tx.receipt.topicSequenceNumber)} mono />
            )}
            {tx.receipt.exchangeRate?.currentRate && (
              <Field
                label="Exchange Rate"
                value={`${tx.receipt.exchangeRate.currentRate.hbarEquivalent} ℏ = ${tx.receipt.exchangeRate.currentRate.centEquivalent} ¢`}
              />
            )}
          </div>
        )}

        {tx.transfers?.length > 0 && (
          <div className="tx-section">
            <div className="tx-section-title">HBAR Transfers</div>
            <TransferList transfers={tx.transfers} />
          </div>
        )}

        <TokenTransferSection tokenTransfers={tx.tokenTransfers} />

        <VerificationBadge verification={tx.verification} />

        {tx.signatures?.length > 0 && (
          <div className="tx-section">
            <div className="tx-section-title">Signatures ({tx.signatures.length})</div>
            {tx.signatures.slice(0, 5).map((sig, i) => (
              <div key={i} className="transfer-row">
                <span className="badge badge-neutral">{sig.type}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {sig.pubKeyPrefix ? sig.pubKeyPrefix.slice(0, 24) + '…' : ''}
                </span>
              </div>
            ))}
            {tx.signatures.length > 5 && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                +{tx.signatures.length - 5} more
              </div>
            )}
          </div>
        )}

        <RawJsonView data={tx} />
      </div>
    </div>
  );
}

function SearchHelp() {
  return (
    <div className="card" style={{ color: 'var(--text-2)', fontSize: 13 }}>
      <div className="card-title">How to search</div>
      <p style={{ marginBottom: 12 }}>
        Enter a Hedera transaction ID to find the full transaction details.
        The explorer performs a binary search across blocks to locate your transaction.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <span className="badge badge-neutral" style={{ marginRight: 8 }}>Format</span>
          <code className="mono" style={{ fontSize: 12 }}>0.0.account@seconds.nanos</code>
        </div>
        <div>
          <span className="badge badge-neutral" style={{ marginRight: 8 }}>Example</span>
          <code className="mono" style={{ fontSize: 12 }}>0.0.9029595@1785945516.120398877</code>
        </div>
      </div>
      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
        <strong>Note:</strong> Search only covers the block range available on the connected node
        (currently blocks 38,000,000 – present).
      </div>
    </div>
  );
}

export default function Search() {
  const endpoint = useEndpoint();
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [progress, setProgress] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setProgress('Binary searching blocks…');

    try {
      const ep   = encodeURIComponent(endpoint);
      const resp = await fetch(`/api/search?id=${encodeURIComponent(q)}&endpoint=${ep}`);
      const data = await resp.json();

      if (!resp.ok || data.error) {
        setError(data.error || 'Search failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Transaction Search</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="input-group">
            <div className="search-box" style={{ flex: '1 1 260px' }}>
              <input
                type="text"
                placeholder="0.0.account@seconds.nanos"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading || !query.trim()}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>

        {loading && (
          <div className="state-center" style={{ padding: 32 }}>
            <div className="spinner" />
            <div>{progress}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Binary searching ~886K blocks. This may take 5–15 seconds.
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="error-banner">{error}</div>
        )}
      </div>

      {result && !loading && <TxResult result={result} />}
      {!result && !loading && !error && <SearchHelp />}
    </div>
  );
}
