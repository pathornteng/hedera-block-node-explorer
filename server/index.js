import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { BlockNodeClient, decodeFullTransactionsFromBlockItem } from '@ohmpathorn/block-node-client';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const wssMonitor = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/ws/stream') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else if (pathname === '/ws/monitor') {
    wssMonitor.handleUpgrade(req, socket, head, (ws) => wssMonitor.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

const DEFAULT_ENDPOINT = 's01.test.blk.ams.lat.ope.eng.hashgraph.io';

function getEndpoint(query) {
  return (query?.endpoint && String(query.endpoint).trim()) || DEFAULT_ENDPOINT;
}

function makeClient(endpoint) {
  return new BlockNodeClient({ endpoint, tls: 'insecure' });
}

function safeJson(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}

function sendJson(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    ));
  }
}

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get('/api/status', async (req, res) => {
  const client = makeClient(getEndpoint(req.query));
  try {
    const status = await client.serverStatus();
    res.json(safeJson(status));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

app.get('/api/status/detail', async (req, res) => {
  const client = makeClient(getEndpoint(req.query));
  try {
    const detail = await client.serverStatusDetail();
    res.json(safeJson(detail));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

app.get('/api/block/latest', async (req, res) => {
  const client = makeClient(getEndpoint(req.query));
  try {
    const result = await client.getBlock({ retrieveLatest: true });
    res.json(safeJson(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

app.get('/api/block/:number', async (req, res) => {
  const client = makeClient(getEndpoint(req.query));
  try {
    const result = await client.getBlock({ blockNumber: BigInt(req.params.number) });
    res.json(safeJson(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

app.get('/api/block/:number/transactions', async (req, res) => {
  const client = makeClient(getEndpoint(req.query));
  try {
    const txs = await client.getBlockTransactions({ blockNumber: BigInt(req.params.number) });
    res.json(safeJson(txs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

// ── Transaction search helpers ──────────────────────────

function parseTxId(id) {
  const m = String(id).trim().match(/^(?:(\d+)\.(\d+)\.)?(\d+)@(\d+)\.(\d+)$/);
  if (!m) return null;
  return {
    shardNum:   m[1] ? m[1] : '0',
    realmNum:   m[2] ? m[2] : '0',
    accountNum: m[3],
    seconds:    m[4],
    nanos:      m[5],
  };
}

function txMatchesParsed(tx, parsed) {
  const txId = tx.transactionId;
  if (!txId) return false;
  const acc = txId.accountId ?? txId;
  const ts  = txId.transactionValidStart;
  if (!acc || !ts) return false;
  return (
    String(acc.accountNum)  === parsed.accountNum &&
    String(ts.seconds) === parsed.seconds &&
    String(ts.nanos)   === parsed.nanos
  );
}

async function getBlockApproxTimestamp(client, blockNumber) {
  const result = await client.getBlock({ blockNumber: BigInt(blockNumber) });
  const items  = result.block || [];
  for (const item of items) {
    if (item.kind === 'record_file') {
      for (const tx of item.payload?.transactions || []) {
        const ts = tx.transactionId?.transactionValidStart;
        if (ts?.seconds) return Number(ts.seconds);
      }
    } else if (item.kind === 'event_transaction') {
      const ts = item.payload?.transactionId?.transactionValidStart;
      if (ts?.seconds) return Number(ts.seconds);
    }
  }
  return null;
}

app.get('/api/search', async (req, res) => {
  const endpoint = getEndpoint(req.query);
  const txIdStr  = req.query.id?.trim();

  if (!txIdStr) {
    return res.status(400).json({ error: 'Provide id parameter (e.g. 0.0.account@seconds.nanos)' });
  }

  const parsed = parseTxId(txIdStr);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid transaction ID format. Expected: 0.0.account@seconds.nanos' });
  }

  const targetSeconds = parseInt(parsed.seconds);

  const client = makeClient(endpoint);
  try {
    const status = await client.serverStatus();
    let lo = Number(status.firstAvailableBlock);
    let hi = Number(status.lastAvailableBlock);

    // Binary search: find first block with approx timestamp >= targetSeconds
    // transactionValidStart is the proxy; consensusTimestamp is typically a few
    // seconds later, so we search without offset and scan backwards generously.
    for (let i = 0; i < 30 && hi - lo > 5; i++) {
      const mid = Math.floor((lo + hi) / 2);
      const ts  = await getBlockApproxTimestamp(client, mid);
      if (ts === null) {
        hi = mid; // unknown → search earlier half
      } else if (ts < targetSeconds) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Scan window: go back up to 60 blocks (consensus time > validStart by seconds,
    // not minutes) and forward 20 to handle edge cases.
    const first = Number(status.firstAvailableBlock);
    const last  = Number(status.lastAvailableBlock);
    const scanStart = Math.max(lo - 60, first);
    const scanEnd   = Math.min(lo + 20, last);

    for (let blockNum = scanStart; blockNum <= scanEnd; blockNum++) {
      const txs   = await client.getBlockTransactions({ blockNumber: BigInt(blockNum) });
      const found = txs.find(tx => txMatchesParsed(tx, parsed));
      if (found) {
        return res.json(safeJson({ tx: found, blockNumber: blockNum }));
      }
    }

    return res.status(404).json({
      error: 'Transaction not found in scanned range',
      scanned: { from: scanStart, to: scanEnd },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ── Account / token monitor helpers ─────────────────────

function parseEntityId(id) {
  const m = String(id).trim().match(/^(?:(\d+)\.(\d+)\.)?(\d+)$/);
  if (!m) return null;
  return {
    shardNum: m[1] ? m[1] : '0',
    realmNum: m[2] ? m[2] : '0',
    num:      m[3],
  };
}

function accountIdMatches(accountId, parsed) {
  if (!accountId) return false;
  return (
    String(accountId.shardNum ?? '0') === parsed.shardNum &&
    String(accountId.realmNum ?? '0') === parsed.realmNum &&
    String(accountId.accountNum) === parsed.num
  );
}

function tokenIdMatches(tokenId, parsed) {
  if (!tokenId) return false;
  return (
    String(tokenId.shardNum ?? '0') === parsed.shardNum &&
    String(tokenId.realmNum ?? '0') === parsed.realmNum &&
    String(tokenId.tokenNum) === parsed.num
  );
}

// Decodes full transactions directly from the BlockItems the subscription
// already delivered, mirroring client.getBlockTransactions()'s own pairing
// logic. Avoids a second async RPC per block, so matching a block has no
// async gap left after handle.cancel() is called — a client that stops
// watching truly stops immediately, with nothing left in flight.
function decodeTransactionsFromItems(items) {
  const hasRecordFile = items.some(i => i.kind === 'record_file');
  const txs = [];

  if (hasRecordFile) {
    for (const item of items) {
      if (item.kind === 'record_file') {
        txs.push(...decodeFullTransactionsFromBlockItem(item.raw));
      }
    }
    return txs;
  }

  let pending = null;
  for (const item of items) {
    if (item.kind === 'event_transaction') {
      if (item.payload?.kind === 'application' && item.payload.raw?.length > 0) {
        const full = decodeFullTransactionsFromBlockItem(item.raw);
        pending = full.length > 0 ? full[0] : null;
      }
    } else if (item.kind === 'transaction_result' && pending) {
      const res = item.payload;
      pending.receipt = { status: res.status, statusName: res.statusName };
      if (res.consensusTimestamp) pending.consensusTimestamp = res.consensusTimestamp;
      if (res.transactionHash?.length) pending.transactionHash = res.transactionHash;
      if (res.transactionFee) pending.transactionFee = res.transactionFee;
      if (res.transfers?.length) pending.transfers = res.transfers;
      txs.push(pending);
      pending = null;
    }
  }
  return txs;
}

function txMatchesEntity(tx, parsed, entityType) {
  if (entityType === 'token') {
    if (tokenIdMatches(tx.receipt?.tokenId, parsed)) return true;
    return (tx.tokenTransfers || []).some(tt => tokenIdMatches(tt.tokenId, parsed));
  }

  if (accountIdMatches(tx.transactionId?.accountId, parsed)) return true;
  if (accountIdMatches(tx.receipt?.accountId, parsed)) return true;
  if ((tx.transfers || []).some(t => accountIdMatches(t.accountId, parsed))) return true;
  return (tx.tokenTransfers || []).some(tt =>
    (tt.transfers || []).some(t => accountIdMatches(t.accountId, parsed)) ||
    (tt.nftTransfers || []).some(n =>
      accountIdMatches(n.senderAccountId, parsed) || accountIdMatches(n.receiverAccountId, parsed)
    )
  );
}

wssMonitor.on('connection', (ws, req) => {
  const url        = new URL(req.url, 'http://localhost');
  const endpoint   = url.searchParams.get('endpoint') || DEFAULT_ENDPOINT;
  const entityType = url.searchParams.get('type') === 'token' ? 'token' : 'account';
  const parsed     = parseEntityId(url.searchParams.get('id'));

  if (!parsed) {
    sendJson(ws, { type: 'error', message: 'Invalid ID. Expected format: 0.0.1234' });
    ws.close();
    return;
  }

  const client = makeClient(endpoint);
  let handle = null;
  let closed = false;
  let lastBlock = null;

  // The subscribeBlockStream call ends on its own from time to time (the
  // block node — or infra in front of it — appears to cap how long a single
  // stream stays open). That's not something the user asked to stop, so
  // resume from the next block instead of silently going idle.
  function startSubscription(startBlock) {
    if (closed) return;

    handle = client.subscribeBlockStream(
      { startBlockNumber: startBlock, endBlockNumber: 0n },
      {
        onStatus: (code, name) => sendJson(ws, { type: 'status', code, name }),

        onBlock: (blockNumber, items) => {
          if (closed) return;
          lastBlock = blockNumber;
          try {
            const txs = decodeTransactionsFromItems(items);
            const matches = txs.filter(tx => txMatchesEntity(tx, parsed, entityType));
            if (matches.length > 0) {
              sendJson(ws, {
                type: 'match',
                blockNumber,
                transactions: safeJson(matches),
                receivedAt: Date.now(),
              });
            }
            sendJson(ws, { type: 'scanned', blockNumber, receivedAt: Date.now() });
          } catch (err) {
            sendJson(ws, { type: 'blockError', blockNumber, message: err.message });
          }
        },

        onError: (err) => {
          if (closed) return;
          sendJson(ws, { type: 'reconnecting', message: err.message });
          scheduleResume();
        },
        onEnd: () => {
          if (closed) return;
          sendJson(ws, { type: 'reconnecting' });
          scheduleResume();
        },
      }
    );
  }

  function scheduleResume() {
    setTimeout(() => {
      if (closed) return;
      if (lastBlock != null) {
        startSubscription(lastBlock + 1n);
        return;
      }
      client.serverStatus().then(status => {
        if (closed) return;
        const last = BigInt(status.lastAvailableBlock);
        startSubscription(last > 5n ? last - 5n : 0n);
      }).catch(err => {
        sendJson(ws, { type: 'error', message: err.message });
        try { client.close(); } catch {}
      });
    }, 1000);
  }

  client.serverStatus().then(status => {
    // If the client disconnected while this was in flight, don't open a
    // subscription nobody will ever cancel.
    if (closed) { try { client.close(); } catch {} return; }

    const last = BigInt(status.lastAvailableBlock);
    startSubscription(last > 5n ? last - 5n : 0n);
  }).catch(err => {
    sendJson(ws, { type: 'error', message: err.message });
    try { client.close(); } catch {}
  });

  ws.on('close', () => {
    closed = true;
    if (handle) { try { handle.cancel(); } catch {} }
    try { client.close(); } catch {}
  });

  ws.on('error', () => {
    closed = true;
    if (handle) { try { handle.cancel(); } catch {} }
    try { client.close(); } catch {}
  });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const endpoint = url.searchParams.get('endpoint') || DEFAULT_ENDPOINT;
  const client = makeClient(endpoint);
  let handle = null;
  let closed = false;
  let lastBlock = null;

  // See the analogous comment in the /ws/monitor handler: the underlying
  // subscription ends on its own from time to time and that's not a user
  // Stop, so resume from the next block instead of going idle.
  function startSubscription(startBlock) {
    if (closed) return;

    handle = client.subscribeBlockStream(
      { startBlockNumber: startBlock, endBlockNumber: 0n },
      {
        onStatus: (code, name) => sendJson(ws, { type: 'status', code, name }),

        onBlock: (blockNumber, items) => {
          if (closed) return;
          lastBlock = blockNumber;

          const txItems = items.filter(i => i.kind === 'event_transaction');
          const results = items.filter(i => i.kind === 'transaction_result');

          const nativeTxs = txItems.map((item, idx) => ({
            type: item.payload.type,
            transactionId: item.payload.transactionId?.toString() ?? null,
            memo: item.payload.memo || null,
            status: results[idx]?.payload?.statusName ?? null,
            fee: results[idx]?.payload?.transactionFee?.toString() ?? null,
          }));

          const recordTxs = items
            .filter(i => i.kind === 'record_file')
            .flatMap(i => (i.payload.transactions || []).map(tx => ({
              type: tx.type,
              transactionId: tx.transactionId?.toString() ?? null,
              memo: null,
              status: tx.receipt?.statusName ?? null,
              fee: tx.transactionFee?.toString() ?? null,
            })));

          const transactions = nativeTxs.length > 0 ? nativeTxs : recordTxs;

          sendJson(ws, {
            type: 'block',
            blockNumber,
            itemCount: items.length,
            txCount: transactions.length,
            transactions: transactions.slice(0, 20),
            receivedAt: Date.now(),
          });
        },

        onError: (err) => {
          if (closed) return;
          sendJson(ws, { type: 'reconnecting', message: err.message });
          scheduleResume();
        },
        onEnd: () => {
          if (closed) return;
          sendJson(ws, { type: 'reconnecting' });
          scheduleResume();
        },
      }
    );
  }

  function scheduleResume() {
    setTimeout(() => {
      if (closed) return;
      if (lastBlock != null) {
        startSubscription(lastBlock + 1n);
        return;
      }
      client.serverStatus().then(status => {
        if (closed) return;
        const last = BigInt(status.lastAvailableBlock);
        startSubscription(last > 5n ? last - 5n : 0n);
      }).catch(err => {
        sendJson(ws, { type: 'error', message: err.message });
        try { client.close(); } catch {}
      });
    }, 1000);
  }

  client.serverStatus().then(status => {
    if (closed) { try { client.close(); } catch {} return; }

    const last = BigInt(status.lastAvailableBlock);
    startSubscription(last > 5n ? last - 5n : 0n);
  }).catch(err => {
    sendJson(ws, { type: 'error', message: err.message });
    try { client.close(); } catch {}
  });

  ws.on('close', () => {
    closed = true;
    if (handle) { try { handle.cancel(); } catch {} }
    try { client.close(); } catch {}
  });

  ws.on('error', () => {
    closed = true;
    if (handle) { try { handle.cancel(); } catch {} }
    try { client.close(); } catch {}
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Block Node Explorer API → http://localhost:${PORT}`);
});
