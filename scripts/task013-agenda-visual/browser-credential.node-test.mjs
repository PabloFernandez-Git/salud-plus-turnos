import assert from "node:assert/strict";
import { test } from "node:test";
import { serveOneCredential } from "./browser-credential.mjs";

test("one loopback credential reaches one child without appearing in a response", async () => {
  const received = [];
  let finishChild;
  const bridge = await serveOneCredential({
    onPassword(password) {
      received.push(password);
      return new Promise((resolveChild) => {
        finishChild = resolveChild;
      });
    },
  });
  const page = await fetch(bridge.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Contraseña PostgreSQL DEV/);
  const origin = new URL(bridge.url).origin;
  const posted = await fetch(bridge.url, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: "simulated-private-password" }),
  });
  assert.equal(posted.status, 202);
  assert.doesNotMatch(await posted.text(), /simulated-private-password/);
  const repeated = await fetch(bridge.url, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: "second-attempt" }),
  });
  assert.equal(repeated.status, 403);
  finishChild(0);
  assert.equal(await bridge.wait(), 0);
  assert.deepEqual(received, ["simulated-private-password"]);
});
