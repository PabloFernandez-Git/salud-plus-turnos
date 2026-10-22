import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const projection = [
  "appointment_id",
  "starts_at",
  "ends_at",
  "status",
  "professional_first_name",
  "professional_last_name",
  "specialty_name",
  "has_more",
].sort();

function transport(dev, key) {
  return createClient(dev.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function page(client, center, patient, section, asOf, limit, cursor = null) {
  const { data, error } = await client.rpc("staff_list_patient_appointments", {
    p_center_id: center,
    p_patient_center_id: patient,
    p_section: section,
    p_as_of: asOf,
    p_cursor_starts_at: cursor?.starts_at ?? null,
    p_cursor_id: cursor?.appointment_id ?? null,
    p_limit: limit,
  });
  return { data, error };
}

export function expectedIds(plan, center, patient, section) {
  const asOf = Date.parse(plan.createdAt);
  return plan.appointments
    .filter(
      (row) =>
        row.center === center &&
        row.patient === patient &&
        (section === "UPCOMING"
          ? Date.parse(row.startsAt) >= asOf && ["PENDING", "CONFIRMED"].includes(row.status)
          : Date.parse(row.startsAt) < asOf || !["PENDING", "CONFIRMED"].includes(row.status)),
    )
    .sort((a, b) => {
      const order = a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
      return section === "UPCOMING" ? order : -order;
    })
    .map((row) => row.id);
}

export async function runRpcChecks(dev, plan, password, record) {
  const i = plan.ids;
  const signed = {};
  for (const [name, actor] of Object.entries(plan.actors)) {
    const client = transport(dev, dev.publishableKey);
    const login = await client.auth.signInWithPassword({ email: actor.email, password });
    assert.equal(login.error, null, `${name} login failed`);
    assert.equal(login.data.user?.id, actor.id);
    signed[name] = client;
  }
  const admin = signed.adminA;
  const asOf = plan.createdAt;
  for (const name of ["adminA", "receptionA"]) {
    for (const section of ["UPCOMING", "HISTORY"]) {
      const expected = expectedIds(plan, "centerA", "patientA", section);
      const actual = [];
      let cursor = null;
      do {
        const response = await page(signed[name], i.centerA, i.patientA, section, asOf, 2, cursor);
        assert.equal(response.error, null, `${name} ${section} RPC failed`);
        assert(response.data.length <= 2);
        const shouldHaveMore = actual.length + response.data.length < expected.length;
        for (const row of response.data) {
          assert.deepEqual(Object.keys(row).sort(), projection);
          const planned = plan.appointments.find((item) => item.id === row.appointment_id);
          assert(planned, "RPC returned an appointment outside this fixture plan");
          assert.equal(new Date(row.starts_at).toISOString(), planned.startsAt);
          assert.equal(
            new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime(),
            30 * 60_000,
          );
          assert.equal(row.status, planned.status);
          assert.equal(row.has_more, shouldHaveMore);
          assert.equal(row.professional_first_name, "Task022");
          assert.equal(row.professional_last_name, "Professional A");
          assert.equal(row.specialty_name, `TASK-022 Specialty A ${plan.runId}`);
          actual.push(row.appointment_id);
        }
        cursor = response.data.at(-1) ?? null;
        if (!cursor?.has_more) break;
      } while (actual.length <= fixtureMaximum);
      assert.deepEqual(actual, expected, `${name} ${section} keyset differs`);
      record(`${name} ${section} cursor and projection PASS (${actual.length})`);
    }
  }
  const empty = await page(admin, i.centerA, i.patientEmpty, "HISTORY", asOf, 20);
  assert.equal(empty.error, null);
  assert.deepEqual(empty.data, []);
  const foreign = await page(admin, i.centerA, i.patientB, "HISTORY", asOf, 20);
  assert.equal(foreign.error, null);
  assert.deepEqual(foreign.data, []);
  const nonexistent = await page(
    admin,
    i.centerA,
    "00000000-0000-4000-8000-000000000000",
    "HISTORY",
    asOf,
    20,
  );
  assert.equal(nonexistent.error, null);
  assert.deepEqual(nonexistent.data, []);
  record("empty and foreign PatientCenter indistinguishable PASS");
  const ownB = await page(signed.adminB, i.centerB, i.patientB, "UPCOMING", asOf, 20);
  assert.equal(ownB.error, null);
  assert.deepEqual(
    ownB.data.map((row) => row.appointment_id),
    expectedIds(plan, "centerB", "patientB", "UPCOMING"),
  );
  for (const name of ["professionalA", "unlinked", "adminB"]) {
    const denied = await page(signed[name], i.centerA, i.patientA, "HISTORY", asOf, 20);
    assert.equal(denied.error?.code, "42501", `${name} was not denied`);
  }
  const anon = await page(
    transport(dev, dev.publishableKey),
    i.centerA,
    i.patientA,
    "HISTORY",
    asOf,
    20,
  );
  assert.equal(anon.error?.code, "42501");
  const direct = await admin.from("appointments").select("id").limit(1);
  assert.equal(
    direct.error?.code,
    "42501",
    "Authenticated direct appointments SELECT became available",
  );
  record("ADMIN/RECEPTION allowed; PROFESSIONAL/unlinked/other-center/anon denied PASS");
  const knownAppointment = plan.appointments.find((row) => row.label === "pending-future");
  const detail = await admin.rpc("staff_get_appointment", {
    p_center_id: i.centerA,
    p_appointment_id: knownAppointment.id,
  });
  assert.equal(detail.error, null);
  assert.equal(detail.data?.[0]?.appointment_id, knownAppointment.id);
  const detailDenied = await signed.adminB.rpc("staff_get_appointment", {
    p_center_id: i.centerA,
    p_appointment_id: knownAppointment.id,
  });
  assert.equal(detailDenied.error?.code, "42501");
  record("authorized detail RPC and cross-center denial PASS");
  for (const client of Object.values(signed)) await client.auth.signOut();
}

const fixtureMaximum = 30;
