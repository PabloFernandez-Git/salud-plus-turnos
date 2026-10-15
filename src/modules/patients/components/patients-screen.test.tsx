import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import type { PatientPage } from "../server/patients";
import { formatPatientBirthDate, PatientsScreen } from "./patients-screen";
import styles from "./patients-screen.module.css";

const centerId = "11111111-1111-4111-8111-111111111111";
const row = {
  patient_center_id: "22222222-2222-4222-8222-222222222222",
  person_id: "33333333-3333-4333-8333-333333333333",
  first_name: "Ana",
  last_name: "Pérez",
  nationality_code: "AR",
  document_number: "123",
  birth_date: "2000-01-02",
  phone: "555123",
  email: null,
  insurance_name: null,
  is_active: true,
  updated_at: "2026-10-14T12:00:00+00:00",
};
const result: PatientPage = {
  rows: [row],
  page: 2,
  hasPrevious: true,
  hasNext: true,
  atOffsetCeiling: false,
};
const filters = { query: "Ana", state: "ALL" as const, page: 2 };
afterEach(cleanup);

describe("patients presentation", () => {
  it("marks only the Patients screen for its subtle entrance", () => {
    render(
      <PatientsScreen centerId={centerId} centerName="Centro" filters={filters} result={result} />,
    );
    expect(screen.getByRole("main")).toHaveClass(styles.enter);
  });

  it("formats civil dates without timezone conversion", () => {
    expect(formatPatientBirthDate("2000-01-02")).toBe("02/01/2000");
  });
  it("shows the same row in desktop table and mobile card, with null placeholders", () => {
    render(
      <PatientsScreen centerId={centerId} centerName="Centro" filters={filters} result={result} />,
    );
    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(table).getAllByText("—")).toHaveLength(2);
    const card = screen.getByRole("article", { hidden: true });
    expect(within(card).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(card).getAllByText("—")).toHaveLength(2);
    expect(screen.getAllByText("Activo", { exact: true })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/patients?q=Ana&state=ALL`,
    );
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/patients?q=Ana&state=ALL&page=3`,
    );
    expect(screen.getByRole("link", { name: "Limpiar" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/patients`,
    );
    const form = screen.getByRole("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", `/centers/${centerId}/patients`);
    expect(within(form).getByRole("searchbox", { name: "Buscar" })).toHaveAttribute("name", "q");
    expect(within(form).getByRole("combobox", { name: "Estado" })).toHaveAttribute("name", "state");
    expect(form.querySelector('[name="page"]')).toBeNull();
  });
  it("shows INACTIVE status", () => {
    render(
      <PatientsScreen
        centerId={centerId}
        centerName="Centro"
        filters={filters}
        result={{ ...result, rows: [{ ...row, is_active: false }] }}
      />,
    );
    expect(screen.getAllByText("Inactivo", { exact: true })).toHaveLength(2);
  });
  it.each([
    ["Ana", "ACTIVE", "No encontramos pacientes para esta búsqueda"],
    ["", "ACTIVE", "No hay pacientes activos"],
    ["", "INACTIVE", "No hay pacientes inactivos"],
    ["", "ALL", "No hay pacientes registrados"],
  ] as const)("shows the matching empty state", (query, state, message) => {
    render(
      <PatientsScreen
        centerId={centerId}
        centerName="Centro"
        filters={{ query, state, page: 1 }}
        result={{ rows: [], page: 1, hasPrevious: false, hasNext: false, atOffsetCeiling: false }}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
  });
  it("shows generic load error and a retry link preserving filters", () => {
    render(
      <PatientsScreen
        centerId={centerId}
        centerName="Centro"
        filters={filters}
        result={null}
        loadFailed
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los pacientes");
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      `/centers/${centerId}/patients?q=Ana&state=ALL&page=2`,
    );
  });
});
