const HASH_LABELS = {
  match: { label: 'Hash verified', variant: 'success' },
  mismatch: { label: 'Hash mismatch', variant: 'error' },
  unavailable: { label: 'Hash check unavailable', variant: 'neutral' },
};

const SIG_LABELS = {
  valid: { label: 'Signature valid', variant: 'success' },
  invalid: { label: 'Signature invalid', variant: 'error' },
  unsupported: { label: 'Signature check unsupported', variant: 'neutral' },
  error: { label: 'Signature check errored', variant: 'neutral' },
};

export default function VerificationBadge({ verification }) {
  if (!verification) return null;

  const hashInfo = HASH_LABELS[verification.hash] ?? HASH_LABELS.unavailable;

  return (
    <div className="tx-section">
      <div className="tx-section-title">Verification</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <span className={`badge badge-${hashInfo.variant}`}>{hashInfo.label}</span>
        {verification.signatures.map((sig, i) => {
          const info = SIG_LABELS[sig.valid] ?? SIG_LABELS.unsupported;
          return (
            <span key={i} className={`badge badge-${info.variant}`}>
              {info.label} ({sig.type})
            </span>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
        Proves each signature is genuine for this exact transaction content and that the recorded
        hash matches it — not that the signing key is authorized for the payer account, which
        would require an account lookup this explorer doesn't have.
      </p>
    </div>
  );
}
