import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lensaya?schema=public";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

const makeToken = (sub, role = "PHOTOGRAPHER") =>
  signAccessToken({
    sub,
    role,
    email: `${sub}@example.com`,
    username: sub,
  });

const withPrismaStubs = async (stubs, callback) => {
  const originals = [];

  for (const [path, fn] of Object.entries(stubs)) {
    const [model, method] = path.split(".");
    const target = prisma[model];
    originals.push({ target, method, original: target[method] });
    target[method] = fn;
  }

  try {
    await callback();
  } finally {
    for (const { target, method, original } of originals) {
      target[method] = original;
    }
  }
};

test("photographer A cannot update photographer B service", async () => {
  await withPrismaStubs(
    {
      "photographer.findUnique": async ({ where }) => {
        if (where.userId === "user-a") return { id: "photographer-a" };
        return null;
      },
      "service.findUnique": async ({ where }) => {
        if (where.id === "service-b") return { id: "service-b", photographerId: "photographer-b" };
        return null;
      },
      "service.update": async () => {
        throw new Error("update should not be called for cross-tenant access");
      },
    },
    async () => {
      const res = await request(app)
        .patch("/api/v1/services/service-b")
        .set("Authorization", `Bearer ${makeToken("user-a")}`)
        .send({ name: "Should fail" });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, "Access denied");
    }
  );
});

test("photographer can update own service", async () => {
  await withPrismaStubs(
    {
      "photographer.findUnique": async ({ where }) => {
        if (where.userId === "user-a") return { id: "photographer-a" };
        return null;
      },
      "service.findUnique": async ({ where }) => {
        if (where.id === "service-a") return { id: "service-a", photographerId: "photographer-a" };
        return null;
      },
      "service.update": async ({ where, data }) => ({
        id: where.id,
        photographerId: "photographer-a",
        name: data.name || "Original",
      }),
    },
    async () => {
      const res = await request(app)
        .patch("/api/v1/services/service-a")
        .set("Authorization", `Bearer ${makeToken("user-a")}`)
        .send({ name: "Updated name" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.error, null);
      assert.equal(res.body.data.service.id, "service-a");
      assert.equal(res.body.data.service.name, "Updated name");
    }
  );
});
