"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, AlertCircle, FileJson, Code2 } from "lucide-react";
import Money from "./shared/Money";

interface GatewayResponseViewerProps {
  gatewayResponse: Record<string, unknown> | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
  gateway: string;
}

/**
 * Pretty key/value viewer for raw gateway webhook payloads + payment
 * metadata. Replaces a raw <pre>JSON</pre> dump. Top-level scalar fields
 * render as friendly key/value rows; known fields (amount, status, dates,
 * IDs) get specialized formatting (Money / pill / mono); nested objects
 * collapse with an expand chevron. A single "Raw JSON" toggle at the
 * top of each card flips back to the JSON view for power users who need
 * the literal payload.
 */
const GatewayResponseViewer = ({
  gatewayResponse,
  metadata,
  gateway,
}: GatewayResponseViewerProps) => {
  const t = useTranslations("financeDashboard");
  const [rawGateway, setRawGateway] = useState(false);
  const [rawMeta, setRawMeta] = useState(false);

  const hasResponse = gatewayResponse && Object.keys(gatewayResponse).length > 0;
  const hasMeta = metadata && Object.keys(metadata).length > 0;

  if (!hasResponse && !hasMeta) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
        <AlertCircle className="w-4 h-4" />
        {t("paymentDetail.noGatewayResponse")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasResponse && (
        <Section
          title={t("paymentDetail.gatewayLogs")}
          icon={<FileJson className="w-3.5 h-3.5" />}
          raw={rawGateway}
          onToggleRaw={() => setRawGateway((v) => !v)}
          data={gatewayResponse as Record<string, unknown>}
          gateway={gateway}
        />
      )}
      {hasMeta && (
        <Section
          title={t("paymentDetail.metadata")}
          icon={<Code2 className="w-3.5 h-3.5" />}
          raw={rawMeta}
          onToggleRaw={() => setRawMeta((v) => !v)}
          data={metadata as Record<string, unknown>}
          gateway={gateway}
        />
      )}
    </div>
  );
};

function Section({
  title,
  icon,
  raw,
  onToggleRaw,
  data,
  gateway,
}: {
  title: string;
  icon: React.ReactNode;
  raw: boolean;
  onToggleRaw: () => void;
  data: Record<string, unknown>;
  gateway: string;
}) {
  const t = useTranslations("financeDashboard");
  return (
    <div className="border border-[var(--color-border-subtle)] rounded-lg overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--color-surface-page)] border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {icon}
          {title}
        </div>
        <button
          type="button"
          onClick={onToggleRaw}
          className="text-[10px] font-medium text-[var(--color-primary)] hover:underline"
        >
          {raw ? t("paymentDetail.viewer.viewPretty") : t("paymentDetail.viewer.viewRaw")}
        </button>
      </header>

      <div className="p-3">
        {raw ? (
          <pre
            className="text-[11px] font-mono bg-[var(--color-surface-page)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto text-[var(--color-text-primary)]"
            dir="ltr"
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <KeyValueGrid data={data} gateway={gateway} />
        )}
      </div>
    </div>
  );
}

function KeyValueGrid({
  data,
  gateway,
}: {
  data: Record<string, unknown>;
  gateway: string;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-xs text-[var(--color-text-secondary)] italic">—</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-y-2">
      {entries.map(([key, value]) => (
        <KeyValueRow key={key} fieldKey={key} value={value} gateway={gateway} />
      ))}
    </dl>
  );
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONEY_KEYS = new Set([
  "amount",
  "amountFormat",
  "total",
  "subtotal",
  "fee",
  "tax",
  "refundedAmount",
  "capturedAmount",
  "discountAmount",
]);

const STATUS_KEYS = new Set([
  "status",
  "state",
  "result",
  "payment_status",
  "transaction_status",
]);

const DATE_KEYS_RE = /(_at|At|Date|date|time|Time)$/;

function statusColor(value: string): string {
  const v = value.toLowerCase();
  if (/(paid|captured|approved|completed|success|active|clean)/.test(v))
    return "bg-emerald-100 text-emerald-700";
  if (/(failed|rejected|chargeback|infected|error|declined)/.test(v))
    return "bg-rose-100 text-rose-700";
  if (/(pending|processing|initiated|awaiting|review)/.test(v))
    return "bg-amber-100 text-amber-700";
  if (/(refund|partially)/.test(v)) return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

function KeyValueRow({
  fieldKey,
  value,
  gateway,
  depth = 0,
}: {
  fieldKey: string;
  value: unknown;
  gateway: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth === 0);

  if (value === null || value === undefined) {
    return (
      <Row label={humanLabel(fieldKey)} indent={depth}>
        <span className="text-[var(--color-text-secondary)] italic">—</span>
      </Row>
    );
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <Row label={humanLabel(fieldKey)} indent={depth}>
          <span className="text-[var(--color-text-secondary)] italic">{"{}"}</span>
        </Row>
      );
    }
    return (
      <div className={`${depth > 0 ? "ms-3 ps-3 border-s border-[var(--color-border-subtle)]" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)]"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>{humanLabel(fieldKey)}</span>
          <span className="text-[10px] text-[var(--color-text-secondary)] font-normal">
            {`{${entries.length}}`}
          </span>
        </button>
        {open && (
          <dl className="grid grid-cols-1 gap-y-1.5 mt-1.5">
            {entries.map(([k, v]) => (
              <KeyValueRow
                key={k}
                fieldKey={k}
                value={v}
                gateway={gateway}
                depth={depth + 1}
              />
            ))}
          </dl>
        )}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Row label={humanLabel(fieldKey)} indent={depth}>
          <span className="text-[var(--color-text-secondary)] italic">[]</span>
        </Row>
      );
    }
    return (
      <div className={`${depth > 0 ? "ms-3 ps-3 border-s border-[var(--color-border-subtle)]" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)]"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>{humanLabel(fieldKey)}</span>
          <span className="text-[10px] text-[var(--color-text-secondary)] font-normal">
            {`[${value.length}]`}
          </span>
        </button>
        {open && (
          <dl className="grid grid-cols-1 gap-y-1.5 mt-1.5">
            {value.map((v, idx) => (
              <KeyValueRow
                key={idx}
                fieldKey={`[${idx}]`}
                value={v}
                gateway={gateway}
                depth={depth + 1}
              />
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <Row label={humanLabel(fieldKey)} indent={depth}>
      <ScalarValue fieldKey={fieldKey} value={value} gateway={gateway} />
    </Row>
  );
}

function Row({
  label,
  indent,
  children,
}: {
  label: string;
  indent: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 text-xs ${
        indent > 0 ? "ms-3 ps-3 border-s border-[var(--color-border-subtle)]" : ""
      }`}
    >
      <dt className="text-[var(--color-text-secondary)] font-medium shrink-0">
        {label}
      </dt>
      <dd className="text-[var(--color-text-primary)] text-right break-all min-w-0">
        {children}
      </dd>
    </div>
  );
}

function ScalarValue({
  fieldKey,
  value,
  gateway,
}: {
  fieldKey: string;
  value: unknown;
  gateway: string;
}) {
  // Status pill
  if (typeof value === "string" && STATUS_KEYS.has(fieldKey)) {
    return (
      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${statusColor(value)}`}>
        {value.replace(/_/g, " ")}
      </span>
    );
  }

  // Money — gateway amounts often come in halalah (smallest unit). Heuristic:
  // Moyasar/Tabby/Tamara return integer halalah for amount; gateway-side
  // formatted amounts (amountFormat) come as decimal strings.
  if ((typeof value === "number" || /^\d+$/.test(String(value))) && MONEY_KEYS.has(fieldKey)) {
    const raw = Number(value);
    const isHalalah =
      fieldKey === "amount" &&
      (gateway === "moyasar" || gateway === "tabby" || gateway === "tamara") &&
      raw >= 100 &&
      Number.isInteger(raw);
    const amount = isHalalah ? raw / 100 : raw;
    return <Money amount={amount} decimals={2} iconSize={10} />;
  }

  // Date — ISO-ish string
  if (typeof value === "string" && DATE_KEYS_RE.test(fieldKey) && !isNaN(Date.parse(value))) {
    return (
      <span className="font-mono text-[11px]">
        {new Date(value).toLocaleString("en-US")}
      </span>
    );
  }

  // Boolean pill
  if (typeof value === "boolean") {
    return (
      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
        value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}>
        {value ? "true" : "false"}
      </span>
    );
  }

  // URL → clickable
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-[var(--color-primary)] hover:underline break-all"
        dir="ltr"
      >
        {value.length > 50 ? value.slice(0, 47) + "…" : value}
      </a>
    );
  }

  // ID-shaped string (UUID, charge id)
  if (typeof value === "string" && /^[a-zA-Z0-9_\-]{12,}$/.test(value)) {
    return <span className="font-mono text-[11px] break-all" dir="ltr">{value}</span>;
  }

  return <span className="text-[12px]">{String(value)}</span>;
}

export default GatewayResponseViewer;
