import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SCOPES, SCOPE_LABELS, TYPE_LABELS } from "./domain";
import { formatDate, formatMoney } from "./format";
import { scopeTotals, spendingByCategory, totalsFor } from "./analytics";
import type { CategoryRow, TransactionRow } from "@/hooks/useLedger";

export type ReportRange = "30" | "90" | "365" | "all";

export const RANGE_LABELS: Record<ReportRange, string> = {
  "30": "Last 30 days",
  "90": "Last 90 days",
  "365": "Last 12 months",
  all: "All time",
};

export function filterByRange(transactions: TransactionRow[], range: ReportRange) {
  if (range === "all") return transactions;
  const cutoff = Date.now() - Number(range) * 86_400_000;
  return transactions.filter((t) => new Date(t.transaction_date).getTime() >= cutoff);
}

export interface ReportData {
  rangeLabel: string;
  generatedAt: string;
  transactions: TransactionRow[];
  totals: ReturnType<typeof totalsFor>;
  byScope: ReturnType<typeof scopeTotals>;
  byCategory: { name: string; value: number }[];
}

export function buildReport(
  transactions: TransactionRow[],
  categories: CategoryRow[],
  range: ReportRange,
): ReportData {
  const rows = filterByRange(transactions, range);
  return {
    rangeLabel: RANGE_LABELS[range],
    generatedAt: new Date().toISOString(),
    transactions: rows,
    totals: totalsFor(rows),
    byScope: scopeTotals(rows),
    byCategory: spendingByCategory(rows, categories, 10),
  };
}

export function reportCsv(report: ReportData, categories: CategoryRow[]): string {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const header = ["date", "type", "amount", "currency", "ledger", "source", "category", "merchant", "reference", "description"];
  const clean = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = report.transactions.map((t) =>
    [
      t.transaction_date,
      t.transaction_type,
      String(t.amount),
      t.currency,
      t.scope,
      t.source,
      (t.category_id && names.get(t.category_id)) || "",
      t.merchant ?? "",
      t.reference ?? "",
      t.description ?? "",
    ]
      .map(clean)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function reportPdf(report: ReportData, categories: CategoryRow[]): jsPDF {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.text("Kinship Capital — Transaction summary", 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${report.rangeLabel} · generated ${formatDate(report.generatedAt)}`, 40, 68);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 90,
    head: [["Overview", "Amount"]],
    body: [
      ["Total income", formatMoney(report.totals.income)],
      ["Total expenses", formatMoney(report.totals.expenses)],
      ["Net cash flow", formatMoney(report.totals.net)],
      ["Transactions", String(report.transactions.length)],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 90, 66] },
  });

  autoTable(doc, {
    head: [["Ledger", "Income", "Expenses", "Net"]],
    body: SCOPES.map((s) => [
      SCOPE_LABELS[s],
      formatMoney(report.byScope[s].income),
      formatMoney(report.byScope[s].expenses),
      formatMoney(report.byScope[s].net),
    ]),
    theme: "striped",
    headStyles: { fillColor: [16, 90, 66] },
  });

  if (report.byCategory.length) {
    autoTable(doc, {
      head: [["Top spending category", "Amount"]],
      body: report.byCategory.map((c) => [c.name, formatMoney(c.value)]),
      theme: "striped",
      headStyles: { fillColor: [16, 90, 66] },
    });
  }

  autoTable(doc, {
    head: [["Date", "Type", "Ledger", "Details", "Amount"]],
    body: report.transactions.map((t) => [
      formatDate(t.transaction_date),
      TYPE_LABELS[t.transaction_type],
      SCOPE_LABELS[t.scope],
      t.merchant ?? t.recipient ?? t.sender ?? (t.category_id ? (names.get(t.category_id) ?? "") : ""),
      formatMoney(t.amount),
    ]),
    styles: { fontSize: 8 },
    theme: "grid",
    headStyles: { fillColor: [16, 90, 66] },
  });

  return doc;
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
