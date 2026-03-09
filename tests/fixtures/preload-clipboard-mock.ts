export {};

type ClipboardScenario =
  | "success"
  | "empty"
  | "unavailable"
  | "permission-denied"
  | "unknown"
  | "guard";

const scenario = (process.env.RFAF_CLIPBOARD_MOCK_SCENARIO ?? "success") as ClipboardScenario;

globalThis.__RFAF_TEST_READ_CLIPBOARD__ = async () => {
  switch (scenario) {
    case "success":
      return "clipboard fixture text for runtime verification";
    case "empty":
      return " \n\t";
    case "unavailable":
      throw new Error("no clipboard backend found");
    case "permission-denied":
      throw new Error("permission denied by OS policy");
    case "unknown":
      throw new Error("unexpected clipboard backend panic");
    case "guard":
      throw new Error("CLIPBOARD_READ_SHOULD_NOT_BE_CALLED");
    default:
      return "clipboard fixture text for runtime verification";
  }
};
