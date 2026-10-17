import { Resend } from "resend";
import { site } from "@/lib/config";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

export type BookingEmailData = {
  ref: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  hours: string; // e.g. "8:00 AM – 9:00 AM, 9:00 AM – 10:00 AM"
  courtDisplay: string;
  totalPrice: number;
  discountApplied: number;
};

/**
 * Sends a confirmation email to the customer and an instant notification to the owner.
 * If RESEND_API_KEY is not configured, logs cleanly and returns false without crashing.
 */
export async function sendBookingNotifications(
  booking: BookingEmailData,
  ownerEmail: string = site.email
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(
      `[EMAIL NOTICE] RESEND_API_KEY not set in .env.local. Booking #${booking.ref.slice(0, 8)} recorded without email dispatch.`
    );
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  // From address: in Resend development mode without domain verification, use onboarding@resend.dev
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Grove District <onboarding@resend.dev>";

  try {
    // 1. Send receipt/confirmation to customer
    // Note: If domain is not yet verified on Resend, Resend will only allow sending to the account owner (admingrovesdistrict@gmail.com).
    const customerRes = await resend.emails.send({
      from: fromEmail,
      to: booking.email,
      subject: `Reservation Received #${booking.ref.slice(0, 8).toUpperCase()} — Grove District`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
          <div style="border-bottom: 2px solid #18181b; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #18181b;">
              Grove District
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.15em;">
              Pickleball · Café · Cebu
            </p>
          </div>

          <h2 style="font-size: 18px; margin: 0 0 8px 0; color: #18181b;">
            Reservation Pending Review
          </h2>
          <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 20px 0;">
            Hi ${booking.name}, thank you for booking a court at Grove District. Our team is verifying your payment receipt. Once verified, your slot is officially locked.
          </p>

          <div style="background-color: #f4f4f5; border-radius: 12px; padding: 18px; margin-bottom: 24px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #71717a;">Booking Ref:</span>
              <strong style="font-family: monospace;">#${booking.ref.slice(0, 8).toUpperCase()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #71717a;">Court:</span>
              <strong>${booking.courtDisplay}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #71717a;">Date:</span>
              <strong>${booking.date}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #71717a;">Time:</span>
              <strong>${booking.hours}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #e4e4e7; padding-top: 8px; margin-top: 8px;">
              <span style="color: #71717a;">Total Paid:</span>
              <strong style="font-size: 15px; color: #18181b;">₱${booking.totalPrice}</strong>
            </div>
          </div>

          <div style="background-color: #fafafa; border: 1px dashed #d4d4d8; border-radius: 12px; padding: 14px; margin-bottom: 18px; font-size: 12px; color: #52525b; line-height: 1.5;">
            <strong>Facility Reminders:</strong><br/>
            • <strong>Bring Your Own Paddle:</strong> Balls and nets are set up on all courts.<br/>
            • <strong>Footwear:</strong> Non-marking court shoes are strictly required.<br/>
            • <strong>Parking:</strong> Free on-site parking is available on a first-come, first-served basis.<br/>
            • <strong>Strict No-Cancellation Policy:</strong> All verified bookings are final.
          </div>

          <div style="background-color: #f4f4f5; border-radius: 12px; padding: 14px; margin-bottom: 24px; font-size: 12px; color: #3f3f46; line-height: 1.5; text-align: center;">
            <strong>After Your Game — Rate Your Experience ★</strong><br/>
            Once your scheduled court time finishes, share a quick 5-star review of our courts, hospitality, and café:<br/>
            <a href="${site.url}/survey?ref=${booking.ref.slice(0, 8).toUpperCase()}" style="display: inline-block; margin-top: 10px; background: #18181b; color: #ffffff; padding: 8px 18px; font-size: 11px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
              Rate Your Game (#${booking.ref.slice(0, 8).toUpperCase()}) →
            </a>
          </div>

          <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin: 24px 0 0 0;">
            Grove District · <a href="${site.mapsUrl}" style="color: #52525b; text-decoration: underline;">Get Directions on Google Maps ↗</a> · ${site.phone}
          </p>
        </div>
      `,
    });

    if (customerRes.error) {
      console.log("[resend] Customer email notice:", customerRes.error.message);
    }

    // 2. Alert owner (deliver to configured ownerEmail or fallback to admingrovesdistrict@gmail.com)
    const targetOwnerEmail = "admingrovesdistrict@gmail.com";
    await resend.emails.send({
      from: fromEmail,
      to: targetOwnerEmail,
      subject: `[NEW BOOKING] #${booking.ref.slice(0, 8).toUpperCase()} · ${booking.name} (₱${booking.totalPrice})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; max-width: 540px; border: 1px solid #e4e4e7; border-radius: 12px;">
          <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #18181b;">New Court Reservation Submitted</h2>
          <p style="font-size: 13px; color: #52525b; margin: 0 0 16px 0;">A player just submitted a booking and uploaded their payment screenshot for verification.</p>
          
          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 6px 0; color: #71717a;">Reference:</td><td style="padding: 6px 0; font-weight: 700;">#${booking.ref.slice(0, 8).toUpperCase()}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Player:</td><td style="padding: 6px 0; font-weight: 600;">${booking.name} (${booking.phone})</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Email:</td><td style="padding: 6px 0;">${booking.email}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Court:</td><td style="padding: 6px 0; font-weight: 600;">${booking.courtDisplay}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Schedule:</td><td style="padding: 6px 0;">${booking.date} at ${booking.hours}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">Amount:</td><td style="padding: 6px 0; font-weight: 700; color: #18181b;">₱${booking.totalPrice}</td></tr>
          </table>

          <a href="${site.url}/admin" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 20px; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 8px;">
            Open Owner Dashboard to Verify ↗
          </a>
        </div>
      `,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[resend] Email dispatch error:", err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sends a welcome email to the newly registered member's Gmail.
 */
export async function sendWelcomeMemberEmail(
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL NOTICE] RESEND_API_KEY not set. Welcome email for ${email} skipped.`);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "Grove District <onboarding@resend.dev>";

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Welcome to Grove District Member Club, ${name || "Player"}!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
          <div style="border-bottom: 2px solid #18181b; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #18181b;">
              Grove District
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.15em;">
              Pickleball · Café · Cebu
            </p>
          </div>

          <h2 style="font-size: 18px; margin: 0 0 12px 0; color: #18181b;">Welcome to the Club!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 16px 0;">
            Hi <strong>${name || "there"}</strong>, your Grove District Member Account is ready.
          </p>

          <div style="background: #f4f4f5; border-radius: 12px; padding: 18px; margin-bottom: 24px; font-size: 13px; border: 1px solid #e4e4e7;">
            <p style="margin: 0 0 8px 0; font-weight: 700; color: #18181b; font-size: 14px;">🏆 Your Member Loyalty Perk:</p>
            <p style="margin: 0; color: #52525b; line-height: 1.6;">
              Every 10 confirmed games you play unlocks <strong>50% off up to 2 courts / 2 hours on your 11th booking</strong> (repeats every 10 games). All your reservations are automatically tracked under your email <strong>${email}</strong>.
            </p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${site.url}/book" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
              Book a Court Now →
            </a>
          </div>

          <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin: 32px 0 0 0;">
            Grove District · <a href="${site.mapsUrl}" style="color: #52525b; text-decoration: underline;">Get Directions on Google Maps ↗</a> · ${site.phone}
          </p>
        </div>
      `,
    });

    if (res.error) {
      console.log("[resend] Welcome email notice:", res.error.message);
      return { success: false, error: res.error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[resend] Welcome email error:", err?.message || err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sends a password reset email via Resend to the member's Gmail.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log(`[resend] Password reset link for ${email}: ${resetLink}`);
    return { success: true };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "Grove District <onboarding@resend.dev>";

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "Reset Your Password — Grove District Member Account",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
          <div style="border-bottom: 2px solid #18181b; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #18181b;">
              Grove District
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.15em;">
              Pickleball · Café · Cebu
            </p>
          </div>

          <h2 style="font-size: 18px; margin: 0 0 12px 0; color: #18181b;">Reset Your Password</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 16px 0;">
            We received a request to reset the password for your Grove District account (<strong>${email}</strong>).
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
              Reset Password →
            </a>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #71717a; margin: 24px 0 0 0;">
            If you did not request this password reset, please ignore this email. Your password will remain unchanged.
          </p>

          <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin: 32px 0 0 0;">
            Grove District · Cebu City, Philippines · ${site.phone}
          </p>
        </div>
      `,
    });

    if (res.error) {
      console.log("[resend] Password reset notice:", res.error.message);
      return { success: false, error: res.error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[resend] Password reset error:", err?.message || err);
    return { success: false, error: err?.message };
  }
}
