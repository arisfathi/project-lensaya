import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { emailService } from "./emailService.js";

const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (amount, currency = "USD") => {
  const numericAmount = Number(amount || 0);
  const normalizedCurrency = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
  } catch {
    return `${Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : "0.00"} ${normalizedCurrency}`;
  }
};

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const buildReceiptNumber = (transactionId, createdAt) => {
  const shortId = String(transactionId || "").replace(/-/g, "").slice(0, 10).toUpperCase();
  const date = createdAt instanceof Date ? createdAt : new Date(String(createdAt || ""));
  const stamp = Number.isNaN(date.getTime())
    ? "UNKNOWN"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `LSY-${stamp}-${shortId || "TX"}`;
};

export const billingReceiptService = {
  async sendReceiptForTransaction(transactionId) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
        provider: true,
        providerTransactionId: true,
        processedAt: true,
        createdAt: true,
        metadata: true,
        subscription: {
          select: {
            plan: true,
            billingInterval: true,
          },
        },
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!transaction) {
      return { skipped: true, reason: "transaction_not_found" };
    }

    if (String(transaction.status || "").toUpperCase() !== "SUCCEEDED") {
      return { skipped: true, reason: "transaction_not_succeeded" };
    }

    const userEmail = String(transaction.user?.email || "").trim();
    if (!userEmail) {
      return { skipped: true, reason: "user_email_missing" };
    }

    const metadata = isPlainObject(transaction.metadata) ? transaction.metadata : {};
    const existingReceipt = isPlainObject(metadata.lensayaReceipt) ? metadata.lensayaReceipt : null;
    if (existingReceipt?.sentAt) {
      return { skipped: true, reason: "already_sent" };
    }

    const receiptNumber = String(existingReceipt?.number || "").trim() || buildReceiptNumber(transaction.id, transaction.createdAt);
    const fullName = String(transaction.user?.fullName || "").trim();
    const greeting = fullName ? `Hi ${escapeHtml(fullName)},` : "Hi,";
    const amount = formatMoney((transaction.amountCents || 0) / 100, transaction.currency);
    const processedAt = transaction.processedAt || transaction.createdAt;
    const plan = String(transaction.subscription?.plan || "").toUpperCase() || "N/A";
    const interval = String(transaction.subscription?.billingInterval || "").toUpperCase();
    const intervalLabel = interval === "YEARLY" ? "Yearly" : interval === "MONTHLY" ? "Monthly" : "N/A";
    const provider = String(transaction.provider || "").toUpperCase() || "PROVIDER";
    const providerReference = String(transaction.providerTransactionId || transaction.id || "").trim();

    const subject = `Your Lensaya receipt (${receiptNumber})`;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.5;">
        <p>${greeting}</p>
        <p>Thanks for your payment. Here is your receipt.</p>
        <h2 style="margin: 18px 0 8px; font-size: 16px;">Receipt</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
          <tr><td style="padding: 6px 0; color: #475569;">Receipt #</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(receiptNumber)}</td></tr>
          <tr><td style="padding: 6px 0; color: #475569;">Date</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(formatDateTime(processedAt))}</td></tr>
          <tr><td style="padding: 6px 0; color: #475569;">Amount</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(amount)}</td></tr>
          <tr><td style="padding: 6px 0; color: #475569;">Plan</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(plan)} (${escapeHtml(intervalLabel)})</td></tr>
          <tr><td style="padding: 6px 0; color: #475569;">Provider</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(provider)}</td></tr>
          <tr><td style="padding: 6px 0; color: #475569;">Reference</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(providerReference)}</td></tr>
        </table>
        <p style="margin-top: 16px; color: #64748b; font-size: 12px;">
          This is an automated receipt for your Lensaya subscription payment.
        </p>
      </div>
    `;
    const text = [
      fullName ? `Hi ${fullName},` : "Hi,",
      "",
      "Thanks for your payment. Here is your receipt.",
      "",
      `Receipt #: ${receiptNumber}`,
      `Date: ${formatDateTime(processedAt)}`,
      `Amount: ${amount}`,
      `Plan: ${plan} (${intervalLabel})`,
      `Provider: ${provider}`,
      `Reference: ${providerReference}`,
      "",
      "This is an automated receipt for your Lensaya subscription payment.",
    ].join("\n");

    const result = await emailService.send({
      to: userEmail,
      subject,
      html,
      text,
    });

    const sentAt = new Date().toISOString();
    const nextMetadata = {
      ...metadata,
      lensayaReceipt: {
        ...(existingReceipt || {}),
        number: receiptNumber,
        sentAt,
        email: userEmail,
        amount,
        currency: String(transaction.currency || "USD").toUpperCase(),
      },
    };

    try {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { metadata: nextMetadata },
      });
    } catch (error) {
      logger.warn(
        { err: error, transactionId: transaction.id },
        "Receipt email sent but failed to persist receipt metadata"
      );
    }

    return { sent: true, receiptNumber, result };
  },
};

