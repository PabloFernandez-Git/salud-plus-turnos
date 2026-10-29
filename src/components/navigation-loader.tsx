"use client";

import { useLinkStatus } from "next/link";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { AppLoader } from "./app-loader";

export function NavigationLoader() {
  const { pending } = useLinkStatus();
  const portalRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!pending || !portalRef.current) return;
    const portal = portalRef.current;
    const previousFocus = document.activeElement;
    const siblings = Array.from(document.body.children)
      .filter((child) => child !== portal)
      .map((child) => ({ child: child as HTMLElement, inert: (child as HTMLElement).inert }));
    for (const { child } of siblings) child.inert = true;
    portal.focus({ preventScroll: true });

    return () => {
      for (const { child, inert } of siblings) child.inert = inert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [pending]);

  return pending
    ? createPortal(
        <div
          ref={portalRef}
          tabIndex={-1}
          data-navigation-loader=""
          onClick={(event) => event.stopPropagation()}
        >
          <AppLoader />
        </div>,
        document.body,
      )
    : null;
}
