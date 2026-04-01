import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const { adminService } = await import("../src/services/adminService.js");
const { prisma } = await import("../src/config/prisma.js");

const withPrismaPatches = async (patches, callback) => {
  const originals = patches.map((patch) => ({
    target: patch.target,
    method: patch.method,
    original: patch.target[patch.method],
  }));

  for (const patch of patches) {
    patch.target[patch.method] = patch.fn;
  }

  try {
    await callback();
  } finally {
    for (const original of originals) {
      original.target[original.method] = original.original;
    }
  }
};

test("setPhotographerStatus side effects: active", async () => {
  const calls = { update: null, create: null };
  const fakeUser = { id: "u1", status: "ACTIVE" };

  await withPrismaPatches(
    [
      {
        target: prisma.user,
        method: "update",
        fn: async (args) => {
          calls.update = args;
          return fakeUser;
        },
      },
      {
        target: prisma.notification,
        method: "create",
        fn: async (args) => {
          calls.create = args;
          return { id: "n1" };
        },
      },
    ],
    async () => {
      const result = await adminService.setPhotographerStatus("u1", "active");

      assert.deepEqual(calls.update, { where: { id: "u1" }, data: { status: "ACTIVE" } });
      assert.deepEqual(calls.create, {
        data: {
          userId: "u1",
          type: "ADMIN",
          title: "Account reactivated",
          body: "Your account access has been restored by the admin team.",
          actionUrl: "/dashboard/settings",
        },
      });
      assert.deepEqual(result, { id: "u1", status: "active" });
    }
  );
});

test("setPhotographerStatus side effects: suspended", async () => {
  const calls = { update: null, create: null };
  const fakeUser = { id: "u2", status: "SUSPENDED" };

  await withPrismaPatches(
    [
      {
        target: prisma.user,
        method: "update",
        fn: async (args) => {
          calls.update = args;
          return fakeUser;
        },
      },
      {
        target: prisma.notification,
        method: "create",
        fn: async (args) => {
          calls.create = args;
          return { id: "n2" };
        },
      },
    ],
    async () => {
      const result = await adminService.setPhotographerStatus("u2", "suspended");

      assert.deepEqual(calls.update, { where: { id: "u2" }, data: { status: "SUSPENDED" } });
      assert.deepEqual(calls.create, {
        data: {
          userId: "u2",
          type: "ADMIN",
          title: "Account suspended",
          body: "Your account has been suspended by the admin team.",
          actionUrl: "/dashboard/settings",
        },
      });
      assert.deepEqual(result, { id: "u2", status: "suspended" });
    }
  );
});