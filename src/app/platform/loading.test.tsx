import { describe, expect, it } from "vitest";

import { AppLoader } from "@/components/app-loader";
import PlatformLoading from "./loading";

describe("platform loading boundary", () => {
  it("uses the shared accessible loader instead of empty cards", () => {
    const fallback = PlatformLoading();
    expect(fallback.type).toBe(AppLoader);
    expect(fallback.props).toEqual({});
  });
});
