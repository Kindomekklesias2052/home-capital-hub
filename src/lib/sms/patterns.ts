/**
 * Pattern registry for transactional SMS parsing.
 *
 * Each provider contributes a list of patterns. A pattern is a named regex plus
 * a mapper that turns the named capture groups into a partial transaction.
 * New providers (KCB, Equity, Co-op, NCBA ...) are added by appending entries —
 * no existing pattern is ever hard-coded into the parser itself.
 */

import type { LedgerScope, TransactionSource, TransactionType } from "../domain";

export interface ParsedFields {
  transactionType: TransactionType;
  amount: number;
  currency: string;
  reference?: string | undefined;
  counterparty?: string | undefined;
  merchant?: string | undefined;
  sender?: string | undefined;
  recipient?: string | undefined;
  occurredAt?: string | undefined;
  balance?: number | undefined;
  description: string;
}

export interface SmsPattern {
  id: string;
  source: TransactionSource;
  /** Sender ids this pattern may apply to, lowercase substrings. */
  senders: string[];
  regex: RegExp;
  /** Baseline confidence this pattern provides on a clean match. */
  confidence: number;
  /** Hint for the scope classifier, overridden by learned rules. */
  scopeHint?: LedgerScope;
  map: (groups: Record<string, string | undefined>, body: string) => ParsedFields | null;
}

export function toAmount(raw: string | undefined): number {
  if (!raw) return NaN;
  return Number(raw.replace(/,/g, "").trim());
}

/** "3/9/26 at 7:45 PM" / "14/9/26 at 07:45" -> ISO string */
export function toIsoDate(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  let hours = 0;
  let minutes = 0;
  if (time) {
    const t = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (t) {
      hours = Number(t[1]) % 12;
      minutes = Number(t[2]);
      if (t[3] && t[3].toUpperCase() === "PM") hours += 12;
      if (!t[3]) hours = Number(t[1]);
    }
  }
  const dt = new Date(Date.UTC(year, Number(mo) - 1, Number(d), hours - 3, minutes));
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

const AMT = String.raw`(?<amount>[\d,]+(?:\.\d{1,2})?)`;
const CUR = String.raw`(?:Ksh|KES|KSH|Kshs)\.?\s*`;
const PARTY = String.raw`(?<party>(?:(?!\s+on\s+\d)[^.])+?)`;
const WHEN = String.raw`(?:on\s*(?<date>\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:at\s*(?<time>\d{1,2}:\d{2}\s*(?:AM|PM)?))?)?`;

export const SMS_PATTERNS: SmsPattern[] = [
  {
    id: "mpesa.send",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom"],
    confidence: 0.93,
    regex: new RegExp(
      String.raw`^(?<ref>[A-Z0-9]{8,12})\s+Confirmed\.?\s*${CUR}${AMT}\s+sent to\s+${PARTY}\s+${WHEN}`,
      "i",
    ),
    map: (g) => ({
      transactionType: "expense",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      recipient: cleanParty(g["party"]),
      merchant: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      occurredAt: toIsoDate(g["date"], g["time"]),
      description: `Sent to ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "mpesa.paybill",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom"],
    confidence: 0.94,
    regex: new RegExp(
      String.raw`^(?<ref>[A-Z0-9]{8,12})\s+Confirmed\.?\s*${CUR}${AMT}\s+(?:paid|sent) to\s+${PARTY}(?:\s+for account\s+(?<account>[^.]+?))?\s*\.\s*${WHEN}`,
      "i",
    ),
    map: (g) => ({
      transactionType: "expense",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      merchant: cleanParty(g["party"]),
      recipient: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      occurredAt: toIsoDate(g["date"], g["time"]),
      description: g["account"]
        ? `Paid ${cleanParty(g["party"])} (acc ${g["account"].trim()})`
        : `Paid ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "mpesa.receive",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom"],
    confidence: 0.94,
    regex: new RegExp(
      String.raw`^(?<ref>[A-Z0-9]{8,12})\s+Confirmed\.?\s*(?:You have received|Received)\s*${CUR}${AMT}\s+from\s+${PARTY}\s+${WHEN}`,
      "i",
    ),
    map: (g) => ({
      transactionType: "income",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      sender: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      occurredAt: toIsoDate(g["date"], g["time"]),
      description: `Received from ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "mpesa.withdraw",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom"],
    confidence: 0.92,
    regex: new RegExp(
      String.raw`^(?<ref>[A-Z0-9]{8,12})\s+Confirmed\.?\s*${WHEN}\s*Withdraw\s*${CUR}${AMT}\s+from\s+${PARTY}\s*(?:New M-PESA balance|\.)`,
      "i",
    ),
    map: (g) => ({
      transactionType: "withdrawal",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      merchant: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      occurredAt: toIsoDate(g["date"], g["time"]),
      description: `Cash withdrawal at ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "mpesa.deposit",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom"],
    confidence: 0.9,
    regex: new RegExp(
      String.raw`^(?<ref>[A-Z0-9]{8,12})\s+Confirmed\.?\s*(?:You have deposited|Give)\s*${CUR}${AMT}\s+to\s+${PARTY}\s+${WHEN}`,
      "i",
    ),
    map: (g) => ({
      transactionType: "deposit",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      merchant: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      occurredAt: toIsoDate(g["date"], g["time"]),
      description: `Deposit at ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "mpesa.airtime",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom"],
    confidence: 0.95,
    regex: new RegExp(
      String.raw`^(?<ref>[A-Z0-9]{8,12})\s+Confirmed\.?\s*You bought\s*${CUR}${AMT}\s+of airtime\s*${WHEN}`,
      "i",
    ),
    map: (g) => ({
      transactionType: "expense",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      merchant: "Safaricom Airtime",
      counterparty: "Safaricom",
      occurredAt: toIsoDate(g["date"], g["time"]),
      description: "Airtime purchase",
    }),
  },
  {
    id: "mpesa.fuliza",
    source: "mpesa",
    senders: ["mpesa", "m-pesa", "safaricom", "fuliza"],
    confidence: 0.85,
    scopeHint: "personal",
    regex: new RegExp(
      String.raw`Fuliza M-PESA amount is\s*${CUR}${AMT}`,
      "i",
    ),
    map: (g) => ({
      transactionType: "loan",
      amount: toAmount(g["amount"]),
      currency: "KES",
      counterparty: "Fuliza",
      merchant: "Fuliza M-PESA",
      description: "Fuliza overdraft used",
    }),
  },
  {
    id: "kcb.debit",
    source: "kcb",
    senders: ["kcb"],
    confidence: 0.86,
    regex: new RegExp(
      String.raw`(?<ref>[A-Z0-9]{6,14})?\s*.*?(?:Debit|debited|paid)\s*(?:of)?\s*${CUR}${AMT}.*?(?:to|at)\s+(?<party>[A-Za-z0-9 &'._-]+?)\s*(?:on|\.|Ref)`,
      "i",
    ),
    map: (g) => ({
      transactionType: "expense",
      amount: toAmount(g["amount"]),
      currency: "KES",
      reference: g["ref"],
      recipient: cleanParty(g["party"]),
      merchant: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      description: `KCB payment to ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "kcb.credit",
    source: "kcb",
    senders: ["kcb"],
    confidence: 0.86,
    regex: new RegExp(
      String.raw`(?:Credit|credited|received)\s*(?:of)?\s*${CUR}${AMT}.*?from\s+(?<party>[A-Za-z0-9 &'._-]+?)\s*(?:on|\.|Ref)`,
      "i",
    ),
    map: (g) => ({
      transactionType: "income",
      amount: toAmount(g["amount"]),
      currency: "KES",
      sender: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      description: `KCB credit from ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "equity.debit",
    source: "equity",
    senders: ["equity", "equitybank"],
    confidence: 0.84,
    regex: new RegExp(
      String.raw`(?:Debit|purchase|payment) of\s*${CUR}${AMT}.*?(?:to|at)\s+(?<party>[A-Za-z0-9 &'._-]+?)\s*(?:on|\.|Ref)`,
      "i",
    ),
    map: (g) => ({
      transactionType: "expense",
      amount: toAmount(g["amount"]),
      currency: "KES",
      recipient: cleanParty(g["party"]),
      merchant: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      description: `Equity payment to ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "equity.credit",
    source: "equity",
    senders: ["equity", "equitybank"],
    confidence: 0.84,
    regex: new RegExp(
      String.raw`(?:Credit|deposit) of\s*${CUR}${AMT}.*?from\s+(?<party>[A-Za-z0-9 &'._-]+?)\s*(?:on|\.|Ref)`,
      "i",
    ),
    map: (g) => ({
      transactionType: "income",
      amount: toAmount(g["amount"]),
      currency: "KES",
      sender: cleanParty(g["party"]),
      counterparty: cleanParty(g["party"]),
      description: `Equity credit from ${cleanParty(g["party"])}`,
    }),
  },
  {
    id: "generic.debit",
    source: "bank",
    senders: [],
    confidence: 0.55,
    regex: new RegExp(String.raw`(?:debited|paid|spent|sent)\D{0,30}${CUR}${AMT}`, "i"),
    map: (g, body) => ({
      transactionType: "expense",
      amount: toAmount(g["amount"]),
      currency: "KES",
      description: firstSentence(body),
    }),
  },
  {
    id: "generic.credit",
    source: "bank",
    senders: [],
    confidence: 0.55,
    regex: new RegExp(String.raw`(?:credited|received|deposited)\D{0,30}${CUR}${AMT}`, "i"),
    map: (g, body) => ({
      transactionType: "income",
      amount: toAmount(g["amount"]),
      currency: "KES",
      description: firstSentence(body),
    }),
  },
];

export function cleanParty(raw?: string): string {
  if (!raw) return "Unknown";
  return raw
    .replace(/\b\d{7,}\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/[,.\s]+$/, "")
    .trim()
    .slice(0, 80);
}

function firstSentence(body: string): string {
  return body.split(/[.\n]/)[0]?.trim().slice(0, 120) ?? body.slice(0, 120);
}
