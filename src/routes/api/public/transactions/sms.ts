/**
 * Secure SMS ingestion endpoint for the companion Android app.
 *
 *   POST /api/public/transactions/sms
 *   Authorization: Bearer <device_token>
 *   {
 *     "sms_body": "raw SMS text",
 *     "sender": "MPESA",
 *     "received_at": "2026-09-14T12:00:00Z",
 *     "device_id": "device-id"
 *   }
 *
 * The handler authenticates the paired device, stores the original message,
 * parses it through the provider-agnostic parser, classifies scope/category
 * using the owner's learned rules, and returns the stored transaction.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { parseSms, type CategoryRef, type LearnedRule } from "@/lib/sms/parser";

const BodySchema = z.object({
  sms_body: z.string().min(5).max(2000),
  sender: z.string().min(2).max(64),
  received_at: z.string().datetime().optional(),
  device_id: z.string().uuid(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/public/transactions/sms")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "authorization, content-type",
          },
        }),

      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token || token.length < 24) {
          return json({ error: "Missing device token" }, 401);
        }

        let payload: z.infer<typeof BodySchema>;
        try {
          payload = BodySchema.parse(await request.json());
        } catch (e) {
          return json({ error: "Invalid payload", details: (e as Error).message }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Authenticate the device. Token and id must belong to the same active device.
        const { data: device } = await supabaseAdmin
          .from("paired_devices")
          .select("id, user_id, status")
          .eq("device_token", token)
          .maybeSingle();

        if (!device || device.id !== payload.device_id || device.status !== "active") {
          return json({ error: "Device not recognised or not active" }, 401);
        }
        const userId = device.user_id;
        const receivedAt = payload.received_at ?? new Date().toISOString();

        // 2. Store the original message securely, scoped to the owner.
        const { data: stored, error: storeError } = await supabaseAdmin
          .from("sms_messages")
          .insert({
            user_id: userId,
            device_id: device.id,
            sender: payload.sender,
            body: payload.sms_body,
            received_at: receivedAt,
          })
          .select("id")
          .single();

        if (storeError || !stored) {
          return json({ error: "Could not store message" }, 500);
        }

        // 2b. Shared household, if the owner belongs to one.
        const { data: membership } = await supabaseAdmin
          .from("household_members")
          .select("household_id")
          .eq("user_id", userId)
          .maybeSingle();
        const householdId = membership?.household_id ?? null;

        // 3. Load the owner's categories and learned corrections for classification.
        const [{ data: categories }, { data: rules }] = await Promise.all([
          householdId
            ? supabaseAdmin
                .from("transaction_categories")
                .select("id, name, scope")
                .eq("household_id", householdId)
            : supabaseAdmin.from("transaction_categories").select("id, name, scope").eq("user_id", userId),
          supabaseAdmin
            .from("category_rules")
            .select("keyword, scope, category_id, transaction_type, hits")
            .eq("user_id", userId),
        ]);

        // 4-11. Parse, extract and classify.
        const parsed = parseSms({
          smsBody: payload.sms_body,
          sender: payload.sender,
          receivedAt,
          categories: (categories ?? []) as CategoryRef[],
          rules: (rules ?? []) as LearnedRule[],
        });

        await supabaseAdmin
          .from("paired_devices")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", device.id);

        if (!parsed.matched || !(parsed.amount > 0)) {
          await supabaseAdmin
            .from("sms_messages")
            .update({ parsed: false, parse_error: parsed.reasons.join("; ") })
            .eq("id", stored.id);
          return json(
            { status: "stored_unparsed", sms_id: stored.id, reasons: parsed.reasons },
            202,
          );
        }

        // 12. Persist with the confidence score and review flag.
        const { data: transaction, error: txError } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: userId,
            transaction_type: parsed.transactionType,
            amount: parsed.amount,
            currency: parsed.currency,
            description: parsed.description,
            merchant: parsed.merchant ?? null,
            sender: parsed.sender ?? payload.sender,
            recipient: parsed.recipient ?? null,
            reference: parsed.reference ?? null,
            source: parsed.source,
            scope: parsed.scope,
            category_id: parsed.categoryId ?? null,
            transaction_date: parsed.transactionDate,
            confidence_score: parsed.confidenceScore,
            is_manual: false,
            needs_review: parsed.needsReview,
            sms_message_id: stored.id,
            household_id: householdId,
          })
          .select()
          .single();

        if (txError) {
          // A duplicate reference means this message was already ingested.
          const duplicate = txError.code === "23505";
          await supabaseAdmin
            .from("sms_messages")
            .update({ parsed: duplicate, parse_error: duplicate ? "duplicate" : txError.message })
            .eq("id", stored.id);
          return json(
            { status: duplicate ? "duplicate" : "error", error: txError.message },
            duplicate ? 200 : 500,
          );
        }

        await supabaseAdmin.from("sms_messages").update({ parsed: true }).eq("id", stored.id);

        // 13. Return the parsed transaction.
        return json({
          status: "created",
          transaction,
          classification: {
            pattern: parsed.patternId,
            confidence_score: parsed.confidenceScore,
            needs_review: parsed.needsReview,
            category: parsed.categoryName,
            scope: parsed.scope,
            reasons: parsed.reasons,
          },
        });
      },
    },
  },
});
