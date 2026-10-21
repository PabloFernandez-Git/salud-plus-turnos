"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAppointmentAvailabilityAction,
  listBookableProfessionalsAction,
  listBookableSpecialtiesAction,
  searchAppointmentSlotsAction,
} from "../actions/appointment-actions";

export type BookingChoice = {
  specialtyId: string;
  specialtyName: string;
  professionalCenterId: string;
  professionalName: string;
  duration: number;
  localDate: string;
  localStartTime: string;
  localEndDate: string;
  localEndTime: string;
  startsAt: string;
  endsAt: string;
};
type Specialty = { specialty_id: string; specialty_name: string };
type Professional = {
  professional_center_id: string;
  professional_first_name: string;
  professional_last_name: string;
  usual_appointment_duration_minutes: number;
};
type Slot = {
  starts_at: string;
  ends_at: string;
  local_date: string;
  local_start_time: string;
  local_end_date: string;
  local_end_time: string;
};
const selectClass = "mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3";

function slotOffset(slot: Slot) {
  // The civil fields come from PostgreSQL. Derive the offset from those fields
  // and the instant so DST labels do not depend on the browser's timezone data.
  const wall = Date.parse(`${slot.local_date}T${slot.local_start_time}:00Z`);
  const minutes = Math.round((wall - Date.parse(slot.starts_at)) / 60000);
  const sign = minutes < 0 ? "−" : "+";
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function resolveBookingChoice(
  specialties: Specialty[],
  professionals: Professional[],
  slots: Slot[],
  specialtyId: string,
  professionalCenterId: string,
  localDate: string,
  startsAt: string,
): BookingChoice | null {
  const specialty = specialties.find((row) => row.specialty_id === specialtyId);
  const professional = professionals.find(
    (row) => row.professional_center_id === professionalCenterId,
  );
  const slot = slots.find((row) => row.starts_at === startsAt && row.local_date === localDate);
  if (!specialty || !professional || !slot) return null;
  return {
    specialtyId,
    specialtyName: specialty.specialty_name,
    professionalCenterId,
    professionalName: `${professional.professional_first_name} ${professional.professional_last_name}`,
    duration: professional.usual_appointment_duration_minutes,
    localDate,
    localStartTime: slot.local_start_time,
    localEndDate: slot.local_end_date,
    localEndTime: slot.local_end_time,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
  };
}

export function BookingSelector({
  centerId,
  onChange,
  initial,
}: {
  centerId: string;
  timezone: string;
  onChange: (choice: BookingChoice | null) => void;
  initial?: {
    specialtyId: string;
    professionalCenterId: string;
    localDate: string;
    startsAt?: string;
  };
}) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [specialtyId, setSpecialtyId] = useState(initial?.specialtyId ?? "");
  const [professionalCenterId, setProfessionalCenterId] = useState(
    initial?.professionalCenterId ?? "",
  );
  const [localDate, setLocalDate] = useState(initial?.localDate ?? "");
  const [slotStart, setSlotStart] = useState("");
  const [specialtyState, setSpecialtyState] = useState<"loading" | "ready" | "error">("loading");
  const [professionalState, setProfessionalState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [slotState, setSlotState] = useState<
    "idle" | "loading" | "ready" | "no-availability" | "empty" | "error"
  >("idle");
  const initialApplied = useRef(false);

  useEffect(() => {
    let active = true;
    listBookableSpecialtiesAction({ centerId })
      .then((result) => {
        if (!active) return;
        if (result.status === "SUCCESS") {
          setSpecialties(result.data);
          setSpecialtyState("ready");
        } else setSpecialtyState("error");
      })
      .catch(() => {
        if (active) setSpecialtyState("error");
      });
    return () => {
      active = false;
    };
  }, [centerId]);

  useEffect(() => {
    if (!specialtyId) return;
    let active = true;
    listBookableProfessionalsAction({ centerId, specialtyId })
      .then((result) => {
        if (!active) return;
        if (result.status === "SUCCESS") {
          setProfessionals(result.data);
          setProfessionalState("ready");
        } else setProfessionalState("error");
      })
      .catch(() => {
        if (active) setProfessionalState("error");
      });
    return () => {
      active = false;
    };
  }, [centerId, specialtyId]);

  useEffect(() => {
    if (!specialtyId || !professionalCenterId || !localDate) return;
    let active = true;
    Promise.all([
      searchAppointmentSlotsAction({ centerId, specialtyId, professionalCenterId, localDate }),
      getAppointmentAvailabilityAction({ centerId, professionalCenterId }),
    ])
      .then(([slotResult, availabilityResult]) => {
        if (!active) return;
        if (slotResult.status !== "SUCCESS") {
          setSlotState("error");
          return;
        }
        setSlots(slotResult.data);
        if (slotResult.data.length) {
          setSlotState("ready");
          return;
        }
        if (availabilityResult.status !== "SUCCESS") {
          setSlotState("error");
          return;
        }
        const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay() || 7;
        setSlotState(
          availabilityResult.data.intervals.some((row) => row.weekday === weekday)
            ? "empty"
            : "no-availability",
        );
      })
      .catch(() => {
        if (active) setSlotState("error");
      });
    return () => {
      active = false;
    };
  }, [centerId, specialtyId, professionalCenterId, localDate]);

  useEffect(() => {
    if (
      !initial?.startsAt ||
      initialApplied.current ||
      slotStart ||
      slotState !== "ready" ||
      specialtyState !== "ready" ||
      professionalState !== "ready"
    )
      return;
    const choice = resolveBookingChoice(
      specialties,
      professionals,
      slots,
      specialtyId,
      professionalCenterId,
      localDate,
      initial.startsAt,
    );
    if (!choice) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      initialApplied.current = true;
      setSlotStart(choice.startsAt);
      onChange(choice);
    });
    return () => {
      active = false;
    };
  }, [
    initial?.startsAt,
    slotStart,
    slotState,
    specialtyState,
    professionalState,
    specialties,
    professionals,
    slots,
    specialtyId,
    professionalCenterId,
    localDate,
    onChange,
  ]);

  function changeSpecialty(value: string) {
    setSpecialtyId(value);
    setProfessionalCenterId("");
    setProfessionals([]);
    setProfessionalState(value ? "loading" : "idle");
    setLocalDate("");
    setSlotStart("");
    setSlots([]);
    setSlotState("idle");
    onChange(null);
  }
  function changeProfessional(value: string) {
    setProfessionalCenterId(value);
    setLocalDate("");
    setSlotStart("");
    setSlots([]);
    setSlotState("idle");
    onChange(null);
  }
  function changeDate(value: string) {
    setLocalDate(value);
    setSlotStart("");
    setSlots([]);
    setSlotState(value ? "loading" : "idle");
    onChange(null);
  }
  function changeSlot(value: string) {
    setSlotStart(value);
    onChange(
      resolveBookingChoice(
        specialties,
        professionals,
        slots,
        specialtyId,
        professionalCenterId,
        localDate,
        value,
      ),
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800">
        Especialidad
        <select
          className={selectClass}
          value={specialtyId}
          onChange={(event) => changeSpecialty(event.target.value)}
          disabled={specialtyState === "loading"}
        >
          <option value="">Elegí una especialidad</option>
          {specialties.map((row) => (
            <option value={row.specialty_id} key={row.specialty_id}>
              {row.specialty_name}
            </option>
          ))}
        </select>
        {specialtyState === "error" && (
          <span role="alert" className="block text-red-700">
            No pudimos cargar las especialidades. Recargá la página.
          </span>
        )}
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Profesional
        <select
          className={selectClass}
          value={professionalCenterId}
          onChange={(event) => changeProfessional(event.target.value)}
          disabled={!specialtyId || professionalState !== "ready"}
        >
          <option value="">Elegí un profesional</option>
          {professionals.map((row) => (
            <option value={row.professional_center_id} key={row.professional_center_id}>
              {row.professional_first_name} {row.professional_last_name}
            </option>
          ))}
        </select>
        {professionalState === "ready" && professionals.length === 0 && (
          <span className="block text-slate-600">
            No hay profesionales activos para esta especialidad.
          </span>
        )}
        {professionalState === "error" && (
          <span role="alert" className="block text-red-700">
            No pudimos cargar profesionales.
          </span>
        )}
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Fecha local del centro
        <input
          className={selectClass}
          type="date"
          value={localDate}
          onChange={(event) => changeDate(event.target.value)}
          disabled={!professionalCenterId}
        />
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Horario disponible
        <select
          className={selectClass}
          value={slotStart}
          onChange={(event) => changeSlot(event.target.value)}
          disabled={
            slotState !== "ready" ||
            specialtyState !== "ready" ||
            professionalState !== "ready" ||
            !specialties.some((row) => row.specialty_id === specialtyId) ||
            !professionals.some((row) => row.professional_center_id === professionalCenterId)
          }
        >
          <option value="">Elegí un horario</option>
          {slots.map((slot) => {
            return (
              <option
                value={slot.starts_at}
                key={slot.starts_at}
                disabled={slot.local_date !== localDate}
              >
                {slot.local_start_time}–{slot.local_end_time} ({slotOffset(slot)})
                {slot.local_end_date !== slot.local_date ? ` (${slot.local_end_date})` : ""}
              </option>
            );
          })}
        </select>
        {slotState === "loading" && (
          <span role="status" className="block text-slate-600">
            Buscando horarios…
          </span>
        )}
        {slotState === "no-availability" && (
          <span className="block text-slate-600">
            El profesional no tiene disponibilidad ese día.
          </span>
        )}
        {slotState === "empty" && (
          <span className="block text-slate-600">No quedan horarios libres ese día.</span>
        )}
        {slotState === "error" && (
          <span role="alert" className="block text-red-700">
            No pudimos cargar horarios. Elegí otra fecha o recargá la página.
          </span>
        )}
      </label>
    </div>
  );
}
