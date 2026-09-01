import { Router, type Request } from "express";
import {
  DEFAULT_BILLING_SETTINGS,
  presentAccount,
  resolveAccess,
  type BillingSettings,
} from "../../lib/access/billing";
import { isCustomerSku } from "../../lib/billing/catalog";
import { presentCustomerCatalog, presentInvoice } from "../../lib/billing/invoices";
import { asyncHandler, HttpError } from "../middleware/errors";
import { requireAppSession, type AppRequest } from "../middleware/appAuth";
import { createCustomerPayment } from "../billing/checkout";
import type { AccountStore, AppSessionStore, BillingSettingsStore, InvoiceStore, RateLimiter } from "../stores/memory";
import type { RazorpayClient } from "../payments/razorpay";

export function requestOrigin(req: Request): string {
  const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"] : "";
  const proto = forwardedProto.split(",")[0]?.trim() || req.protocol || "http";
  const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) return "";
  const safeProto = proto === "https" ? "https" : "http";
  return `${safeProto}://${host}`;
}

function requireRazorpay(razorpay?: RazorpayClient) {
  if (!razorpay?.configured) {
    throw new HttpError(
      503,
      "unavailable",
      "Online payment is not set up yet. Try again later, or get in touch if this keeps happening.",
    );
  }
}

function requireSellerConfiguration(settings: BillingSettings) {
  if (process.env.NODE_ENV !== "production") return;
  if (!settings.legalName.trim() || !settings.address.trim() || !settings.gstin.trim()) {
    throw new HttpError(
      503,
      "seller_configuration_required",
      "Online checkout is unavailable until legal name, address, and GSTIN are configured",
    );
  }
}

export function createBillingRouter(deps: {
  accounts: AccountStore;
  sessions: AppSessionStore;
  billing: BillingSettingsStore;
  invoices: InvoiceStore;
  razorpay?: RazorpayClient;
  rateLimiter?: RateLimiter;
}): Router {
  const router = Router();
  const gate = requireAppSession(deps);

  router.get(
    "/catalog",
    asyncHandler(async (_req, res) => {
      const settings = await deps.billing.get();
      const gstRate = settings.gstRate ?? DEFAULT_BILLING_SETTINGS.gstRate;
      res.json({
        catalog: presentCustomerCatalog(gstRate),
        razorpayConfigured: Boolean(deps.razorpay?.configured),
      });
    }),
  );

  router.get(
    "/me",
    gate,
    asyncHandler(async (req: AppRequest, res) => {
      const settings = await deps.billing.get();
      const gstRate = settings.gstRate ?? DEFAULT_BILLING_SETTINGS.gstRate;
      const mine = (await deps.invoices.list()).filter((invoice) => invoice.accountId === req.accountId);
      res.json({
        account: presentAccount(req.account!),
        catalog: presentCustomerCatalog(gstRate),
        invoices: mine.map((invoice) => presentInvoice(invoice)),
        razorpayConfigured: Boolean(deps.razorpay?.configured),
      });
    }),
  );

  router.post(
    "/checkout",
    gate,
    asyncHandler(async (req: AppRequest, res) => {
      const account = req.account!;
      const skuRaw = typeof req.body?.sku === "string" ? req.body.sku : "app_access";
      if (!isCustomerSku(skuRaw)) {
        throw new HttpError(400, "invalid", "Choose a plan you can buy here");
      }
      if (skuRaw === "app_access" && resolveAccess(account).status === "paid") {
        throw new HttpError(409, "conflict", "You already have paid workspace access");
      }
      requireRazorpay(deps.razorpay);
      const settings = await deps.billing.get();
      requireSellerConfiguration(settings);
      const gstRate = settings.gstRate ?? DEFAULT_BILLING_SETTINGS.gstRate;
      const origin = requestOrigin(req);
      const { invoice, created } = await createCustomerPayment({
        sku: skuRaw,
        gstRate,
        customer: {
          accountId: account.id,
          name: account.name,
          email: account.email,
          phone: account.phone ?? null,
          organisation: account.organisation ?? null,
        },
        invoices: deps.invoices,
        razorpay: deps.razorpay,
        callbackUrl: origin ? `${origin}/app/billing?paid=1` : null,
        notes: "Self-serve checkout",
      });
      if (!invoice.paymentUrl) {
        throw new HttpError(502, "upstream", "A payment link could not be created. Try again in a moment.");
      }
      res.status(created ? 201 : 200).json({
        invoice: presentInvoice(invoice),
        paymentUrl: invoice.paymentUrl,
      });
    }),
  );

  router.post(
    "/guest-checkout",
    asyncHandler(async (req, res) => {
      if (deps.rateLimiter) {
        const allowed = await deps.rateLimiter.allow(`billing:${req.ip}`, 8, 10 * 60_000);
        if (!allowed) throw new HttpError(429, "rate_limited", "Too many payment attempts. Wait a few minutes.");
      }
      const skuRaw = typeof req.body?.sku === "string" ? req.body.sku : "";
      if (!isCustomerSku(skuRaw)) {
        throw new HttpError(400, "invalid", "Choose a plan you can buy here");
      }
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
      const organisation =
        typeof req.body?.organisation === "string" && req.body.organisation.trim()
          ? req.body.organisation.trim()
          : null;
      if (req.body?.checkoutLegalAccepted !== true) {
        throw new HttpError(
          400,
          "consent_required",
          "Accept the Terms and acknowledge the Privacy Notice before checkout",
        );
      }
      if (req.body?.adultConfirmed !== true) {
        throw new HttpError(400, "adult_required", "Checkout is for adults aged 18 or older");
      }
      if (name.length < 2) throw new HttpError(400, "invalid", "Name is required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "invalid", "Email is invalid");
      if (phone.length < 8) throw new HttpError(400, "invalid", "Phone is required");
      requireRazorpay(deps.razorpay);
      const existingAccount = await deps.accounts.getByEmail(email);
      if (skuRaw === "app_access" && !existingAccount) {
        throw new HttpError(
          401,
          "unauthorized",
          "Create a workspace login with this email first, then pay for 12 months of access.",
        );
      }
      const settings = await deps.billing.get();
      requireSellerConfiguration(settings);
      const gstRate = settings.gstRate ?? DEFAULT_BILLING_SETTINGS.gstRate;
      const origin = requestOrigin(req);
      const { invoice, created } = await createCustomerPayment({
        sku: skuRaw,
        gstRate,
        customer: {
          accountId: existingAccount?.id ?? null,
          name,
          email,
          phone,
          organisation: organisation || existingAccount?.organisation || null,
        },
        invoices: deps.invoices,
        razorpay: deps.razorpay,
        callbackUrl: origin ? `${origin}/?offer=${skuRaw === "app_access" ? "workspace" : skuRaw}&paid=1` : null,
        notes: "Landing checkout",
      });
      if (!invoice.paymentUrl) {
        throw new HttpError(502, "upstream", "A payment link could not be created. Try again in a moment.");
      }
      res.status(created ? 201 : 200).json({
        invoice: presentInvoice(invoice),
        paymentUrl: invoice.paymentUrl,
      });
    }),
  );

  return router;
}
