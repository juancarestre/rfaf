export type IngestFileErrorCode =
  | "FILE_NOT_FOUND"
  | "INPUT_TOO_LARGE"
  | "BINARY_FILE"
  | "MARKDOWN_EMPTY_TEXT"
  | "MARKDOWN_PARSE_FAILED";

export class IngestFileError extends Error {
  code: IngestFileErrorCode;

  constructor(code: IngestFileErrorCode, message: string) {
    super(message);
    this.name = "IngestFileError";
    this.code = code;
  }
}
