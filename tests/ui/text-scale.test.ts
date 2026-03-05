import { describe, expect, it } from "bun:test";
import {
  getTextScaleConfig,
  type TextScalePreset,
} from "../../src/ui/text-scale";

describe("getTextScaleConfig", () => {
  it("returns deterministic config for each preset", () => {
    const presets: TextScalePreset[] = ["small", "normal", "large"];
    for (const preset of presets) {
      const config = getTextScaleConfig(preset);
      expect(config.preset).toBe(preset);
    }
  });

  it("increases lane spacing progressively from small -> normal -> large", () => {
    const small = getTextScaleConfig("small");
    const normal = getTextScaleConfig("normal");
    const large = getTextScaleConfig("large");

    expect(normal.wordTopPadding).toBeGreaterThanOrEqual(small.wordTopPadding);
    expect(large.wordTopPadding).toBeGreaterThanOrEqual(normal.wordTopPadding);

    expect(normal.wordBottomPadding).toBeGreaterThanOrEqual(small.wordBottomPadding);
    expect(large.wordBottomPadding).toBeGreaterThanOrEqual(normal.wordBottomPadding);
  });

  it("uses stronger status readability for normal/large than small", () => {
    const small = getTextScaleConfig("small");
    const normal = getTextScaleConfig("normal");
    const large = getTextScaleConfig("large");

    expect(small.statusDim).toBeTrue();
    expect(normal.statusDim).toBeFalse();
    expect(large.statusDim).toBeFalse();
  });
});
