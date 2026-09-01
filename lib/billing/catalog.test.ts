import { describe, expect, it } from "vitest";
import { isCustomerSku, skuCatalog, skuGrantsAccess } from "./catalog";
import { presentCustomerCatalog } from "./invoices";

describe("billing catalog", () => {
  it("prices workspace access for self-serve checkout", () => {
    expect(skuCatalog("app_access").unitAmountPaise).toBe(499_900);
    expect(skuCatalog("app_access").custom).toBe(false);
    expect(skuGrantsAccess("app_access")).toBe(true);
    expect(isCustomerSku("app_access")).toBe(true);
    expect(isCustomerSku("custom")).toBe(false);
  });

  it("shows GST-inclusive totals customers can pay", () => {
    const catalog = presentCustomerCatalog(18);
    const access = catalog.find((item) => item.sku === "app_access");
    expect(access?.totalPaise).toBe(589_882);
    expect(access?.grantAccess).toBe(true);
    expect(access?.recommended).toBe(true);
    expect(access?.blurb).toMatch(/recommended/i);
    expect(catalog.map((item) => item.sku)).toEqual([
      "app_access",
      "counselling",
      "virtual_session",
      "workshop",
      "full_day",
    ]);
  });
});
