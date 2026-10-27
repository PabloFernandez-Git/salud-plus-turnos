import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("availability detail route is registered and enforces authentication", async ({ request }) => {
  const centerId = randomUUID();
  const professionalCenterId = randomUUID();
  const response = await request.get(
    `/centers/${centerId}/professionals/${professionalCenterId}/availability`,
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/login");
});
