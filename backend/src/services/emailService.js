import { Resend } from "resend";
import { env } from "../config/env.js";

const client = env.resend.apiKey ? new Resend(env.resend.apiKey) : null;

export const emailService = {
  async send({ to, subject, html, text }) {
    if (!client) {
      return { skipped: true, reason: "RESEND_API_KEY not configured" };
    }

    const result = await client.emails.send({
      from: env.resend.fromEmail,
      to,
      subject,
      html,
      text,
    });

    return result;
  },

  async sendWelcome(email, fullName) {
    return this.send({
      to: email,
      subject: "Welcome to Lensaya",
      html: `<p>Hi ${fullName}, welcome to Lensaya.</p>`,
      text: `Hi ${fullName}, welcome to Lensaya.`,
    });
  },

  async sendPasswordReset(email, token) {
    const baseUrl = String(env.appUrl || env.publicAppUrl || env.frontendUrl || "").replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error("APP_URL is not configured for password reset emails");
    }
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    return this.send({
      to: email,
      subject: "Password reset request",
      html: `
        <p>We received a request to reset your Lensaya password.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>If the button does not work, use this token: <b>${token}</b></p>
      `,
      text: `Reset your password: ${resetUrl}\n\nIf needed, your token is: ${token}`,
    });
  },

  async sendBookingNotification(email, summary) {
    return this.send({
      to: email,
      subject: "New booking inquiry",
      html: `<pre>${summary}</pre>`,
      text: summary,
    });
  },
};
