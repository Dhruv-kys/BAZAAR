import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import { type MerchantMetrics, rupees, rupeesShort } from "../governance/metrics";
import { GitHubIcon, MoonIcon, SunIcon } from "../icons";
import { navigate } from "../router";
import { useTheme } from "../useTheme";
import "./Dashboard.css";

interface Segment {
  key: string;
  label: string;
  amountInPaise: number;
}

function Composition({ metrics }: { metrics: MerchantMetrics }) {
  const segments: Segment[] = [
    { key: "baseline", label: "First recommendation", amountInPaise: metrics.baselineTotalInPaise },
    { key: "upsell", label: "Upsell accepted", amountInPaise: metrics.upsellInPaise },
    { key: "cross", label: "Cross-sell accepted", amountInPaise: metrics.crossSellInPaise },
    { key: "other", label: "Additional items", amountInPaise: metrics.otherItemsInPaise },
  ].filter((segment) => segment.amountInPaise > 0);

  const gross = segments.reduce((sum, segment) => sum + segment.amountInPaise, 0);
  if (gross === 0) return null;

  return (
    <figure className="db-figure">
      <figcaption>
        <h2 className="db-figure-title">Where the revenue came from</h2>
        <p>
          Every rupee the agent booked, split by the decision that earned it. Discount is shown
          separately below because it is money given back, not booked.
        </p>
      </figcaption>

      <div className="db-bar" role="img" aria-label={segments.map((s) => `${s.label} ${rupees(s.amountInPaise)}`).join(", ")}>
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={`db-seg db-seg-${segment.key}`}
            style={{ flexGrow: segment.amountInPaise }}
          />
        ))}
      </div>

      <ul className="db-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <i className={`db-swatch db-seg-${segment.key}`} aria-hidden="true" />
            <span>{segment.label}</span>
            <b>{rupees(segment.amountInPaise)}</b>
            <small>{((segment.amountInPaise / gross) * 100).toFixed(0)}%</small>
          </li>
        ))}
        {metrics.discountInPaise > 0 && (
          <li className="is-negative">
            <i className="db-swatch db-seg-discount" aria-hidden="true" />
            <span>Discount given</span>
            <b>{rupees(-metrics.discountInPaise)}</b>
            <small>
              {metrics.discountClampedCount > 0
                ? `${metrics.discountClampedCount} clamped by the server`
                : "within cap"}
            </small>
          </li>
        )}
      </ul>
    </figure>
  );
}

function Tile({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`db-tile${emphasis ? " is-hero" : ""}`}>
      <span className="db-tile-label">{label}</span>
      <strong className="db-tile-value">{value}</strong>
      <span className="db-tile-note">{note}</span>
    </div>
  );
}

export function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const [metrics, setMetrics] = useState<MerchantMetrics>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/audit/metrics"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("unavailable"))))
      .then(setMetrics)
      .catch(() => setFailed(true));
  }, []);

  const empty = metrics && metrics.sessionsWithOrder === 0;

  return (
    <div className="db">
      <header className="db-head">
        <a className="db-brand" href="/" onClick={navigate("/")}>
          <span aria-hidden="true">❖</span>
          <span className="db-brand-name">BAZAAR</span>
          <span className="db-brand-slash">/merchant</span>
        </a>
        <nav className="db-nav">
          <a href="/app" onClick={navigate("/app")}>
            Agent
          </a>
          <a href="/agents" onClick={navigate("/agents")}>
            AI buyers
          </a>
          <a
            className="db-icon"
            href="https://github.com/Dhruv-kys/BAZAAR"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <GitHubIcon size={15} />
          </a>
          <button
            className="db-icon"
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>
        </nav>
      </header>

      <main className="db-main">
        <div className="db-intro">
          <span className="db-eyebrow">Merchant view</span>
          <h1>
            What the agent
            <br />
            <em>earned the shop</em>
          </h1>
          <p>
            Measured from the audit trail across every conversation, counting only what a customer
            accepted. Nothing here is projected or sampled.
          </p>
        </div>

        {failed && (
          <p className="db-empty">
            The shop&rsquo;s server is not responding, so there are no figures to show.
          </p>
        )}

        {empty && (
          <p className="db-empty">
            No orders have been staged yet. Have a conversation with the agent and the numbers will
            appear here.
          </p>
        )}

        {metrics && !empty && (
          <>
            <div className="db-tiles">
              <Tile
                label="Revenue booked"
                value={rupeesShort(metrics.finalTotalInPaise)}
                note={`across ${metrics.sessionsWithOrder} order${metrics.sessionsWithOrder === 1 ? "" : "s"}`}
                emphasis
              />
              <Tile
                label="Uplift over first recommendation"
                value={`${metrics.upliftPercent >= 0 ? "+" : ""}${metrics.upliftPercent.toFixed(0)}%`}
                note={`${rupeesShort(metrics.upliftInPaise)} above ${rupeesShort(metrics.baselineTotalInPaise)}`}
                emphasis
              />
              <Tile
                label="Average order value"
                value={rupeesShort(metrics.averageOrderValueInPaise)}
                note={`${metrics.ordersPaid} paid`}
              />
              <Tile
                label="Attach rate"
                value={`${metrics.attachRatePercent.toFixed(0)}%`}
                note="orders carrying an add-on"
              />
              <Tile
                label="Upsell acceptance"
                value={
                  metrics.upsellOfferedCount === 0
                    ? "—"
                    : `${metrics.upsellAcceptancePercent.toFixed(0)}%`
                }
                note={
                  metrics.upsellOfferedCount === 0
                    ? "none offered yet"
                    : `${metrics.upsellAcceptedCount} of ${metrics.upsellOfferedCount} offered`
                }
              />
              <Tile
                label="Discount given"
                value={rupeesShort(metrics.discountInPaise)}
                note={
                  metrics.discountClampedCount > 0
                    ? `${metrics.discountClampedCount} clamped by the server`
                    : "all within the cap"
                }
              />
            </div>

            <Composition metrics={metrics} />

            <table className="db-table">
              <caption>The same figures as a table</caption>
              <tbody>
                <tr>
                  <th scope="row">Orders staged</th>
                  <td>{metrics.sessionsWithOrder}</td>
                </tr>
                <tr>
                  <th scope="row">Orders paid</th>
                  <td>{metrics.ordersPaid}</td>
                </tr>
                <tr>
                  <th scope="row">Baseline (first recommendation)</th>
                  <td>{rupees(metrics.baselineTotalInPaise)}</td>
                </tr>
                <tr>
                  <th scope="row">Upsell accepted</th>
                  <td>{rupees(metrics.upsellInPaise)}</td>
                </tr>
                <tr>
                  <th scope="row">Cross-sell accepted</th>
                  <td>{rupees(metrics.crossSellInPaise)}</td>
                </tr>
                <tr>
                  <th scope="row">Additional items</th>
                  <td>{rupees(metrics.otherItemsInPaise)}</td>
                </tr>
                <tr>
                  <th scope="row">Discount given</th>
                  <td>{rupees(-metrics.discountInPaise)}</td>
                </tr>
                <tr>
                  <th scope="row">Revenue booked</th>
                  <td>{rupees(metrics.finalTotalInPaise)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}
