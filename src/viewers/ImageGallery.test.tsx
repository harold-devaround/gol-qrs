import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ImageGallery, type GalleryImage } from "../viewers/ImageGallery";

const IMAGES: GalleryImage[] = [
  { name: "A", thumb: "/a-thumb.jpg", full: "/a-full.jpg" },
  { name: "B", thumb: "/b-thumb.jpg", full: "/b-full.jpg" },
  { name: "C", thumb: "/c-thumb.jpg", full: "/c-full.jpg" },
];

describe("ImageGallery", () => {
  beforeEach(cleanup);

  it("renders the title and one button per image", () => {
    render(<ImageGallery title="Cartes Postales" images={IMAGES} />);
    expect(
      screen.getByRole("heading", { name: "Cartes Postales" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(IMAGES.length);
  });

  it("escapes image names safely (no innerHTML injection)", () => {
    const evil: GalleryImage[] = [
      { name: "<script>alert(1)</script>", thumb: "/x.jpg", full: "/x.jpg" },
    ];
    render(<ImageGallery title="X" images={evil} />);
    // React inserts the literal string as text — no <script> element appears.
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("opens the lightbox on click and closes on Escape", () => {
    render(<ImageGallery title="t" images={IMAGES} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "A");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("navigates with ArrowRight / ArrowLeft (cyclic)", () => {
    render(<ImageGallery title="t" images={IMAGES} />);
    fireEvent.click(screen.getAllByRole("button")[0]); // open A
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "A");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "B");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "C");

    // Wrap to first
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "A");

    // Wrap to last on left arrow
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "C");
  });

  it("closes when clicking the backdrop but not when clicking the image", () => {
    render(<ImageGallery title="t" images={IMAGES} />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    const dialog = screen.getByRole("dialog");
    const img = dialog.querySelector("img")!;

    fireEvent.click(img);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hides prev/next when only one image is provided", () => {
    render(<ImageGallery title="t" images={[IMAGES[0]]} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("button", { name: "Précédent" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Suivant" })).toBeNull();
  });

  it("removes the keydown listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ImageGallery title="t" images={IMAGES} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
