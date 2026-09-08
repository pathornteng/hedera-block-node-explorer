import { useState, useEffect, useRef, useCallback } from 'react';

export function useBlockStream(endpoint) {
  const [connStatus, setConnStatus] = useState('idle');
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [streamStatus, setStreamStatus] = useState(null);
  const wsRef = useRef(null);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState < 2) ws.close();
    }
    wsRef.current = null;
    setConnStatus('idle');
  }, []);

  const connect = useCallback(() => {
    disconnect();
    setBlocks([]);
    setTransactions([]);
    setStreamStatus(null);
    setConnStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/stream?endpoint=${encodeURIComponent(endpoint)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnStatus('connected');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setStreamStatus(data);
        if (data.code !== 1) setConnStatus('error');
      } else if (data.type === 'block') {
        setBlocks(prev => [data, ...prev].slice(0, 50));
        if (data.transactions?.length > 0) {
          setTransactions(prev =>
            [
              ...data.transactions.map(tx => ({
                ...tx,
                blockNumber: data.blockNumber,
                receivedAt: data.receivedAt,
              })),
              ...prev,
            ].slice(0, 200)
          );
        }
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

  return { connStatus, blocks, transactions, streamStatus, connect, disconnect };
}
