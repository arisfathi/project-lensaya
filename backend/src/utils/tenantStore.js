import { AsyncLocalStorage } from "node:async_hooks";

const tenantStore = new AsyncLocalStorage();

export const runWithTenantContext = (tenant, callback) =>
  tenantStore.run(
    {
      tenant: tenant || null,
    },
    callback
  );

export const getTenantContext = () => tenantStore.getStore()?.tenant || null;
