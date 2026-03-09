export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export class SummarizeRuntimeError extends Error {
  readonly stage: "provider" | "schema" | "network" | "timeout" | "runtime";

  constructor(
    message: string,
    stage: "provider" | "schema" | "network" | "timeout" | "runtime" = "runtime"
  ) {
    super(message);
    this.name = "SummarizeRuntimeError";
    this.stage = stage;
  }
}

export class NoBsRuntimeError extends Error {
  readonly stage: "provider" | "schema" | "network" | "timeout" | "runtime";

  constructor(
    message: string,
    stage: "provider" | "schema" | "network" | "timeout" | "runtime" = "runtime"
  ) {
    super(message);
    this.name = "NoBsRuntimeError";
    this.stage = stage;
  }
}
