import { markAppointmentOwned } from "./ledger.mjs";

export async function reconcilePendingAppointmentIntents(client, ledger) {
  const pending = Object.entries(ledger.appointmentIntents).filter(
    ([intentId]) => !Object.hasOwn(ledger.appointmentIdsByIntent, intentId),
  );
  let recovered = 0;
  for (const [intentId, context] of pending) {
    const siblings = pending.filter(([, other]) =>
      [
        "centerId",
        "patientCenterId",
        "professionalCenterId",
        "specialtyId",
        "localDate",
        "localTime",
      ].every((key) => other[key] === context[key]),
    );
    const rows = await client.query(
      "select a.id from public.appointments a join public.centers c on c.id=a.center_id where a.center_id=$1 and a.patient_center_id=$2 and a.professional_center_id=$3 and a.specialty_id=$4 and (a.starts_at at time zone c.timezone)::date=$5::date and to_char(a.starts_at at time zone c.timezone,'HH24:MI')=$6 order by a.id",
      [
        context.centerId,
        context.patientCenterId,
        context.professionalCenterId,
        context.specialtyId,
        context.localDate,
        context.localTime,
      ],
    );
    const unowned = rows.rows
      .map((row) => row.id)
      .filter((id) => !ledger.owned.appointments.includes(id));
    if (unowned.length > 1 || (unowned.length === 1 && siblings.length > 1)) {
      throw new Error("Appointment intent reconciliation is ambiguous; STOP and preserve ledger");
    }
    if (unowned.length === 1) {
      markAppointmentOwned(ledger, intentId, unowned[0]);
      recovered++;
    }
  }
  return { pendingChecked: pending.length, recovered };
}
