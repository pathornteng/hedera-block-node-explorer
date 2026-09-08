import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEndpoint } from '../App';
import VerificationBadge from '../components/VerificationBadge';
import {
  formatNumber, formatHbar, formatTxType, formatTransactionId,
  getStatusVariant, truncate,
} from '../utils/format';

// ── Block data hook ────────────────────────────────────────────────────

function useBlockData(endpoint) {
  const [block, setBlock] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBlock = useCallback(async (blockNumber) => {
    setLoading(true);
    setError(null);
    setBlock(null);
    setTransactions(null);
    const ep = encodeURIComponent(endpoint);
    const url = blockNumber === 'latest'
      ? `/api/block/latest?endpoint=${ep}`
      : `/api/block/${blockNumber}?endpoint=${ep}`;
    try {
      const data = await fetch(url).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setBlock(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const fetchTransactions = useCallback(async (blockNumber) => {
    setTxLoading(true);
    setTransactions(null);
    const ep = encodeURIComponent(endpoint);
    try {
      const data = await fetch(`/api/block/${blockNumber}/transactions?endpoint=${ep}`).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setTransactions(data);
    } catch (err) {
      setTransactions({ error: err.message });
    } finally {
      setTxLoading(false);
    }
  }, [endpoint]);

  return { block, transactions, loading, txLoading, error, fetchBlock, fetchTransactions };
}

// ── Block range hook ───────────────────────────────────────────────────

function useBlockRange(endpoint) {
  const [range, setRange] = useState(null);
  useEffect(() => {
    setRange(null);
    const ep = encodeURIComponent(endpoint);
    fetch(`/api/status?endpoint=${ep}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error && d.firstAvailableBlock != null) {
          setRange({ first: d.firstAvailableBlock, last: d.lastAvailableBlock });
        }
      })
      .catch(() => {});
  }, [endpoint]);
  return range;
}

// ── Range bar ──────────────────────────────────────────────────────────

function RangeBar({ range, onFetch }) {
  if (!range) return null;
  return (
    <div className="range-bar">
      <div className="range-info">
        <span>Available blocks:</span>
        <button className="range-link" onClick={() => onFetch(range.first)} title="Jump to earliest block">
          {formatNumber(range.first)}
        </button>
        <span>—</span>
        <button className="range-link" onClick={() => onFetch(range.last)} title="Jump to latest block">
          {formatNumber(range.last)}
        </button>
        <span className="badge badge-info" style={{ fontSize: 10 }}>latest</span>
      </div>
    </div>
  );
}

// ── Payload cleaning & display ─────────────────────────────────────────

function cleanPayload(val, depth = 0) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return [];
    // byte arrays (all numbers 0-255) → hex summary
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

function PayloadJson({ payload }) {
  const cleaned = useMemo(() => cleanPayload(payload), [payload]);
  return (
    <div className="payload-panel">
      <pre className="payload-json">{JSON.stringify(cleaned, null, 2)}</pre>
    </div>
  );
}

function RecordFileDetail({ payload }) {
  const txs = payload?.transactions || [];
  return (
    <div className="payload-panel">
      {txs.length > 0 ? (
        <>
          <div className="payload-label">{txs.length} embedded transactions</div>
          {txs.map((tx, i) => {
            const txId = formatTransactionId(tx.transactionId);
            return (
              <div key={i} className="rf-tx-row">
                <span className="badge badge-accent" style={{ fontSize: 10, flexShrink: 0 }}>
                  {formatTxType(tx.type)}
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  {truncate(txId, 26, 14)}
                </span>
              </div>
            );
          })}
        </>
      ) : (
        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>No embedded transactions</div>
      )}
    </div>
  );
}

function BlockItemPayload({ kind, payload }) {
  if (!payload) {
    return <div className="payload-panel" style={{ color: 'var(--text-3)', fontSize: 12 }}>No payload data</div>;
  }
  if (kind === 'record_file') return <RecordFileDetail payload={payload} />;
  return <PayloadJson payload={payload} />;
}

// ── Block item row (expandable) ────────────────────────────────────────

function BlockItemRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { kind, payload } = item;

  let detail = '';
  if (kind === 'block_header') {
    detail = `Block #${formatNumber(payload?.number)}`;
  } else if (kind === 'event_transaction') {
    const txId = payload?.transactionId ? formatTransactionId(payload.transactionId) : null;
    detail = [payload?.type, txId ? truncate(txId, 20, 10) : null].filter(Boolean).join(' · ');
  } else if (kind === 'transaction_result') {
    const fee = payload?.transactionFee ? formatHbar(payload.transactionFee) : null;
    detail = [payload?.statusName, fee].filter(Boolean).join(' · ');
  } else if (kind === 'record_file') {
    const count = payload?.transactions?.length ?? 0;
    detail = `${count} transactions`;
  } else if (kind === 'block_proof') {
    detail = 'TSS block signature';
  } else if (kind === 'state_changes') {
    const count = payload?.stateChanges?.length ?? 0;
    detail = `${count} state changes`;
  } else if (kind === 'address_book_proof') {
    detail = 'Network address book hashes';
  }

  const kindVariant = {
    block_header: 'info',
    event_transaction: 'accent',
    transaction_result: 'success',
    block_proof: 'warning',
    address_book_proof: 'info',
    record_file: 'neutral',
    state_changes: 'neutral',
    filtered_item_hash: 'neutral',
  }[kind] || 'neutral';

  return (
    <div className="block-item-wrap">
      <div
        className={`block-item${expanded ? ' item-expanded' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`badge badge-${kindVariant} block-item-kind`}>
          {kind.replace(/_/g, ' ')}
        </span>
        <span className="item-payload">{detail || '—'}</span>
        <span className="expand-chevron">{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && <BlockItemPayload kind={kind} payload={payload} />}
    </div>
  );
}

// ── Inline transaction detail ──────────────────────────────────────────

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
        {/* Left: summary */}
        <div className="tx-detail-section">
          <div className="tx-section-title">Transaction</div>
          <Field label="ID"   value={txId} mono />
          <Field label="Type" value={formatTxType(tx.type)} />
          <Field label="Status" value={status} />
          <Field label="Fee"  value={fee} mono />
          <Field label="Payer" value={payer} mono />
          <Field label="Consensus time" value={consensusTs} mono />
          {tx.memo && <Field label="Memo" value={tx.memo} />}
        </div>

        {/* Right: receipt + HBAR transfers */}
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
              {tx.receipt.topicSequenceNumber && (
                <Field label="Topic sequence" value={String(tx.receipt.topicSequenceNumber)} mono />
              )}
              {tx.receipt.exchangeRate?.currentRate && (
                <Field
                  label="Exchange rate"
                  value={`${tx.receipt.exchangeRate.currentRate.hbarEquivalent} ℏ = ${tx.receipt.exchangeRate.currentRate.centEquivalent} ¢`}
                />
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

      {tx.signatures?.length > 0 && (
        <div className="tx-detail-extra">
          <div className="tx-section-title">Signatures ({tx.signatures.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tx.signatures.slice(0, 8).map((sig, i) => (
              <span key={i} className="badge badge-neutral">{sig.type}</span>
            ))}
            {tx.signatures.length > 8 && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                +{tx.signatures.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transaction row (expandable) ───────────────────────────────────────

function TransactionRow({ tx }) {
  const [expanded, setExpanded] = useState(false);
  const txId    = tx.transactionId
    ? (typeof tx.transactionId === 'string' ? tx.transactionId : formatTransactionId(tx.transactionId))
    : '—';
  const statusV = getStatusVariant(tx.receipt?.statusName || tx.status);

  return (
    <>
      <tr
        className={`clickable-row${expanded ? ' row-expanded' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <td>
          <span className="badge badge-accent" style={{ fontSize: 11 }}>
            {formatTxType(tx.type)}
          </span>
        </td>
        <td className="tx-id">{truncate(txId, 20, 12)}</td>
        <td>
          {(tx.receipt?.statusName || tx.status) && (
            <span className={`badge badge-${statusV}`}>
              {tx.receipt?.statusName || tx.status}
            </span>
          )}
        </td>
        <td className="mono td-muted">
          {tx.transactionFee ? formatHbar(tx.transactionFee) : '—'}
        </td>
        <td className="td-muted mono" style={{ fontSize: 11 }}>
          {tx.transfers?.length
            ? tx.transfers.slice(0, 2).map((t, i) =>
                <div key={i}>{t.accountId?.accountNum}: {t.amount}</div>
              )
            : ''}
        </td>
        <td className="expand-cell">
          <span className={`chevron${expanded ? ' open' : ''}`}>▶</span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="tx-detail-cell">
            <TransactionDetailInline tx={tx} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function BlockExplorer() {
  const endpoint = useEndpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('items');
  const range = useBlockRange(endpoint);
  const { block, transactions, loading, txLoading, error, fetchBlock, fetchTransactions } = useBlockData(endpoint);

  const blockNumber = searchParams.get('block');

  useEffect(() => {
    if (blockNumber) {
      setInput(blockNumber);
      fetchBlock(blockNumber);
    }
  }, [blockNumber, fetchBlock]);

  function handleFetch(target) {
    // target: 'latest', a block number (string or number), or undefined (uses input)
    const num = target !== undefined ? String(target) : input.trim();
    if (!num) return;
    const isLatest = num === 'latest';
    setSearchParams(isLatest ? {} : { block: num });
    if (!isLatest) setInput(num);
    fetchBlock(num);
    setActiveTab('items');
  }

  function handleLoadTransactions() {
    if (!block) return;
    const items = block.block || [];
    const hdr = items.find(i => i.kind === 'block_header');
    const num = hdr?.payload?.number;
    if (num != null) {
      fetchTransactions(String(num));
      setActiveTab('transactions');
    }
  }

  const items    = block?.block || [];
  const hdr      = items.find(i => i.kind === 'block_header');
  const blockNum = hdr?.payload?.number;
  const txCount  = items.filter(i => i.kind === 'event_transaction').length
    + items.filter(i => i.kind === 'record_file')
        .reduce((s, i) => s + (i.payload?.transactions?.length || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Block Explorer</h1>
      </div>

      <div className="card">
        <RangeBar range={range} onFetch={handleFetch} />

        <div className="input-group">
          <input
            type="number"
            placeholder="Block number"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetch()}
            style={{ flex: '1 1 160px', maxWidth: 240 }}
          />
          <button className="btn btn-primary" onClick={() => handleFetch()} disabled={loading || !input.trim()}>
            Fetch Block
          </button>
          <button className="btn btn-secondary" onClick={() => handleFetch('latest')} disabled={loading}>
            Latest
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading && (
          <div className="state-center" style={{ padding: 24 }}>
            <div className="spinner" />
          </div>
        )}

        {block && !loading && (
          <>
            <div className="block-info-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                #{formatNumber(blockNum)}
              </span>
              <span className={`badge badge-${getStatusVariant(block.statusName)}`}>
                {block.statusName}
              </span>
              <span className="badge badge-neutral">{formatNumber(items.length)} items</span>
              {txCount > 0 && <span className="badge badge-accent">{txCount} txs</span>}
            </div>

            <div className="tab-bar">
              <button
                className={'tab-btn' + (activeTab === 'items' ? ' active' : '')}
                onClick={() => setActiveTab('items')}
              >
                Items ({items.length})
              </button>
              <button
                className={'tab-btn' + (activeTab === 'transactions' ? ' active' : '')}
                onClick={() => {
                  setActiveTab('transactions');
                  if (!transactions && !txLoading) handleLoadTransactions();
                }}
                disabled={txCount === 0}
              >
                Transactions ({txCount})
              </button>
            </div>

            {activeTab === 'items' && (
              <div className="items-list">
                {items.map((item, i) => <BlockItemRow key={i} item={item} />)}
              </div>
            )}

            {activeTab === 'transactions' && (
              <>
                {txLoading && (
                  <div className="state-center" style={{ padding: 24 }}>
                    <div className="spinner" />
                    <div>Fetching full transaction details…</div>
                  </div>
                )}
                {transactions?.error && (
                  <div className="error-banner">{transactions.error}</div>
                )}
                {transactions && !txLoading && !transactions.error && (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                      Click a row to expand full transaction details
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Transaction ID</th>
                            <th>Status</th>
                            <th>Fee</th>
                            <th>Transfers</th>
                            <th style={{ width: 32 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.length === 0
                            ? <tr><td colSpan={6} className="empty">No transactions</td></tr>
                            : transactions.map((tx, i) => <TransactionRow key={i} tx={tx} />)
                          }
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {!transactions && !txLoading && (
                  <button
                    className="btn btn-primary"
                    onClick={handleLoadTransactions}
                    style={{ margin: '16px auto', display: 'block' }}
                  >
                    Load Transactions
                  </button>
                )}
              </>
            )}
          </>
        )}

        {!block && !loading && !error && (
          <div className="empty">Enter a block number or click Latest to begin.</div>
        )}
      </div>
    </div>
  );
}
