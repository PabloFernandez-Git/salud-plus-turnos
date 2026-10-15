import { assert } from "./fixture-core.mjs";

// Exact UUIDs from the human-captured read-only DEV inventory of this run.
export const knownRecovery = {
  runId: "c9818e40-2d4d-4c1b-a392-14a9404a5111",
  projectRef: "ehllxymqyzrofydrvtzo",
  ids: {
    centerA: "8677b5f1-9c45-4501-8bd3-3561c6cf8b64",
    centerB: "67109b95-4646-41e1-b2fc-b647fcc5e2d4",
    centerInactive: "f9bcf017-7a46-4fc1-b084-9cbe3e301fe6",
    membershipAdminA: "102a98db-6602-4235-a142-06c668b8c87d",
    membershipReceptionA: "910d65c0-6e2a-422f-9949-62312eba141d",
    membershipAdminB: "36a5addf-5aa2-4420-86e9-996a5fd2de54",
    membershipProfessionalA: "b00731b6-7ca8-4185-9cc2-d8be7cd1cf6a",
    membershipInactiveA: "e7676035-a718-49b8-9651-6ddec41b30ae",
    membershipInactiveCenter: "cb491457-8df3-464d-abb2-7da26d938e85",
    professional: "2add6a73-d844-40b9-861a-f676f18880ca",
    professionalCenter: "ed0a58f4-2e73-456c-9a73-8fd02bd40817",
    privacyPerson: "174131aa-9957-4f27-b3a8-6954ce8a45df",
    privacyPatientA: "7da6386b-2995-4ed7-a1b1-2f8427fae779",
    unlinkedPerson: "07071d36-9fd4-4b24-8b12-02d97c9f880b",
    manualUnlinkedPerson: "08c6a9b7-5352-41a7-bd8b-e3d158783e7e",
    racePerson: "473aa243-550d-4e97-a50e-fdf0baf85e66",
    racePatientA: "7ea0ca6b-f9e1-4e34-8815-81abf54e7f68",
    privacyPatientB: "878b1c7f-2aea-4f9d-9f7a-f2abde2ceb33",
    createRacePerson: "66cf5d00-14ad-4aa7-bf33-aa71960e52ef",
    createRacePatientA: "55de2b8a-1b3d-4b4d-b86a-cbc0c9abed94",
    createLinkRacePerson: "962bdcab-9ce4-48b8-b85f-8d4004068cd7",
    createLinkRacePatientA: "05bfe514-2ee4-4fd2-84da-8255f921d614",
    linkRacePerson: "3edadb2e-3cdf-4b8b-9b9b-4751671f1fd5",
    linkRacePatientA: "51bb2a69-fc3a-4415-a4ef-85197f204079",
  },
  actorIds: {
    adminA: "f56d7d69-e649-4c1c-b6de-bce8fb4b7859",
    receptionA: "033f11ce-5f57-4006-b304-8f18c6713f7e",
    adminB: "857a02fe-35df-49f8-8a00-05384d3295f1",
    professionalA: "378a059d-0131-4ee4-a7f7-2056fe78ae56",
    inactiveA: "15479b04-cfe2-4c6d-a2b6-f675827afb86",
    platformOnly: "b6a05d22-8791-4889-a5a6-0e81e17faa25",
  },
};

export function expectedOwned() {
  const { ids, actorIds } = knownRecovery;
  return {
    authUsers: Object.values(actorIds),
    publicUsers: Object.values(actorIds),
    centers: [ids.centerA, ids.centerB, ids.centerInactive],
    memberships: [
      ids.membershipAdminA,
      ids.membershipReceptionA,
      ids.membershipAdminB,
      ids.membershipProfessionalA,
      ids.membershipInactiveA,
      ids.membershipInactiveCenter,
    ],
    professionals: [ids.professional],
    professionalCenters: [ids.professionalCenter],
    platformAdmins: [actorIds.platformOnly],
    persons: [
      ids.privacyPerson,
      ids.unlinkedPerson,
      ids.manualUnlinkedPerson,
      ids.racePerson,
      ids.createRacePerson,
      ids.createLinkRacePerson,
      ids.linkRacePerson,
    ],
    patientCenters: [
      ids.privacyPatientA,
      ids.racePatientA,
      ids.privacyPatientB,
      ids.createRacePatientA,
      ids.createLinkRacePatientA,
      ids.linkRacePatientA,
    ],
  };
}

function same(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} differs; STOP recovery`);
}

function exactRows(actual, expected, label) {
  assert(actual.length === expected.length, `${label} row count differs; STOP recovery`);
  const byId = (rows) =>
    [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  same(byId(actual), byId(expected), label);
}

export function verifyRecoverySnapshot(snapshot) {
  const { ids, actorIds, runId, projectRef } = knownRecovery;
  same(snapshot.projectRef, projectRef, "Project");
  same(snapshot.runId, runId, "Run ID");
  same(snapshot.scope.centerA, ids.centerA, "Center A scope");
  same(snapshot.scope.centerB, ids.centerB, "Center B scope");
  same(
    snapshot.counts,
    {
      "auth.users": 7,
      "public.users": 7,
      "public.centers": 4,
      "public.center_memberships": 7,
      "public.persons": 7,
      "public.patient_centers": 6,
      "public.professionals": 1,
      "public.professional_centers": 1,
      "public.platform_admins": 2,
      "public.appointments": 0,
    },
    "Global counts",
  );
  const actorNames = {
    adminA: "admina",
    receptionA: "receptiona",
    adminB: "adminb",
    professionalA: "professionala",
    inactiveA: "inactivea",
    platformOnly: "platformonly",
  };
  const actors = Object.fromEntries(
    Object.entries(actorNames).map(([name, suffix]) => [
      name,
      { id: actorIds[name], email: `task007d-${runId}-${suffix}@example.test` },
    ]),
  );
  exactRows(snapshot.authUsers, Object.values(actors), "Auth actors");
  exactRows(snapshot.publicUsers, Object.values(actors), "Public actors");
  same(
    snapshot.scope.actorEmails,
    Object.values(actors).map((actor) => actor.email),
    "Email scope",
  );
  exactRows(
    snapshot.centers,
    [
      { id: ids.centerA, name: `TASK-007D A ${runId}`, is_active: true },
      { id: ids.centerB, name: `TASK-007D B ${runId}`, is_active: true },
      { id: ids.centerInactive, name: `TASK-007D inactive ${runId}`, is_active: false },
    ],
    "Centers",
  );
  exactRows(
    snapshot.memberships,
    [
      [ids.membershipAdminA, ids.centerA, actorIds.adminA, "ADMIN", null, true],
      [ids.membershipReceptionA, ids.centerA, actorIds.receptionA, "RECEPTION", null, true],
      [ids.membershipAdminB, ids.centerB, actorIds.adminB, "ADMIN", null, true],
      [
        ids.membershipProfessionalA,
        ids.centerA,
        actorIds.professionalA,
        "PROFESSIONAL",
        ids.professionalCenter,
        true,
      ],
      [ids.membershipInactiveA, ids.centerA, actorIds.inactiveA, "RECEPTION", null, false],
      [ids.membershipInactiveCenter, ids.centerInactive, actorIds.adminA, "ADMIN", null, true],
    ].map(([id, center_id, user_id, role, professional_center_id, is_active]) => ({
      id,
      center_id,
      user_id,
      role,
      professional_center_id,
      is_active,
    })),
    "Memberships",
  );
  exactRows(
    snapshot.professionals,
    [
      {
        id: ids.professional,
        nationality_code: "AR",
        document_number: `P-${runId}`,
        email: `professional-${runId}@example.test`,
      },
    ],
    "Professional",
  );
  exactRows(
    snapshot.professionalCenters,
    [{ id: ids.professionalCenter, professional_id: ids.professional, center_id: ids.centerA }],
    "ProfessionalCenter",
  );
  exactRows(snapshot.platformAdmins, [{ user_id: actorIds.platformOnly }], "Platform Admin");
  const personCases = [
    [ids.privacyPerson, "Private", "Fixture", "PRIV"],
    [ids.unlinkedPerson, "Unlinked", "Fixture", "UNLINK"],
    [ids.manualUnlinkedPerson, "Manual", "Fixture", "MANUAL-LINK"],
    [ids.racePerson, "Race", "Fixture", "RACE"],
    [ids.createRacePerson, "Integration", "Fixture", "CREATE-RACE"],
    [ids.createLinkRacePerson, "Integration", "Fixture", "CREATE-LINK-RACE"],
    [ids.linkRacePerson, "Race", "Link", "LINK-RACE"],
  ];
  exactRows(
    snapshot.persons,
    personCases.map(([id, first_name, last_name, prefix]) => ({
      id,
      first_name,
      last_name,
      birth_date: "1990-01-01",
      nationality_code: "AR",
      document_number: `${prefix}-${runId}`,
    })),
    "Persons",
  );
  same(
    snapshot.scope.documents,
    [
      "PRIV",
      "UNLINK",
      "MANUAL-LINK",
      "RACE",
      "CREATE-RACE",
      "CREATE-LINK-RACE",
      "LINK-RACE",
      "UI",
      "SMOKE",
    ].map((prefix) => `${prefix}-${runId}`),
    "Document scope",
  );
  const pc = (
    id,
    person_id,
    center_id,
    phone,
    email,
    insurance_name,
    administrative_notes,
    is_active,
  ) => ({
    id,
    person_id,
    center_id,
    phone,
    email,
    insurance_name,
    administrative_notes,
    is_active,
  });
  exactRows(
    snapshot.patientCenters,
    [
      pc(
        ids.privacyPatientA,
        ids.privacyPerson,
        ids.centerA,
        "A-111",
        "a-private@example.test",
        "A coverage",
        "A-only notes",
        true,
      ),
      pc(
        ids.racePatientA,
        ids.racePerson,
        ids.centerA,
        "R-222",
        "changed@example.test",
        "Changed coverage",
        "Changed notes",
        false,
      ),
      pc(
        ids.privacyPatientB,
        ids.privacyPerson,
        ids.centerB,
        "B-555",
        "b-test@example.test",
        "B insurance",
        "B notes",
        true,
      ),
      pc(
        ids.createRacePatientA,
        ids.createRacePerson,
        ids.centerA,
        "A-555",
        "a-test@example.test",
        "A insurance",
        "A notes",
        true,
      ),
      pc(
        ids.createLinkRacePatientA,
        ids.createLinkRacePerson,
        ids.centerA,
        "A-555",
        "a-test@example.test",
        "A insurance",
        "A notes",
        true,
      ),
      pc(
        ids.linkRacePatientA,
        ids.linkRacePerson,
        ids.centerA,
        "B-555",
        "b-test@example.test",
        "B insurance",
        "B notes",
        true,
      ),
    ],
    "PatientCenters",
  );
  same(
    snapshot.references,
    {
      "public.appointments.center_id": 0,
      "public.appointments.patient_center_id": 0,
      "public.specialties.center_id": 0,
      "public.availabilities.center_id": 0,
      "public.professional_center_specialties.center_id": 0,
    },
    "External references",
  );
  return actors;
}
