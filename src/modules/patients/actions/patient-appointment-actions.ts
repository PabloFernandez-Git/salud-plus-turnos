"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadPatientAppointmentPage,
  loadPatientAppointmentSections,
} from "../server/patient-appointments";

type Outcome<T> = { status: "success"; data: T } | { status: "error"; message: string };
const failure = "No pudimos cargar los turnos de este paciente. Intentá de nuevo.";

export async function loadPatientAppointmentSectionsAction(
  input: unknown,
): Promise<Outcome<Awaited<ReturnType<typeof loadPatientAppointmentSections>>>> {
  try {
    const client = await createSupabaseServerClient();
    return { status: "success", data: await loadPatientAppointmentSections(input, client) };
  } catch {
    return { status: "error", message: failure };
  }
}

export async function loadPatientAppointmentPageAction(
  input: unknown,
): Promise<Outcome<Awaited<ReturnType<typeof loadPatientAppointmentPage>>>> {
  try {
    const client = await createSupabaseServerClient();
    return { status: "success", data: await loadPatientAppointmentPage(input, client) };
  } catch {
    return { status: "error", message: failure };
  }
}
