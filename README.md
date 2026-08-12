# Hedera Block Node Explorer

A web application for exploring and querying Hedera block nodes in real time, built with React and Express using the [`@ohmpathorn/block-node-client`](https://www.npmjs.com/package/@ohmpathorn/block-node-client) gRPC SDK.

## Features

- **Block Explorer** — Fetch any block by number or jump to the latest. Expand individual block items (`block_header`, `block_proof`, `address_book_proof`, `record_file`, etc.) to inspect their full payload. See the available block range at a glance.
- **Transaction Detail** — In the Transactions tab, click any row to expand full inline transaction details: status, fee, receipt fields, HBAR transfers, token transfers, and signatures.
- **Transaction Search** — Search by Hedera transaction ID (`0.0.account@seconds.nanos`). Uses binary search across the block range to locate the transaction in seconds.
- **Live Block Stream** — Subscribe to the block stream in real time and watch new blocks and transactions arrive as they are produced.
- **Multi-endpoint support** — Switch between Previewnet, Testnet, and Mainnet block nodes from the sidebar, or enter a custom `host:port`.

## Architecture

```
browser (React + Vite :5173)
    │
    │  /api/* and /ws/* proxy
    ▼
Express + WebSocket server (:3001)
    │
    │  gRPC (plain, tls: insecure)
    ▼
Hedera Block Node (port 40840)
```

The browser cannot connect to a standard gRPC server directly (no HTTP/2 trailer support). The Express backend acts as the protocol translation layer, exposing REST and WebSocket endpoints that the React frontend consumes.

## Prerequisites

- Node.js 18+
- Access to a Hedera block node endpoint

## Getting Started

```bash
# Install dependencies
npm install

# Start both the Express API server and Vite dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API server + Vite dev server concurrently |
| `npm run dev:server` | Start only the Express/WebSocket backend |
| `npm run dev:frontend` | Start only the Vite dev server |
| `npm run build` | Build the frontend for production |
| `npm start` | Run the Express server (serves built frontend) |

## Endpoints

The backend exposes the following API routes:

| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Node status (first/last available block) |
| GET | `/api/status/detail` | Detailed node version and range info |
| GET | `/api/block/latest` | Latest block with all items |
| GET | `/api/block/:number` | Specific block by number |
| GET | `/api/block/:number/transactions` | Fully decoded transactions in a block |
| GET | `/api/search?id=...` | Search by transaction ID (binary search) |
| WS | `/ws/stream` | Live block stream over WebSocket |

All routes accept an optional `endpoint` query parameter to target a specific block node.

## Supported Block Nodes

All endpoints use port `40840` with plain gRPC (`tls: insecure`).

| Network | Node | Host |
|---|---|---|
| Previewnet | lfh01 | `lfh01.previewnet.blocknode.hashgraph-devops.com:40840` |
| Previewnet | lfh02 | `lfh02.previewnet.blocknode.hashgraph-devops.com:40840` |
| Testnet | Amsterdam | `s01.test.blk.ams.lat.ope.eng.hashgraph.io:40840` |
| Testnet | Singapore | `s01.test.blk.sgp.lat.ope.eng.hashgraph.io:40840` |
| Testnet | Chicago | `s01.test.blk.chi.lat.ope.eng.hashgraph.io:40840` |
| Mainnet | Swirlds (Chicago) | `s03.main.blk.chi.lat.ope.eng.hashgraph.io:40840` |

## Transaction Search

The search accepts the standard Hedera transaction ID format:

```
0.0.<account>@<seconds>.<nanos>

# Example
0.0.9029595@1785945516.120398877
```

The search performs a binary search over the available block range using `transactionValidStart` as a timestamp proxy, then scans a window of blocks with full transaction decoding to find the exact match. A typical search completes in 5–20 seconds depending on block range size.

## Tech Stack

- **Frontend**: React 19, React Router v7, Vite
- **Backend**: Express, `ws` (WebSocket)
- **SDK**: [`@ohmpathorn/block-node-client`](https://www.npmjs.com/package/@ohmpathorn/block-node-client)
- **Transport**: gRPC via `@grpc/grpc-js` (Node.js only)
