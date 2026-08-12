import { useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BlockExplorer from './pages/BlockExplorer';
import Search from './pages/Search';
import LiveStream from './pages/LiveStream';

const DEFAULT_ENDPOINT = 's01.test.blk.ams.lat.ope.eng.hashgraph.io:40840';

export const EndpointContext = createContext(DEFAULT_ENDPOINT);
export function useEndpoint() { return useContext(EndpointContext); }

export default function App() {
  const [endpoint, setEndpoint] = useState(
    () => localStorage.getItem('bnx:endpoint') || DEFAULT_ENDPOINT
  );

  function handleEndpointChange(ep) {
    setEndpoint(ep);
    localStorage.setItem('bnx:endpoint', ep);
  }

  return (
    <EndpointContext.Provider value={endpoint}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout endpoint={endpoint} setEndpoint={handleEndpointChange} />}>
            <Route index element={<Dashboard />} />
            <Route path="explorer" element={<BlockExplorer />} />
            <Route path="search" element={<Search />} />
            <Route path="stream" element={<LiveStream />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </EndpointContext.Provider>
  );
}
