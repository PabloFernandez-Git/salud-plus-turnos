"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  getAppointmentAvailabilityAction,
  listBookableProfessionalsAction,
  listBookableSpecialtiesAction,
  searchAppointmentSlotsAction,
} from "../actions/appointment-actions";
import { centerLocalDate, readableCivilDate } from "../search/appointment-search";
import { CivilDatePicker, civilWeekday } from "./civil-date-picker";
import { buildVisualSlotRows, type AvailabilityInterval } from "./appointment-slot-presentation";

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
  displayOffset?: string;
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
const selectClass =
  "mt-1 min-h-11 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 hover:border-sky-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

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
  const repeatedCivilTime =
    slots.filter(
      (candidate) =>
        candidate.local_date === localDate &&
        candidate.local_start_time === slot.local_start_time &&
        candidate.local_end_time === slot.local_end_time,
    ).length > 1;
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
    ...(repeatedCivilTime ? { displayOffset: slotOffset(slot) } : {}),
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
  };
}

export function BookingSelector({
  centerId,
  timezone,
  onChange,
  onInteraction,
  initial,
  disabled = false,
  stabilizeInitialLoad = false,
}: {
  centerId: string;
  timezone: string;
  onChange: (choice: BookingChoice | null) => void;
  onInteraction?: () => void;
  disabled?: boolean;
  stabilizeInitialLoad?: boolean;
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
  const [availability, setAvailability] = useState<AvailabilityInterval[] | null>(null);
  const [specialtyId, setSpecialtyId] = useState(initial?.specialtyId ?? "");
  const [professionalCenterId, setProfessionalCenterId] = useState(
    initial?.professionalCenterId ?? "",
  );
  const [localDate, setLocalDate] = useState(initial?.localDate ?? "");
  const [slotStart, setSlotStart] = useState("");
  const [specialtyState, setSpecialtyState] = useState<"loading" | "ready" | "error">("loading");
  const [professionalState, setProfessionalState] = useState<
    "idle" | "loading" | "ready" | "error"
  >(initial?.specialtyId ? "loading" : "idle");
  const [slotState, setSlotState] = useState<
    "idle" | "loading" | "ready" | "no-availability" | "empty" | "error"
  >(
    initial?.specialtyId && initial?.professionalCenterId && initial?.localDate
      ? "loading"
      : "idle",
  );
  const initialApplied = useRef(false);
  const slotsLabelId = useId();
  const [referenceDate] = useState(() => centerLocalDate(timezone));
  const selectableSlots = slots.filter((slot) => slot.local_date === localDate);
  const duration = professionals.find(
    (row) => row.professional_center_id === professionalCenterId,
  )?.usual_appointment_duration_minutes;
  const visualRows = buildVisualSlotRows(
    localDate,
    localDate ? civilWeekday(localDate) + 1 : 0,
    duration ?? 0,
    availability,
    selectableSlots,
  );
  const preparingInitial =
    stabilizeInitialLoad &&
    (specialtyState === "loading" || professionalState === "loading" || slotState === "loading");
  const slotLabelCounts = new Map<string, number>();
  for (const slot of selectableSlots) {
    const label = `${slot.local_start_time}–${slot.local_end_time}`;
    slotLabelCounts.set(label, (slotLabelCounts.get(label) ?? 0) + 1);
  }

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
      getAppointmentAvailabilityAction({ centerId, professionalCenterId }).catch(() => null),
    ])
      .then(([slotResult, availabilityResult]) => {
        if (!active) return;
        if (slotResult.status !== "SUCCESS") {
          setSlotState("error");
          return;
        }
        setSlots(slotResult.data);
        setAvailability(
          availabilityResult?.status === "SUCCESS" ? availabilityResult.data.intervals : null,
        );
        if (slotResult.data.length) {
          setSlotState("ready");
          return;
        }
        if (availabilityResult?.status !== "SUCCESS") {
          setSlotState("error");
          return;
        }
        const weekday = civilWeekday(localDate) + 1;
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
      disabled ||
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
    disabled,
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
    onInteraction?.();
    setSpecialtyId(value);
    setProfessionalCenterId("");
    setProfessionals([]);
    setProfessionalState(value ? "loading" : "idle");
    setLocalDate("");
    setSlotStart("");
    setSlots([]);
    setAvailability(null);
    setSlotState("idle");
    onChange(null);
  }
  function changeProfessional(value: string) {
    onInteraction?.();
    setProfessionalCenterId(value);
    setLocalDate("");
    setSlotStart("");
    setSlots([]);
    setAvailability(null);
    setSlotState("idle");
    onChange(null);
  }
  function changeDate(value: string) {
    onInteraction?.();
    setLocalDate(value);
    setSlotStart("");
    setSlots([]);
    setAvailability(null);
    setSlotState(value ? "loading" : "idle");
    onChange(null);
  }
  function changeSlot(value: string) {
    onInteraction?.();
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
  if (preparingInitial) {
    return (
      <div
        role="status"
        className="rounded-lg border border-sky-100 bg-sky-50 p-5 text-sm text-sky-950"
      >
        Preparando opciones para reprogramar…
      </div>
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
          disabled={disabled || specialtyState === "loading"}
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
          disabled={disabled || !specialtyId || professionalState !== "ready"}
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
      <CivilDatePicker
        key={professionalCenterId || "no-professional"}
        value={localDate}
        referenceDate={referenceDate}
        disabled={disabled || !professionalCenterId}
        onChange={changeDate}
      />
      <div className="min-w-0 text-sm font-semibold text-slate-800 sm:col-span-2">
        <p id={slotsLabelId}>Horarios disponibles</p>
        {slotState === "empty" && visualRows.length > 0 && (
          <p className="mt-2 text-sm font-normal text-slate-600">
            No quedan horarios libres ese día.
          </p>
        )}
        {(slotState === "ready" || slotState === "empty") && visualRows.length > 0 && (
          <div
            role="group"
            aria-labelledby={slotsLabelId}
            className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visualRows.map((row, index) => {
              if (row.kind === "unavailable") {
                const label = `${row.startTime}–${row.endTime}`;
                return (
                  <button
                    key={`unavailable-${index}-${label}`}
                    type="button"
                    disabled
                    aria-label={`${label}, no disponible`}
                    className="min-h-11 min-w-0 cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-2 py-2 text-center text-sm font-medium text-slate-500"
                  >
                    <span className="block">{label}</span>
                    <span className="block text-xs">No disponible</span>
                  </button>
                );
              }
              const slot = row.slot;
              const label = `${slot.local_start_time}–${slot.local_end_time}`;
              const repeated = (slotLabelCounts.get(label) ?? 0) > 1;
              const canSelect =
                !disabled &&
                specialtyState === "ready" &&
                professionalState === "ready" &&
                specialties.some((row) => row.specialty_id === specialtyId) &&
                professionals.some((row) => row.professional_center_id === professionalCenterId);
              return (
                <button
                  key={slot.starts_at}
                  type="button"
                  aria-label={`${label}${repeated ? ` ${slotOffset(slot)}` : ""}${slot.local_end_date !== slot.local_date ? `, termina ${readableCivilDate(slot.local_end_date)}` : ""}`}
                  aria-pressed={slotStart === slot.starts_at}
                  disabled={!canSelect}
                  className={`min-h-11 min-w-0 cursor-pointer rounded-md border px-2 py-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-50 ${slotStart === slot.starts_at ? "border-sky-700 bg-sky-700 text-white hover:bg-sky-800" : "border-slate-300 bg-white text-slate-900 hover:border-sky-600 hover:bg-sky-50"}`}
                  onClick={() => changeSlot(slot.starts_at)}
                >
                  <span className="block">{label}</span>
                  {repeated && (
                    <span className="block text-xs font-normal">{slotOffset(slot)}</span>
                  )}
                  {slot.local_end_date !== slot.local_date && (
                    <span className="block text-xs font-normal">
                      Termina {readableCivilDate(slot.local_end_date)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {slotState === "idle" && (
          <p className="mt-2 text-sm font-normal text-slate-600">
            {disabled
              ? "Seleccioná un paciente para elegir fecha y horario."
              : "Elegí una fecha para ver los horarios."}
          </p>
        )}
        {slotState === "loading" && (
          <span role="status" className="mt-2 block text-slate-600">
            Buscando horarios…
          </span>
        )}
        {slotState === "no-availability" && (
          <span className="mt-2 block text-slate-600">
            El profesional no tiene disponibilidad ese día.
          </span>
        )}
        {slotState === "empty" && visualRows.length === 0 && (
          <span className="mt-2 block text-slate-600">No quedan horarios libres ese día.</span>
        )}
        {slotState === "ready" && selectableSlots.length === 0 && (
          <p className="mt-2 text-slate-600">No hay horarios seleccionables para esta fecha.</p>
        )}
        {slotState === "error" && (
          <span role="alert" className="mt-2 block text-red-700">
            No pudimos cargar horarios. Elegí otra fecha o recargá la página.
          </span>
        )}
      </div>
    </div>
  );
}
