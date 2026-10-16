import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import postcss, { type AtRule, type Container, type Declaration, type Rule } from "postcss";
import { afterEach, describe, expect, it } from "vitest";
import { AppLoader } from "./app-loader";

afterEach(cleanup);

const css = postcss.parse(
  readFileSync(resolve(process.cwd(), "src/components/app-loader.module.css"), "utf8"),
);

function ruleIn(container: Container, selector: string): Rule {
  const rule = container.nodes?.find(
    (node): node is Rule => node.type === "rule" && node.selector === selector,
  );
  if (!rule) throw new Error(`Missing CSS rule: ${selector}`);
  return rule;
}

function valueOf(rule: Rule, property: string) {
  return rule.nodes?.find(
    (node): node is Declaration => node.type === "decl" && node.prop === property,
  )?.value;
}

describe("AppLoader", () => {
  it("delays visibility in CSS and reveals the loader after the delay", () => {
    const loader = ruleIn(css, ".loader");
    expect(valueOf(loader, "opacity")).toBe("0");
    expect(valueOf(loader, "visibility")).toBe("hidden");
    expect(valueOf(loader, "animation")).toContain("140ms forwards");

    const fade = css.nodes.find(
      (node): node is AtRule =>
        node.type === "atrule" && node.name === "keyframes" && node.params === "app-loader-fade-in",
    );
    if (!fade) throw new Error("Missing loader fade keyframes");
    expect(valueOf(ruleIn(fade, "to"), "opacity")).toBe("1");
    expect(valueOf(ruleIn(fade, "to"), "visibility")).toBe("visible");
  });

  it("shows the Salud Plus brand and announces the loading state", () => {
    render(<AppLoader />);

    expect(screen.getByText("Salud Plus")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Salud Plus, cargando")).toHaveClass("sr-only");
  });

  it("uses viewport positioning by default", () => {
    render(<AppLoader />);

    const status = screen.getByRole("status");
    expect(status).toHaveClass("fixed", "inset-0");
    expect(status).not.toHaveClass("h-full");
  });

  it("uses container positioning when fullScreen is false", () => {
    render(<AppLoader fullScreen={false} />);

    const status = screen.getByRole("status");
    expect(status).toHaveClass("h-full");
    expect(status).not.toHaveClass("fixed", "inset-0");
  });

  it("keeps the plus decorative", () => {
    render(<AppLoader />);

    const symbol = screen.getByRole("status").querySelector("span:first-child");
    expect(symbol).toHaveAttribute("aria-hidden", "true");
    expect(symbol).toBeEmptyDOMElement();
  });
});
