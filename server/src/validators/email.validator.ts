import { z } from 'zod';

export const emailSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  senderId: z.string().min(1),
  scheduledAt: z.string().datetime({ offset: true }),
});

export const emailValidator = {
  validate(value: unknown) {
    return emailSchema.safeParse(value);
  },
};
