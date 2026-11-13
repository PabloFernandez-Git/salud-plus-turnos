"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { CenterMembershipContext } from "../server/authorization";
import { CenterNavigation } from "./center-navigation";

export function CenterSidebar({
  centerId,
  role,
}: {
  centerId: string;
  role: CenterMembershipContext["membership"]["role"];
}) {
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const expanded = hovered || focusInside;

  return (
    <div className="center-desktop-sidebar sticky top-0 z-30 hidden h-full max-h-dvh w-16 shrink-0 md:block">
      <aside
        aria-label="Barra lateral del centro"
        className={`absolute inset-y-0 left-0 flex flex-col overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white px-2 py-6 transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none ${expanded ? "w-60 shadow-[4px_0_18px_-8px_rgba(15,23,42,0.22)]" : "w-16"}`}
        data-expanded={expanded}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setFocusInside(false);
        }}
        onFocusCapture={() => setFocusInside(true)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHovered(false);
        }}
      >
        <CenterNavigation centerId={centerId} role={role} compact expanded={expanded} />
      </aside>
    </div>
  );
}

export function CenterMobileNavigation({
  centerId,
  role,
}: {
  centerId: string;
  role: CenterMembershipContext["membership"]["role"];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [pathname]);

  function closeMenu() {
    dialogRef.current?.close();
  }

  function openMenu() {
    dialogRef.current?.showModal();
    setOpen(true);
    closeRef.current?.focus();
  }

  return (
    <>
      <div className="center-mobile-nav-trigger flex md:hidden">
        <button
          aria-controls="center-mobile-navigation"
          aria-expanded={open}
          aria-label="Abrir menú de navegación"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          onClick={openMenu}
          ref={triggerRef}
          type="button"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <dialog
        aria-label="Menú de navegación"
        className="center-mobile-nav-dialog fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(20rem,calc(100vw-2.5rem))] max-w-none overflow-y-auto border-r border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/40 md:hidden"
        id="center-mobile-navigation"
        onCancel={closeMenu}
        onClose={() => {
          setOpen(false);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
        ref={dialogRef}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <span className="font-bold text-sky-800">Salud Plus</span>
          <button
            aria-label="Cerrar menú de navegación"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            onClick={closeMenu}
            ref={closeRef}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3 py-5">
          <CenterNavigation centerId={centerId} onNavigate={closeMenu} role={role} />
        </div>
      </dialog>
    </>
  );
}
