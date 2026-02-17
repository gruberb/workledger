import { z } from "zod";

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
    signifier: z.enum(["note", "decision", "task", "question", "idea"]).optional(),
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
