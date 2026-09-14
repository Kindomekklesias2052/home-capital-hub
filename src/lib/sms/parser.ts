/**
 * Provider-agnostic SMS transaction parser.
 *
 * The parser walks a registry of patterns (src/lib/sms/patterns.ts), picks the
 * highest scoring match, then runs classification (scope + category) using
 * keyword heuristics plus the user's learned correction rules.
 *
 * This module is pure: no database, no network. It is used by the secure
 * ingestion endpoint (`POST /api/public/transactions/sms`) and can also be
 * unit-tested or reused by future providers.
 */

import type { LedgerScope, TransactionSource, TransactionType } from "../domain";
import { SMS_PATTERNS, type ParsedFields } from "./patterns";

export interface LearnedRule {
  keyword: string;
  scope: LedgerScope;
  category_id: string | null;
  transaction_type: TransactionType | null;
  hits: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  scope: LedgerScope;
}

export interface ParseInput {
  smsBody: string;
  sender: string;
  receivedAt?: string;
  categories?: CategoryRef[];
  rules?: LearnedRule[];
  /** Scope used when nothing else matches. */
  defaultScope?: LedgerScope;
}

export interface ParseResult {
  matched: boolean;
  patternId?: string;
  source: TransactionSource;
  transactionType: TransactionType;
  amount: number;
  currency: string;
  description: string;
  merchant?: string | undefined;
  sender?: string | undefined;
  recipient?: string | undefined;
  reference?: string | undefined;
  transactionDate: string;
  scope: LedgerScope;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
  confidenceScore: number;
  needsReview: boolean;
  reasons: string[];
}

interface KeywordRule {
  match: RegExp;
  scope: LedgerScope;
  category: string;
  weight: number;
}

/** Seed heuristics tuned for Kenyan household spending. */
const KEYWORD_RULES: KeywordRule[] = [
  { match: /school|academy|fees|college|university|tuition/i, scope: "family", category: "School Fees", weight: 0.2 },
  { match: /naivas|quickmart|carrefour|tuskys|shoprite|supermarket|grocer/i, scope: "family", category: "Household Food", weight: 0.15 },
  { match: /kplc|kenya power|token|water|nairobi water|gas|maji/i, scope: "family", category: "Utilities", weight: 0.15 },
  { match: /hospital|clinic|chemist|pharmac|mediheal|aga khan|doctor/i, scope: "family", category: "Healthcare", weight: 0.18 },
  { match: /rent|landlord|caretaker|house rent/i, scope: "family", category: "Rent", weight: 0.15 },
  { match: /mum|mama|dad|baba|shosh|upcountry|family support|shags/i, scope: "family", category: "Family Support", weight: 0.12 },
  { match: /airtime|bundles|safaricom|netflix|dstv|showmax|subscription/i, scope: "personal", category: "Personal Bills", weight: 0.15 },
  { match: /java|kfc|cafe|restaurant|hotel|pizza|burger|lunch|chakula/i, scope: "personal", category: "Food", weight: 0.12 },
  { match: /uber|bolt|little cab|matatu|fare|boda|shell|total|petrol|fuel/i, scope: "personal", category: "Transport", weight: 0.1 },
  { match: /bata|mr price|clothing|boutique|deacons|jumia fashion/i, scope: "personal", category: "Clothing", weight: 0.12 },
  { match: /betika|sportpesa|cinema|movie|club|bar|entertainment/i, scope: "personal", category: "Entertainment", weight: 0.12 },
  { match: /mshwari|kcb m-?pesa|sacco|savings|money market|lock savings/i, scope: "personal", category: "Savings", weight: 0.12 },
  { match: /wholesale|wholesalers|distributor|stock|supplier|godown|cartons/i, scope: "business", category: "Stock", weight: 0.18 },
  { match: /salary to|wages|casual|employee|staff pay/i, scope: "business", category: "Salaries", weight: 0.15 },
  { match: /till|buy goods|customer|sales|invoice|paybill received/i, scope: "business", category: "Business Revenue", weight: 0.12 },
  { match: /loan repayment|repay|instalment|installment|fuliza|overdraft/i, scope: "business", category: "Loan Repayment", weight: 0.1 },
  { match: /advert|marketing|promotion|branding|printing/i, scope: "business", category: "Marketing", weight: 0.12 },
];

function detectSource(senderId: string, patternSource?: TransactionSource): TransactionSource {
  const s = senderId.toLowerCase();
  if (s.includes("mpesa") || s.includes("m-pesa") || s.includes("safaricom")) return "mpesa";
  if (s.includes("kcb")) return "kcb";
  if (s.includes("equity")) return "equity";
  return patternSource ?? "bank";
}

export function parseSms(input: ParseInput): ParseResult {
  const body = (input.smsBody ?? "").trim();
  const senderId = (input.sender ?? "").trim();
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const reasons: string[] = [];

  const senderKey = senderId.toLowerCase();
  const candidates = SMS_PATTERNS.filter(
    (p) => p.senders.length === 0 || p.senders.some((s) => senderKey.includes(s)),
  );

  let best: { fields: ParsedFields; confidence: number; patternId: string; source: TransactionSource } | null = null;

  for (const pattern of candidates) {
    const match = pattern.regex.exec(body);
    if (!match) continue;
    const fields = pattern.map(match.groups ?? {}, body);
    if (!fields || !Number.isFinite(fields.amount) || fields.amount <= 0) continue;
    const senderBonus = pattern.senders.some((s) => senderKey.includes(s)) ? 0.03 : 0;
    const confidence = Math.min(0.99, pattern.confidence + senderBonus);
    if (!best || confidence > best.confidence) {
      best = { fields, confidence, patternId: pattern.id, source: pattern.source };
    }
  }

  if (!best) {
    return {
      matched: false,
      source: detectSource(senderId),
      transactionType: "expense",
      amount: 0,
      currency: "KES",
      description: body.slice(0, 160),
      transactionDate: receivedAt,
      scope: input.defaultScope ?? "personal",
      confidenceScore: 0,
      needsReview: true,
      reasons: ["No known pattern matched this message"],
      merchant: undefined,
      sender: senderId,
      recipient: undefined,
      reference: undefined,
      categoryId: undefined,
      categoryName: undefined,
    };
  }

  reasons.push(`Matched pattern ${best.patternId}`);

  const haystack = `${body} ${best.fields.merchant ?? ""} ${best.fields.counterparty ?? ""}`;
  const classification = classify({
    haystack,
    type: best.fields.transactionType,
    categories: input.categories ?? [],
    rules: input.rules ?? [],
    fallbackScope: input.defaultScope ?? "personal",
    reasons,
  });

  const confidence = clamp(best.confidence * 0.7 + classification.confidence * 0.3);

  return {
    matched: true,
    patternId: best.patternId,
    source: detectSource(senderId, best.source),
    transactionType: best.fields.transactionType,
    amount: best.fields.amount,
    currency: best.fields.currency || "KES",
    description: best.fields.description,
    merchant: best.fields.merchant,
    sender: best.fields.sender ?? senderId,
    recipient: best.fields.recipient,
    reference: best.fields.reference,
    transactionDate: best.fields.occurredAt ?? receivedAt,
    scope: classification.scope,
    categoryId: classification.categoryId,
    categoryName: classification.categoryName,
    confidenceScore: Number(confidence.toFixed(3)),
    needsReview: confidence < 0.75 || !classification.categoryId,
    reasons,
  };
}

function classify(args: {
  haystack: string;
  type: TransactionType;
  categories: CategoryRef[];
  rules: LearnedRule[];
  fallbackScope: LedgerScope;
  reasons: string[];
}) {
  const { haystack, type, categories, rules, fallbackScope, reasons } = args;
  const text = haystack.toLowerCase();

  // 1. Learned corrections always win — they come straight from the user.
  const learned = rules
    .filter((r) => r.keyword && text.includes(r.keyword.toLowerCase()))
    .sort((a, b) => b.hits - a.hits)[0];
  if (learned) {
    reasons.push(`Learned rule "${learned.keyword}"`);
    const cat = categories.find((c) => c.id === learned.category_id);
    return {
      scope: learned.scope,
      categoryId: cat?.id,
      categoryName: cat?.name,
      confidence: Math.min(0.98, 0.82 + Math.min(learned.hits, 8) * 0.02),
    };
  }

  // 2. Keyword heuristics.
  const hit = KEYWORD_RULES.find((r) => r.match.test(text));
  if (hit) {
    reasons.push(`Keyword rule → ${hit.scope}/${hit.category}`);
    const cat = categories.find((c) => c.scope === hit.scope && c.name === hit.category);
    return {
      scope: hit.scope,
      categoryId: cat?.id,
      categoryName: cat?.name ?? hit.category,
      confidence: 0.6 + hit.weight,
    };
  }

  // 3. Fall back to a scope default with an explicit "other" bucket.
  const scope = type === "income" ? fallbackScope : fallbackScope;
  const fallbackName =
    scope === "business" ? "Other Business" : scope === "family" ? "Other Family" : "Other Personal";
  const cat = categories.find((c) => c.scope === scope && c.name === fallbackName);
  reasons.push("No confident classification — flagged for confirmation");
  return { scope, categoryId: cat?.id, categoryName: cat?.name ?? fallbackName, confidence: 0.35 };
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Extract a stable keyword the correction engine can learn from. */
export function learningKeyword(source: { merchant?: string | null; recipient?: string | null; sender?: string | null; description?: string | null }): string | null {
  const candidate = source.merchant || source.recipient || source.sender || source.description;
  if (!candidate) return null;
  const cleaned = candidate.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return null;
  return cleaned.split(" ").slice(0, 3).join(" ");
}
