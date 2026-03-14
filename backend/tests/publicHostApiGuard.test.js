import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { app } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");

test("public hosts can still reach allowed public API routes", async () => {
  const res = await request(app)
    .post("/api/v1/public/client-errors")
    .set("Host", "www.raystudio.com")
    .send({
      type: "error",
      message: "Preview runtime issue",
      url: "https://www.raystudio.com/",
      timestamp: new Date().toISOString(),
    });

  assert.equal(res.status, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.accepted, true);
});

test("public hosts deny non-public workspace API routes", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .set("Host", "www.raystudio.com")
    .send({ email: "owner@example.com", password: "password123" });

  assert.equal(res.status, 421);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data.host, "www.raystudio.com");
  assert.equal(res.body.data.routeTarget, "app");
  assert.equal(res.body.data.redirectUrl, env.appUrl);
});

test("public hosts deny admin API routes with admin redirect hints", async () => {
  const res = await request(app)
    .get("/api/v1/admin/settings")
    .set("Host", `studio.${env.publicAppDomain}`);

  assert.equal(res.status, 421);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data.routeTarget, "admin");
  assert.equal(res.body.data.redirectUrl, env.adminAppUrl);
});

test("x-tenant-host preview headers do not block platform API routes", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .set("Host", `app.${env.publicAppDomain}`)
    .set("x-tenant-host", "www.raystudio.com")
    .send({});

  assert.notEqual(res.status, 421);
  assert.equal(res.body.success, false);
});
