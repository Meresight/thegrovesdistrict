import { z } from "zod";
import { COURT_IDS, booking, skillLevels } from "./config";

const name = z.string().trim().min(2, "Please enter your name").max(80);
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(120);
const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, "Enter a valid phone number");

/** Hidden field real users never fill; bots usually do. */
const honeypot = z.string().max(0).optional();

export const bookingSchema = z.object({
  bookingType: z.enum(["single", "event_buyout"]).default("single"),
  eventTypeId: z.string().trim().max(80).optional(),
  courtId: z.enum(COURT_IDS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.array(z.number().int().min(0).max(25)).min(1),
  /** Exact court+hour picks (single-court mode can mix courts). Falls back to courtId + hours. */
  slots: z
    .array(z.object({ courtId: z.enum(COURT_IDS), hour: z.number().int().min(0).max(25) }))
    .max(40)
    .optional(),
  name,
  email,
  phone,
  players: z.number().int().min(1).default(4).optional(),
  notes: z.string().trim().max(300).optional(),
  receiptUrl: z.string().trim().optional().or(z.literal("")),
  waiverAgreed: z.boolean().default(true),
  website: honeypot,
});

export const joinSchema = z.object({
  name,
  email,
  phone: phone.optional().or(z.literal("")),
  level: z.enum(skillLevels),
  message: z.string().trim().max(500).optional(),
  website: honeypot,
});

export const contactSchema = z.object({
  name,
  email,
  message: z.string().trim().min(5, "Tell us a little more").max(1000),
  website: honeypot,
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type JoinInput = z.infer<typeof joinSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
