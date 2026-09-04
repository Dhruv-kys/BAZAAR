import { useEffect, useState } from "react";
import { Note } from "../Marginalia";
import { apiUrl } from "../api";
import { type MerchantMetrics, rupees, rupeesShort } from "../governance/metrics";
import { PageShell } from "../pages/PageShell";
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
    <figure className="db-figure" data-reveal>
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
    <PageShell slug="dashboard" width={980}>
        <div className="pg-intro" data-reveal>
          <span className="pg-eyebrow">Merchant view</span>
          <h1>
            What the agent
            <br />
            <em>earned the shop</em>
          </h1>
          <p>
            Measured from the audit trail across every conversation, counting only what a customer
            accepted. Nothing here is projected or sampled.
          </p>
          <Note>an upsell counts only once the customer says yes</Note>
        </div>

        {!metrics && !failed && (
          <p className="db-empty" role="status">
            Reading the audit trail&hellip;
          </p>
        )}

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
            <div className="db-tiles" data-reveal>
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

            <table className="db-table" data-reveal>
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
    </PageShell>
  );
}
