export function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

export function formatHbar(tinybars) {
  if (tinybars === null || tinybars === undefined) return '—';
  const hbar = Number(tinybars) / 100_000_000;
  return `${hbar.toFixed(8)} ℏ`;
}

export function formatTxType(type) {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ');
}

export function formatTransactionId(txId) {
  if (!txId) return '—';
  if (typeof txId === 'string') return txId;
  const acc = txId.accountId;
  const ts = txId.transactionValidStart;
  if (!acc || !ts) return JSON.stringify(txId);
  const shard = acc.shardNum ?? '0';
  const realm = acc.realmNum ?? '0';
  const account = acc.accountNum;
  const seconds = ts.seconds;
  const nanos = String(ts.nanos ?? 0).padStart(9, '0');
  return `${shard}.${realm}.${account}@${seconds}.${nanos}`;
}

export function truncate(str, head = 10, tail = 8) {
  if (!str) return '—';
  const s = String(str);
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function getStatusVariant(status) {
  if (!status) return 'neutral';
  if (status === 'SUCCESS') return 'success';
  if (/FAIL|ERROR|INVALID|UNAUTHORIZED|BUSY/.test(status)) return 'error';
  return 'warning';
}

export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - Number(ts);
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function formatItemKind(kind) {
  return (kind || '').replace(/_/g, ' ');
}
