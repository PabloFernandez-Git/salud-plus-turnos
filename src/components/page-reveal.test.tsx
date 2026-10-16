import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import postcss, { type AtRule, type Container, type Declaration, type Rule } from "postcss";
import { afterEach, describe, expect, it } from "vitest";
import { PageReveal } from "./page-reveal";
import styles from "./page-reveal.module.css";

afterEach(cleanup);

const css = postcss.parse(
  readFileSync(resolve(process.cwd(), "src/components/page-reveal.module.css"), "utf8"),
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

describe("PageReveal", () => {
  it("renders children in the reveal wrapper without changing their semantics", () => {
    render(
      <PageReveal>
        <main>Contenido del centro</main>
      </PageReveal>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Contenido del centro");
    expect(main.parentElement).toHaveClass(styles.reveal);
  });

  it("keeps the entrance in CSS and disables it for reduced motion", () => {
    expect(valueOf(ruleIn(css, ".reveal"), "animation")).toBe(
      "page-reveal-enter 220ms ease-out both",
    );

    const keyframes = css.nodes.find(
      (node): node is AtRule =>
        node.type === "atrule" && node.name === "keyframes" && node.params === "page-reveal-enter",
    );
    if (!keyframes) throw new Error("Missing page reveal keyframes");
    expect(valueOf(ruleIn(keyframes, "from"), "opacity")).toBe("0");
    expect(valueOf(ruleIn(keyframes, "from"), "transform")).toBe("translateY(3px)");
    expect(valueOf(ruleIn(keyframes, "to"), "opacity")).toBe("1");
    expect(valueOf(ruleIn(keyframes, "to"), "transform")).toBe("translateY(0)");

    const reducedMotion = css.nodes.find(
      (node): node is AtRule =>
        node.type === "atrule" &&
        node.name === "media" &&
        node.params === "(prefers-reduced-motion: reduce)",
    );
    if (!reducedMotion) throw new Error("Missing reduced motion rule");
    expect(valueOf(ruleIn(reducedMotion, ".reveal"), "animation")).toBe("none");
  });
});
