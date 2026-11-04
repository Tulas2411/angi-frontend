import { describe, expect, it } from "vitest";
import { greeting } from "@/features/moderation/moderation-home-page";

describe("moderation start page", () => {
  it("greets by the hour of the day", () => {
    expect(greeting(7)).toBe("Chào buổi sáng");
    expect(greeting(12)).toBe("Chào buổi trưa");
    expect(greeting(16)).toBe("Chào buổi chiều");
    expect(greeting(21)).toBe("Chào buổi tối");
  });
});
