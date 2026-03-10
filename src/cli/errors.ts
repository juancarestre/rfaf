export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export class UserCancelledError extends Error {
  constructor(message = "Cancelled by user.") {
    super(message);
    this.name = "UserCancelledError";
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

export class TranslateRuntimeError extends Error {
  readonly stage: "provider" | "schema" | "network" | "timeout" | "runtime";

  constructor(
    message: string,
    stage: "provider" | "schema" | "network" | "timeout" | "runtime" = "runtime"
  ) {
    super(message);
    this.name = "TranslateRuntimeError";
    this.stage = stage;
  }
}

export class StrategyRuntimeError extends Error {
  readonly stage: "provider" | "schema" | "network" | "timeout" | "runtime";

  constructor(
    message: string,
    stage: "provider" | "schema" | "network" | "timeout" | "runtime" = "runtime"
  ) {
    super(message);
    this.name = "StrategyRuntimeError";
    this.stage = stage;
  }
}
