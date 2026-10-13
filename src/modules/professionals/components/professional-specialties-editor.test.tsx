import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ProfessionalListItem,
  ProfessionalSpecialtyAssociation,
  ProfessionalSpecialtyOption,
} from "../server/professionals";
import { ProfessionalSpecialtiesEditor } from "./professional-specialties-editor";

const save = vi.fn();
vi.mock("../actions/professional-specialty-action", () => ({
  updateProfessionalSpecialtiesAction: (data: FormData) => save(data),
}));
const centerId = "11111111-1111-4111-8111-111111111111";
const professional: ProfessionalListItem = {
  id: "22222222-2222-4222-8222-222222222222",
  firstName: "Ana",
  lastName: "Pérez",
  licenseNumber: null,
  usualAppointmentDurationMinutes: 30,
  isActive: true,
  updatedAt: "2026-10-09T12:00:00+00:00",
};
const specialties: ProfessionalSpecialtyOption[] = [
  { id: "33333333-3333-4333-8333-333333333333", name: "Cardiología", isActive: true },
  { id: "44444444-4444-4444-8444-444444444444", name: "Clínica médica", isActive: false },
  { id: "55555555-5555-4555-8555-555555555555", name: "Neurología", isActive: true },
  { id: "66666666-6666-4666-8666-666666666666", name: "Pediatría", isActive: true },
];
const assigned: ProfessionalSpecialtyAssociation[] = [
  { professionalCenterId: professional.id, specialtyId: specialties[0].id, isActive: true },
  { professionalCenterId: professional.id, specialtyId: specialties[1].id, isActive: true },
];
const show = (associationRows = assigned, professionalRow = professional) => {
  const onResult = vi.fn();
  render(
    <ProfessionalSpecialtiesEditor
      centerId={centerId}
      professional={professionalRow}
      specialties={specialties}
      associations={associationRows}
      onResult={onResult}
    />,
  );
  return onResult;
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfessionalSpecialtiesEditor", () => {
  it("shows retained inactive association and avoids an empty batch", () => {
    show();
    expect(screen.getByRole("checkbox", { name: "Cardiología" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Clínica médica" })).not.toBeInTheDocument();
    expect(screen.getByText(/Clínica médica — Inactiva/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar especialidades" })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
  it("adds several active options and removes one without omitting the inactive association", async () => {
    save.mockResolvedValue({ status: "success", message: "Guardado", updatedAt: "new-token" });
    const onResult = show();
    fireEvent.click(screen.getByRole("checkbox", { name: "Cardiología" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Neurología" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pediatría" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const data = save.mock.calls[0][0] as FormData;
    expect(data.getAll("activateSpecialtyIds")).toEqual([specialties[2].id, specialties[3].id]);
    expect(data.getAll("deactivateSpecialtyIds")).toEqual([specialties[0].id]);
    expect(data.getAll("deactivateSpecialtyIds")).not.toContain(specialties[1].id);
    expect(data.get("expectedUpdatedAt")).toBe(professional.updatedAt);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: "new-token" }));
  });
  it("only removes an inactive retained association after explicit Desasociar", async () => {
    save.mockResolvedValue({ status: "success", message: "Guardado" });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Desasociar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect((save.mock.calls[0][0] as FormData).getAll("deactivateSpecialtyIds")).toEqual([
      specialties[1].id,
    ]);
  });
  it("does not offer inactive Specialty for a new association", () => {
    show([]);
    expect(screen.queryByRole("checkbox", { name: "Clínica médica" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desasociar" })).not.toBeInTheDocument();
  });
  it("shows a preserved association as operative after Specialty reactivation without a new save", () => {
    const onResult = vi.fn();
    const view = render(
      <ProfessionalSpecialtiesEditor
        centerId={centerId}
        professional={professional}
        specialties={specialties}
        associations={assigned}
        onResult={onResult}
      />,
    );
    expect(screen.getByText(/Clínica médica — Inactiva/)).toBeVisible();
    view.rerender(
      <ProfessionalSpecialtiesEditor
        centerId={centerId}
        professional={professional}
        specialties={specialties.map((row) =>
          row.id === specialties[1].id ? { ...row, isActive: true } : row,
        )}
        associations={assigned}
        onResult={onResult}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Clínica médica" })).toBeChecked();
    expect(save).not.toHaveBeenCalled();
  });
  it("allows only explicit deactivation while ProfessionalCenter is inactive", async () => {
    save.mockResolvedValue({ status: "success", message: "Guardado" });
    show(assigned, { ...professional, isActive: false });
    expect(screen.queryByRole("checkbox", { name: "Neurología" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Desasociar" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Desasociar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Guardar especialidades" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const data = save.mock.calls[0][0] as FormData;
    expect(data.getAll("activateSpecialtyIds")).toEqual([]);
    expect(data.getAll("deactivateSpecialtyIds")).toHaveLength(1);
  });
});
