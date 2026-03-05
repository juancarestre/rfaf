import { describe, expect, it } from "bun:test";
import type { TextScalePreset } from "../../src/ui/text-scale";
import { getReadingLaneLayout } from "../../src/ui/screens/RSVPScreen";

describe("RSVPScreen layout", () => {
  it("keeps reading lane centered for all text scales", () => {
    const presets: TextScalePreset[] = ["small", "normal", "large"];

    for (const preset of presets) {
      const layout = getReadingLaneLayout(preset);
      expect(layout.justifyContent).toBe("center");
      expect(layout.alignItems).toBe("center");
    }
  });
});
