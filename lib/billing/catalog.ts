import { PRICING } from "../landing/content";

export const INVOICE_SKUS = [
  {
    sku: "virtual_session",
    label: PRICING.virtualSession.label,
    unitAmountPaise: PRICING.virtualSession.inr * 100,
    custom: false,
  },
  {
    sku: "workshop",
    label: PRICING.workshop.label,
    unitAmountPaise: PRICING.workshop.inr * 100,
    custom: false,
  },
  {
    sku: "full_day",
    label: PRICING.fullDay.label,
    unitAmountPaise: PRICING.fullDay.inr * 100,
    custom: false,
  },
  {
    sku: "counselling",
    label: PRICING.counselling.label,
    unitAmountPaise: PRICING.counselling.inr * 100,
    custom: false,
  },
  {
    sku: "custom_design",
    label: PRICING.customDesignMin.label,
    unitAmountPaise: PRICING.customDesignMin.inr * 100,
    custom: true,
  },
  {
    sku: "app_access",
    label: "App access",
    unitAmountPaise: 0,
    custom: true,
  },
  {
    sku: "custom",
    label: "Custom line",
    unitAmountPaise: 0,
    custom: true,
  },
] as const;

export type InvoiceSku = (typeof INVOICE_SKUS)[number]["sku"];

const SKU_SET = new Set(INVOICE_SKUS.map((item) => item.sku));

export function isInvoiceSku(value: string): value is InvoiceSku {
  return SKU_SET.has(value as InvoiceSku);
}

export function skuCatalog(sku: InvoiceSku) {
  return INVOICE_SKUS.find((item) => item.sku === sku)!;
}
