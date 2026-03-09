import { describe, expect, it } from "bun:test";
import { applyDeterministicNoBs } from "../../src/processor/no-bs-cleaner";

describe("applyDeterministicNoBs", () => {
  it("removes emojis and distracting symbols while preserving readable text", () => {
    const result = applyDeterministicNoBs("Hola 🚀 mundo !!! ✨\nContenido real");

    expect(result).not.toContain("🚀");
    expect(result).not.toContain("✨");
    expect(result).toContain("Hola mundo !!!");
    expect(result).toContain("Contenido real");
  });

  it("removes cookie/legal, promo, and navigation clutter lines", () => {
    const source = [
      "Home | Pricing | Contact",
      "Accept all cookies to continue",
      "Subscribe now for more",
      "Linea con informacion importante para lectura",
    ].join("\n");

    const result = applyDeterministicNoBs(source);

    expect(result).not.toContain("Home | Pricing | Contact");
    expect(result).not.toContain("Accept all cookies");
    expect(result).not.toContain("Subscribe now");
    expect(result).toContain("Linea con informacion importante para lectura");
  });

  it("normalizes excessive whitespace and keeps deterministic output", () => {
    const source = "\n\n Texto util \n\n\n Otra linea util \n\n";

    const result = applyDeterministicNoBs(source);
    expect(result).toBe("Texto util\n\nOtra linea util");
  });
});
