import { z } from 'zod';

const bookingCreateSchema = z.object({
  serviceId: z.string().min(1),
  barberId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().or(z.literal(""))
});
const tokenSchema = z.object({ token: z.string().min(8) });
const rescheduleSchema = tokenSchema.extend({
  serviceId: z.string().min(1),
  barberId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/)
});
const adminCancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().trim().max(500).optional()
});

export { adminCancelBookingSchema as a, bookingCreateSchema as b, rescheduleSchema as r, tokenSchema as t };
