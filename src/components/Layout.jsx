import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const ENDPOINT_GROUPS = [
  {
    label: 'Previewnet',
    options: [
      { label: 'lfh01', value: 'lfh01.previewnet.blocknode.hashgraph-devops.com:40840' },
      { label: 'lfh02', value: 'lfh02.previewnet.blocknode.hashgraph-devops.com:40840' },
    ],
  },
  {
    label: 'Testnet',
    options: [
      { label: 'Amsterdam',    value: 's01.test.blk.ams.lat.ope.eng.hashgraph.io:40840' },
      { label: 'Singapore',    value: 's01.test.blk.sgp.lat.ope.eng.hashgraph.io:40840' },
      { label: 'Chicago',      value: 's01.test.blk.chi.lat.ope.eng.hashgraph.io:40840' },
      { label: 'Tier 2 lfh01', value: 'lfh01.testnet.blocknode.hashgraph-devops.com:40840' },
    ],
  },
  {
    label: 'Mainnet',
    options: [
      { label: 'Swirlds (Chicago)', value: 's03.main.blk.chi.lat.ope.eng.hashgraph.io:40840' },
      { label: 'B4E',               value: '46.21.97.212:40840' },
      { label: 'BitGo',             value: '162.43.189.97:40840' },
      { label: 'EDF',               value: '163.114.159.114:40840' },
      { label: '82.223.201.227',    value: '82.223.201.227:40840' },
    ],
  },
  {
    label: 'Custom',
    options: [{ label: 'Custom URL…', value: '__custom__' }],
  },
];

const ALL_OPTIONS = ENDPOINT_GROUPS.flatMap(g => g.options);

function IconDashboard() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1"/>
      <rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  );
}

function IconBlock() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1 L14 4.5 L14 11.5 L8 15 L2 11.5 L2 4.5 Z"/>
      <path d="M8 1 L8 8M2 4.5 L14 4.5" strokeOpacity="0.4"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6.5" cy="6.5" r="4.5"/>
      <line x1="10" y1="10" x2="14.5" y2="14.5"/>
    </svg>
  );
}

function IconStream() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="1,9 4,5 7,10 10,4 13,8 15,6"/>
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="2" x2="12" y2="12"/>
      <line x1="12" y1="2" x2="2" y2="12"/>
    </svg>
  );
}

function HederaIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="white">
      <path d="M7 8h2.5v7h9V8H21v16h-2.5v-7h-9v7H7V8z"/>
    </svg>
  );
}

function EndpointSelector({ endpoint, setEndpoint }) {
  const [customInput, setCustomInput] = useState('');
  const isKnown = ALL_OPTIONS.some(o => o.value === endpoint && o.value !== '__custom__');
  const selectValue = isKnown ? endpoint : '__custom__';

  function handleSelect(e) {
    const val = e.target.value;
    if (val === '__custom__') {
      setCustomInput(isKnown ? '' : endpoint);
    } else {
      setEndpoint(val);
    }
  }

  function handleCustomApply() {
    const val = customInput.trim();
    if (val) setEndpoint(val);
  }

  return (
    <div className="sidebar-footer">
      <label>Block Node Endpoint</label>
      <select value={selectValue} onChange={handleSelect}>
        {ENDPOINT_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {selectValue === '__custom__' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="host:port"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomApply()}
            style={{ flex: 1, padding: '5px 8px', fontSize: 12, boxShadow: 'none' }}
          />
          <button
            className="btn btn-primary"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={handleCustomApply}
            disabled={!customInput.trim()}
          >
            OK
          </button>
        </div>
      )}

      {!isKnown && selectValue !== '__custom__' && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
          {endpoint}
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
        All endpoints use port 40840
      </div>
    </div>
  );
}

export default function Layout({ endpoint, setEndpoint }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      {/* ── Mobile sticky header ── */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <div className="brand-icon" style={{ width: 28, height: 28, borderRadius: 7 }}>
            <HederaIcon />
          </div>
          <span className="brand-name">Block Node Explorer</span>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
          <span /><span /><span />
        </button>
      </header>

      {/* ── Backdrop (mobile only) ── */}
      {menuOpen && <div className="nav-backdrop" onClick={close} />}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <div className="brand-icon">
              <HederaIcon />
            </div>
            <div>
              <div className="brand-name">Block Node</div>
              <div className="brand-sub">Explorer</div>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={close} aria-label="Close navigation">
            <IconClose />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={close}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <IconDashboard />
            Dashboard
          </NavLink>
          <NavLink to="/explorer" onClick={close}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <IconBlock />
            Block Explorer
          </NavLink>
          <NavLink to="/search" onClick={close}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <IconSearch />
            Transaction Search
          </NavLink>
          <NavLink to="/stream" onClick={close}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <IconStream />
            Live Stream
          </NavLink>
        </nav>

        <EndpointSelector endpoint={endpoint} setEndpoint={setEndpoint} />
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
