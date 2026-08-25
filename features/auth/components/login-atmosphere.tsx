const FEATURE_ORBS = [
  { className: "login-orb-a", label: "Checkout", hint: "Fast POS" },
  { className: "login-orb-b", label: "Inventory", hint: "Live stock" },
  { className: "login-orb-c", label: "Wholesale", hint: "Warehouse" },
  { className: "login-orb-d", label: "Offline", hint: "Always on" },
  { className: "login-orb-e", label: "Receipts", hint: "Print ready" },
  { className: "login-orb-f", label: "Analytics", hint: "Growth" },
] as const;

/** Layered commerce-style motion behind the sign-in card. CSS-driven, no JS loop. */
export function LoginAtmosphere() {
  return (
    <div className="login-atmosphere" aria-hidden>
      <div className="login-atmosphere-mesh" />
      <div className="login-atmosphere-grid" />
      <div className="login-atmosphere-wave" />

      {FEATURE_ORBS.map((orb) => (
        <span key={orb.label} className={`login-orb ${orb.className}`}>
          <span className="login-orb-glow" />
          <span className="login-orb-copy">
            <span className="login-orb-name">{orb.label}</span>
            <span className="login-orb-hint">{orb.hint}</span>
          </span>
        </span>
      ))}

      <svg className="login-sparkline login-sparkline-left" viewBox="0 0 280 120" fill="none">
        <path
          className="login-sparkline-fill"
          d="M4 96 L36 88 L68 90 L100 62 L132 70 L164 38 L196 44 L244 16 L276 22 L276 116 L4 116 Z"
        />
        <path
          className="login-sparkline-line"
          d="M4 96 L36 88 L68 90 L100 62 L132 70 L164 38 L196 44 L244 16 L276 22"
        />
        <circle className="login-sparkline-node" cx="164" cy="38" r="3.5" />
        <circle
          className="login-sparkline-node login-sparkline-node-delay"
          cx="276"
          cy="22"
          r="4"
        />
      </svg>

      <svg className="login-sparkline login-sparkline-right" viewBox="0 0 240 100" fill="none">
        <path
          className="login-sparkline-fill"
          d="M4 78 L32 70 L60 74 L92 48 L124 54 L156 28 L188 34 L236 12 L236 96 L4 96 Z"
        />
        <path
          className="login-sparkline-line"
          d="M4 78 L32 70 L60 74 L92 48 L124 54 L156 28 L188 34 L236 12"
        />
      </svg>

      <svg className="login-graph" viewBox="0 0 420 280" fill="none">
        <path className="login-graph-edge" d="M40 210 L120 80 L210 150 L310 50 L380 120" />
        <path
          className="login-graph-edge login-graph-edge-delay"
          d="M80 40 L210 150 L160 240 L310 50"
        />
        <circle className="login-graph-node" cx="40" cy="210" r="4" />
        <circle className="login-graph-node" cx="120" cy="80" r="5" />
        <circle className="login-graph-node" cx="210" cy="150" r="4" />
        <circle className="login-graph-node" cx="310" cy="50" r="5" />
        <circle className="login-graph-node" cx="380" cy="120" r="4" />
        <circle className="login-graph-node" cx="80" cy="40" r="3.5" />
        <circle className="login-graph-node" cx="160" cy="240" r="3.5" />
      </svg>
    </div>
  );
}
