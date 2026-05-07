import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import QrSection from "./QrSection";

const SAMPLE = [
  {
    n: 1,
    q: "Quelle est la couleur du cheval blanc?",
    a: "Blanc.",
    src: "AMA",
    date: "2024-01-01",
    themes: ["couleur", "animaux"],
  },
  {
    n: 2,
    q: "Combien font 2+2?",
    a: "Quatre.",
    src: "AMA",
    date: "2024-01-02",
    themes: ["math", "math", "logique"], // duplicate theme — must not crash
  },
  {
    n: 3,
    q: "Capitale de la France?",
    a: "Paris est la <capitale>.",
    src: "AMA",
    date: "2024-01-03",
    themes: ["géographie"],
  },
];

function mockFetch(payload: unknown) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(payload),
    } as Response),
  );
}

describe("QrSection", () => {
  beforeEach(cleanup);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the header even before data loads", async () => {
    mockFetch([]);
    render(<QrSection />);
    expect(
      screen.getByRole("heading", { name: /Guardians of Legends/ }),
    ).toBeInTheDocument();
    // Drain pending state updates so React doesn't warn about act().
    await waitFor(() => screen.getByText("0 / 0"));
  });

  it("loads questions and shows the count", async () => {
    mockFetch(SAMPLE);
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Capitale de la France/));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("escapes user content (no XSS via answer text)", async () => {
    mockFetch(SAMPLE);
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Paris est la/));
    // Literal "<capitale>" appears in the DOM as text, never as a tag.
    expect(document.querySelector("capitale")).toBeNull();
  });

  it("filters by search term (case-insensitive)", async () => {
    mockFetch(SAMPLE);
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Capitale/));
    const input = screen.getByPlaceholderText(/Rechercher/);
    fireEvent.change(input, { target: { value: "paris" } });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("toggles a theme tag and filters accordingly", async () => {
    mockFetch(SAMPLE);
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Capitale/));
    fireEvent.click(screen.getByRole("button", { name: "math" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it('"Tous" tag clears all active themes', async () => {
    mockFetch(SAMPLE);
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Capitale/));
    fireEvent.click(screen.getByRole("button", { name: "math" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tous" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("shows an error message when fetch fails", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("boom")));
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Erreur de chargement : boom/));
  });

  it("handles duplicate themes within a single item without React key warnings", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(SAMPLE);
    render(<QrSection />);
    await waitFor(() => screen.getByText(/Combien font/));
    expect(errSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("same key"),
      expect.anything(),
      expect.anything(),
    );
    errSpy.mockRestore();
  });
});
