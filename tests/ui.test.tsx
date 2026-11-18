// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataOriginBadge, ScoreRing, StatusPill } from "@/components/ui/primitives";

describe("UI smoke", () => {
  it("renders status pills with readable labels", () => {
    render(<StatusPill status="REVIEW_REQUIRED" />);
    expect(screen.getByText(/需专业复核/)).toBeInTheDocument();
  });

  it("renders a null score as missing, never as 50", () => {
    render(<ScoreRing score={null} label="market score" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("labels imported local evidence honestly", () => {
    render(<DataOriginBadge mode="LOCAL_CORPUS" />);
    expect(screen.getByText(/本地导入证据/)).toBeInTheDocument();
  });
});
