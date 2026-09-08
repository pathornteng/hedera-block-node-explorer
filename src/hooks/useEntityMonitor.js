import { useState, useEffect, useRef, useCallback } from 'react';

export function useEntityMonitor(endpoint) {
  const [connStatus, setConnStatus] = useState('idle');
  const [matches, setMatches] = useState([]);
  const [scannedBlock, setScannedBlock] = useState(null);
  const [streamStatus, setStreamStatus] = useState(null);
  const wsRef = useRef(null);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      // Detach handlers first so any messages already in flight over the wire
      // can't sneak in a state update after the user asked to stop.
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState < 2) ws.close();
    }
    wsRef.current = null;
    setConnStatus('idle');
  }, []);

  const connect = useCallback((entityType, entityId) => {
    disconnect();
    setMatches([]);
    setScannedBlock(null);
    setStreamStatus(null);
    setConnStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({ endpoint, type: entityType, id: entityId });
    const url = `${protocol}//${window.location.host}/ws/monitor?${params.toString()}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnStatus('connected');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setStreamStatus(data);
        setConnStatus(data.code === 1 ? 'connected' : 'error');
      } else if (data.type === 'reconnecting') {
        // The underlying block stream dropped on its own (not a user Stop) —
        // resuming from the next block, not a real disconnect.
        setConnStatus('connecting');
      } else if (data.type === 'scanned') {
        setScannedBlock(data.blockNumber);
      } else if (data.type === 'blockError') {
        // Transient per-block decode failure — doesn't affect the connection.
        setScannedBlock(data.blockNumber);
      } else if (data.type === 'match') {
        setScannedBlock(data.blockNumber);
        setMatches(prev =>
          [
            ...data.transactions.map(tx => ({
              ...tx,
              blockNumber: data.blockNumber,
              receivedAt: data.receivedAt,
            })),
            ...prev,
          ].slice(0, 200)
        );
      } else if (data.type === 'error') {
        setConnStatus('error');
        setStreamStatus({ name: data.message });
      } else if (data.type === 'end') {
        setConnStatus('idle');
      }
    };

    ws.onerror = () => setConnStatus('error');
    ws.onclose = () => {
      if (wsRef.current === ws) setConnStatus('idle');
    };
  }, [endpoint, disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connStatus, matches, scannedBlock, streamStatus, connect, disconnect };
}
