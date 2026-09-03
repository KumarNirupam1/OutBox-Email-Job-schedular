import { z } from 'zod';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB total

export const emailSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  senderId: z.string().min(1),
  scheduledAt: z.string().datetime({ offset: true }),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        type: z.string().optional(),
        size: z.number().int().nonnegative().optional(),
        base64: z.string().optional(),
      }),
    )
    .max(20)
    .optional()
    .refine((arr) => !arr || arr.length === 0 || arr.every((a) => a.name), {
      message: 'Each attachment must have a name',
    }),
});

export const emailValidator = {
  validate(value: unknown) {
    return emailSchema.safeParse(value);
  },
};

export function validateAttachmentsSize(attachments?: Array<{ size?: number }>) {
  if (!attachments || attachments.length === 0) return true;
  const total = attachments.reduce((sum, a) => sum + (a.size ?? 0), 0);
  return total <= MAX_ATTACHMENT_BYTES;
}
