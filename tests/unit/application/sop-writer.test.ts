import { describe, it, expect } from "vitest";

// Test the pure utility functions extracted from sop-writer logic
// (We test the slug and category logic without needing Claude API calls)

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function categorizeSop(step: string): string {
  const s = step.toLowerCase();
  if (s.includes("deploy") || s.includes("docker") || s.includes("push")) return "deployment";
  if (s.includes("test") || s.includes("lint") || s.includes("typecheck") || s.includes("audit"))
    return "pipeline-failures";
  return "general";
}

describe("SOP slug generation", (): void => {
  it("should convert title to a safe filename slug", (): void => {
    expect(toSlug("Typecheck Failed: Missing Return Type")).toBe(
      "typecheck-failed-missing-return-type",
    );
  });

  it("should strip leading and trailing hyphens", (): void => {
    expect(toSlug("  hello world  ")).toBe("hello-world");
  });

  it("should truncate long titles to 60 characters", (): void => {
    const long = "a".repeat(80);
    expect(toSlug(long).length).toBeLessThanOrEqual(60);
  });
});

describe("SOP categorization", (): void => {
  it("should categorize docker steps as deployment", (): void => {
    expect(categorizeSop("Docker Build & Push")).toBe("deployment");
  });

  it("should categorize lint steps as pipeline-failures", (): void => {
    expect(categorizeSop("Lint")).toBe("pipeline-failures");
  });

  it("should categorize typecheck steps as pipeline-failures", (): void => {
    expect(categorizeSop("Typecheck")).toBe("pipeline-failures");
  });

  it("should categorize audit steps as pipeline-failures", (): void => {
    expect(categorizeSop("audit:deps")).toBe("pipeline-failures");
  });

  it("should categorize unknown steps as general", (): void => {
    expect(categorizeSop("Some unknown step")).toBe("general");
  });
});
