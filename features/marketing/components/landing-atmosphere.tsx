/**
 * Soft product backdrop — mesh + grid + sparklines only.
 * No floating orbs (those stay on the login page).
 */
export function LandingAtmosphere({ soft = false }: { soft?: boolean }) {
  return (
    <div
      className={
        soft ? "landing-atmosphere-frame landing-atmosphere-frame-soft" : "landing-atmosphere-frame"
      }
      aria-hidden
    >
      <div className="login-atmosphere landing-atmosphere-lite">
        <div className="login-atmosphere-mesh" />
        <div className="login-atmosphere-grid" />
        <div className="login-atmosphere-wave" />
        <svg className="login-sparkline login-sparkline-left" viewBox="0 0 280 120" fill="none">
          <path
            className="login-sparkline-fill"
            d="M4 96 L36 88 L68 90 L100 62 L132 70 L164 38 L196 44 L244 16 L276 22 L276 116 L4 116 Z"
          />
          <path
            className="login-sparkline-line"
            d="M4 96 L36 88 L68 90 L100 62 L132 70 L164 38 L196 44 L244 16 L276 22"
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
      </div>
    </div>
  );
}
