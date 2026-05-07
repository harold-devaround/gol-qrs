import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import MapSection from "./MapSection";

// The legacy initMap touches Fabric.js / canvas APIs that are heavy under
// jsdom; we mock the dynamic import to keep this test focused on the React
// bridge contract: mount → call initMap once → cleanup → wipe container.
vi.mock("../../../js/map/map-section.js", () => ({
  initMap: vi.fn(),
}));

import { initMap } from "../../../js/map/map-section.js";

describe("MapSection (React bridge to legacy initMap)", () => {
  beforeEach(cleanup);
  afterEach(() => vi.clearAllMocks());

  it("mounts the legacy module exactly once on the container element", async () => {
    const { container } = render(<MapSection />);
    await waitFor(() => expect(initMap).toHaveBeenCalled());
    expect(initMap).toHaveBeenCalledTimes(1);
    const host = container.querySelector(".map-section-host");
    expect(initMap).toHaveBeenCalledWith(host);
  });

  it("clears the container DOM on unmount", async () => {
    const { container, unmount } = render(<MapSection />);
    const host = container.querySelector(".map-section-host")!;
    host.innerHTML = '<div class="legacy-stub">stub</div>';
    unmount();
    expect(host.querySelector(".legacy-stub")).toBeNull();
  });

  it("does not call initMap if unmounted before the dynamic import resolves", async () => {
    const { unmount } = render(<MapSection />);
    unmount();
    // Microtask flush
    await Promise.resolve();
    await Promise.resolve();
    expect(initMap).not.toHaveBeenCalled();
  });
});
