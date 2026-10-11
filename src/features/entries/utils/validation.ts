import { z } from "zod";
import { SIGNIFIERS } from "../types/entry.ts";

const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const workLedgerEntrySchema = z
  .object({
    id: z.string().min(1),
    dayKey: z.string().regex(DAY_KEY_REGEX),
    createdAt: z.number().nonnegative(),
    updatedAt: z.number().nonnegative(),
    blocks: z.array(z.record(z.string(), z.unknown())).default([]),
    isArchived: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    isPinned: z.boolean().default(false),
    // Older exports and devices still carry the removed note/task signifiers.
    // Drop unknown values instead of rejecting the whole entry.
    signifier: z.enum(SIGNIFIERS).optional().catch(undefined),
  })
  .strip();

const exportEnvelopeSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  entryCount: z.number().optional(),
  entries: z.array(z.unknown()).max(10_000),
});

export function validateEntry(data: unknown): z.infer<typeof workLedgerEntrySchema> {
  return workLedgerEntrySchema.parse(data);
}

export function validateImportEnvelope(data: unknown): {
  version: 1;
  entries: unknown[];
} {
  return exportEnvelopeSchema.parse(data);
}
