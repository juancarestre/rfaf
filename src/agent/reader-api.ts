import {
  DEFAULT_READING_MODE,
  READING_MODES,
  type ReadingMode,
} from "../cli/mode-option";
import {
  DEFAULT_SUMMARY_PRESET,
  type SummaryPreset,
} from "../cli/summary-option";
import { DEFAULT_KEY_PHRASES_MAX_PHRASES } from "../cli/key-phrases-option";
import {
  DEFAULT_TEXT_SCALE,
  type TextScalePreset,
} from "../cli/text-scale-option";
import type { LLMConfig } from "../config/llm-config";
import {
  adjustWpm,
  createReader,
  jumpToNextParagraph,
  jumpToPreviousParagraph,
  restartReader,
  stepBackward,
  stepForward,
  togglePlayPause,
  type Reader,
} from "../engine/reader";
import { applyReaderAndSession } from "../engine/reader-session-sync";
import { mapPositionToNewWords } from "../engine/position-mapping";
import {
  createSession,
  markPaused,
  type Session,
} from "../engine/session";
import {
  NoBsRuntimeError,
  KeyPhrasesRuntimeError,
  SummarizeRuntimeError,
  TranslateRuntimeError,
  UsageError,
} from "../cli/errors";
import { extractKeyPhrases } from "../llm/key-phrases";
import { noBsText } from "../llm/no-bs";
import { summarizeText } from "../llm/summarize";
import {
  DEFAULT_TRANSLATE_CONCURRENCY,
  splitIntoTranslationChunks,
  translateContentInChunks,
} from "../llm/translate-chunking";
import {
  LanguageNormalizationError,
  normalizeTargetLanguage,
} from "../llm/language-normalizer";
import { recommendStrategy } from "../llm/strategy";
import { translateText } from "../llm/translate";
import { createTimeoutDeadline, resolveAdaptiveTimeoutMs } from "../llm/timeout-policy";
import { applyDeterministicNoBs } from "../processor/no-bs-cleaner";
import { annotateWordsWithKeyPhrases } from "../processor/key-phrase-annotation";
import { getWordsForMode, type ModeWordCache, transformWordsForMode } from "../processor/mode-transform";
import {
  computeLineMap,
  type LineMap,
  getLastWordIndexForLine,
  getNextLineStartIndex,
  getPreviousLineStartIndex,
} from "../processor/line-computation";
import { tokenize } from "../processor/tokenizer";
import type { Word } from "../processor/types";
import { IngestFileError } from "../ingest/errors";
import { readUrl, type ReadUrlOptions } from "../ingest/url";
import { readFileSource } from "../ingest/file-dispatcher";
import { readClipboard } from "../ingest/clipboard";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { resolveModeAfterStrategy, strategyBeforeRsvp } from "../cli/strategy-flow";
import { resolveStrategyOption } from "../cli/strategy-option";

interface AgentSummaryContext {
  enabled: boolean;
  preset: SummaryPreset;
  provider: LLMConfig["provider"] | null;
  model: string | null;
  sourceLabel: string | null;
}

interface AgentLineMapCache {
  contentWidth: number;
  words: Word[];
  lineMap: LineMap;
}

interface AgentIngestDocument {
  content: string;
  source: string;
  wordCount: number;
}

interface AgentIngestRuntimeOptions {
  initialWpm?: number;
  textScale?: TextScalePreset;
}

export interface AgentReaderRuntime {
  reader: Reader;
  session: Session;
  textScale: TextScalePreset;
  readingMode: ReadingMode;
  sourceWords: Word[];
  sourceText: string;
  modeWordCache: ModeWordCache;
  lineMapCache: AgentLineMapCache | null;
  summary: AgentSummaryContext;
  keyPhrases: string[];
}

export type AgentReaderCommand =
  | { type: "play_pause" }
  | { type: "step_next" }
  | { type: "step_prev" }
  | { type: "step_next_line"; contentWidth?: number }
  | { type: "step_prev_line"; contentWidth?: number }
  | { type: "jump_next_paragraph" }
  | { type: "jump_prev_paragraph" }
  | { type: "set_wpm_delta"; delta: number }
  | { type: "set_text_scale"; textScale: TextScalePreset }
  | { type: "set_reading_mode"; readingMode: ReadingMode }
  | { type: "restart" };

export interface AgentReaderState {
  mode: Reader["state"];
  currentIndex: number;
  currentWord: string;
  currentWpm: number;
  textScale: TextScalePreset;
  readingMode: ReadingMode;
  totalWords: number;
  progress: number;
  wordsRead: number;
  summaryEnabled: boolean;
  summaryPreset: SummaryPreset;
  summaryProvider: LLMConfig["provider"] | null;
  summaryModel: string | null;
  summarySourceLabel: string | null;
  keyPhrases: string[];
  keyPhrasesCount: number;
}

type AgentKeyPhrasesMode = "preview" | "list";
type AgentTimeoutOutcome = "continue" | "abort";

interface AgentSummarizeCommand {
  preset: SummaryPreset;
  sourceLabel: string;
  readingMode?: ReadingMode;
  signal?: AbortSignal;
  timeoutOutcome?: AgentTimeoutOutcome;
  llmConfig: Pick<LLMConfig, "provider" | "model" | "apiKey" | "timeoutMs" | "maxRetries">;
}

interface AgentNoBsCommand {
  sourceLabel: string;
  readingMode?: ReadingMode;
  signal?: AbortSignal;
  timeoutOutcome?: AgentTimeoutOutcome;
  llmConfig: Pick<LLMConfig, "provider" | "model" | "apiKey" | "timeoutMs" | "maxRetries">;
}

interface AgentTranslateCommand {
  target: string;
  sourceLabel: string;
  readingMode?: ReadingMode;
  signal?: AbortSignal;
  timeoutOutcome?: AgentTimeoutOutcome;
  llmConfig: Pick<LLMConfig, "provider" | "model" | "apiKey" | "timeoutMs" | "maxRetries">;
}

interface AgentKeyPhrasesCommand {
  sourceLabel: string;
  mode?: AgentKeyPhrasesMode;
  readingMode?: ReadingMode;
  maxPhrases?: number;
  signal?: AbortSignal;
  timeoutOutcome?: AgentTimeoutOutcome;
  llmConfig: Pick<LLMConfig, "provider" | "model" | "apiKey" | "timeoutMs" | "maxRetries">;
}

interface AgentStrategyCommand {
  selectedMode?: ReadingMode;
  explicitModeProvided?: boolean;
  signal?: AbortSignal;
  llmConfig: Pick<LLMConfig, "provider" | "model" | "apiKey" | "timeoutMs" | "maxRetries">;
}

export interface AgentStrategyResult {
  runtime: AgentReaderRuntime;
  recommendedMode: ReadingMode | null;
  appliedMode: ReadingMode;
  rationale: string | null;
  warning: string | null;
}
export interface AgentIngestUrlCommand {
  url: string;
  initialWpm?: number;
  textScale?: TextScalePreset;
  readingMode?: ReadingMode;
  readUrlOptions?: Omit<ReadUrlOptions, "fetchFn">;
}

export interface AgentIngestUrlResult {
  runtime: AgentReaderRuntime;
  sourceLabel: string;
  wordCount: number;
}

export interface AgentIngestFileCommand {
  path: string;
  initialWpm?: number;
  textScale?: TextScalePreset;
  readingMode?: ReadingMode;
}

export interface AgentIngestFileResult {
  runtime: AgentReaderRuntime;
  sourceLabel: string;
  wordCount: number;
}

export interface AgentIngestClipboardCommand {
  initialWpm?: number;
  textScale?: TextScalePreset;
  readingMode?: ReadingMode;
}

export interface AgentIngestClipboardResult {
  runtime: AgentReaderRuntime;
  sourceLabel: string;
  wordCount: number;
}

export type AgentIngestFileErrorCode =
  | "FILE_NOT_FOUND"
  | "BINARY_FILE"
  | "PDF_INVALID"
  | "PDF_ENCRYPTED"
  | "PDF_EMPTY_TEXT"
  | "EPUB_INVALID"
  | "EPUB_ENCRYPTED"
  | "EPUB_EMPTY_TEXT"
  | "MARKDOWN_BINARY"
  | "MARKDOWN_EMPTY_TEXT"
  | "INPUT_TOO_LARGE"
  | "PDF_PARSE_FAILED"
  | "EPUB_PARSE_FAILED"
  | "MARKDOWN_PARSE_FAILED";

export class AgentIngestFileError extends Error {
  code: AgentIngestFileErrorCode;

  constructor(code: AgentIngestFileErrorCode, message: string) {
    super(message);
    this.name = "AgentIngestFileError";
    this.code = code;
  }
}

export type AgentIngestClipboardErrorCode =
  | "CLIPBOARD_EMPTY"
  | "CLIPBOARD_UNAVAILABLE"
  | "CLIPBOARD_PERMISSION_DENIED"
  | "INPUT_TOO_LARGE"
  | "CLIPBOARD_READ_FAILED";

export class AgentIngestClipboardError extends Error {
  code: AgentIngestClipboardErrorCode;

  constructor(code: AgentIngestClipboardErrorCode, message: string) {
    super(message);
    this.name = "AgentIngestClipboardError";
    this.code = code;
  }
}

const AGENT_SCROLL_CONTENT_WIDTH = 78;
const MIN_LLM_TIMEOUT_MS = 1;
const MAX_LLM_TIMEOUT_MS = 60_000;
const MAX_LLM_RETRIES = 5;

function wordsToSourceText(words: Word[]): string {
  return words.map((word) => word.text).join(" ");
}

function redactSecrets(message: string, secrets: Array<string | undefined>): string {
  let redacted = message;
  for (const secret of secrets) {
    if (!secret || secret.length < 8) {
      continue;
    }
    redacted = redacted.split(secret).join("[REDACTED]");
  }

  return redacted.replace(/(sk|AIza)[A-Za-z0-9_\-]{8,}/g, "[REDACTED]");
}

function sanitizeRuntimeMessage(message: string, apiKey?: string): string {
  return sanitizeTerminalText(redactSecrets(message, [apiKey]));
}

function normalizeLlmRuntimeBounds(
  llmConfig: Pick<LLMConfig, "timeoutMs" | "maxRetries">
): { timeoutMs: number; maxRetries: number } {
  if (!Number.isFinite(llmConfig.timeoutMs) || !Number.isInteger(llmConfig.timeoutMs)) {
    throw new UsageError("Invalid llmConfig.timeoutMs. It must be an integer.");
  }

  if (llmConfig.timeoutMs < MIN_LLM_TIMEOUT_MS || llmConfig.timeoutMs > MAX_LLM_TIMEOUT_MS) {
    throw new UsageError(
      `Invalid llmConfig.timeoutMs. It must be between ${MIN_LLM_TIMEOUT_MS} and ${MAX_LLM_TIMEOUT_MS}.`
    );
  }

  if (!Number.isFinite(llmConfig.maxRetries) || !Number.isInteger(llmConfig.maxRetries)) {
    throw new UsageError("Invalid llmConfig.maxRetries. It must be an integer.");
  }

  if (llmConfig.maxRetries < 0 || llmConfig.maxRetries > MAX_LLM_RETRIES) {
    throw new UsageError(
      `Invalid llmConfig.maxRetries. It must be between 0 and ${MAX_LLM_RETRIES}.`
    );
  }

  return {
    timeoutMs: llmConfig.timeoutMs,
    maxRetries: llmConfig.maxRetries,
  };
}

function resolveAgentTimeoutOutcome(value: AgentTimeoutOutcome | undefined): AgentTimeoutOutcome {
  return value === "continue" ? "continue" : "abort";
}

function resolveKeyPhrasesMode(value: unknown): AgentKeyPhrasesMode {
  if (value === undefined) {
    return "preview";
  }

  if (value === "preview" || value === "list") {
    return value;
  }

  throw new UsageError("Invalid key-phrases mode. Use one of: preview, list.");
}

function isReadingMode(value: string): value is ReadingMode {
  return READING_MODES.includes(value as ReadingMode);
}

function requireReadingMode(value: unknown, context: string): ReadingMode {
  if (typeof value !== "string") {
    throw new Error(`Invalid readingMode in ${context}. Use one of: ${READING_MODES.join(", ")}.`);
  }

  const normalized = value.trim().toLowerCase();
  if (!isReadingMode(normalized)) {
    throw new Error(`Invalid readingMode in ${context}. Use one of: ${READING_MODES.join(", ")}.`);
  }

  return normalized;
}

function buildSummarySourceLabel(
  sourceLabel: string,
  preset: SummaryPreset,
  readingMode: ReadingMode
): string {
  const base = `${sourceLabel} (summary:${preset})`;
  return readingMode === "rsvp" ? base : `${base} [${readingMode}]`;
}

function buildTranslatedSourceLabel(
  sourceLabel: string,
  targetLanguage: string,
  readingMode: ReadingMode
): string {
  const base = `${sourceLabel} (translated:${targetLanguage})`;
  return readingMode === "rsvp" ? base : `${base} [${readingMode}]`;
}

function getCachedLineMap(
  runtime: AgentReaderRuntime,
  contentWidth: number
): { lineMap: LineMap; lineMapCache: AgentLineMapCache } {
  if (
    runtime.lineMapCache &&
    runtime.lineMapCache.words === runtime.reader.words &&
    runtime.lineMapCache.contentWidth === contentWidth
  ) {
    return {
      lineMap: runtime.lineMapCache.lineMap,
      lineMapCache: runtime.lineMapCache,
    };
  }

  const lineMap = computeLineMap(runtime.reader.words, contentWidth);
  return {
    lineMap,
    lineMapCache: {
      words: runtime.reader.words,
      contentWidth,
      lineMap,
    },
  };
}

function stepReaderByLine(reader: Reader, lineMap: LineMap, direction: "next" | "prev"): Reader {
  if (reader.words.length === 0 || reader.state === "finished") {
    return reader;
  }

  const pausedReader: Reader =
    reader.state === "playing" ? { ...reader, state: "paused" } : reader;

  if (direction === "next") {
    const nextIndex = getNextLineStartIndex(lineMap, pausedReader.currentIndex);
    if (nextIndex === pausedReader.currentIndex) {
      return {
        ...pausedReader,
        currentIndex: getLastWordIndexForLine(
          lineMap,
          lineMap.totalLines - 1
        ),
      };
    }

    return {
      ...pausedReader,
      currentIndex: nextIndex,
    };
  }

  return {
    ...pausedReader,
    currentIndex: getPreviousLineStartIndex(lineMap, pausedReader.currentIndex),
  };
}

export function createAgentReaderRuntime(
  words: Word[],
  initialWpm = 300,
  textScale: TextScalePreset = DEFAULT_TEXT_SCALE,
  readingMode: ReadingMode = DEFAULT_READING_MODE
): AgentReaderRuntime {
  const sourceWords = words;
  const transformedWords = transformWordsForMode(sourceWords, readingMode);
  const modeWordCache: ModeWordCache = {
    rsvp: sourceWords,
    [readingMode]: transformedWords,
  };

  return {
    reader: createReader(transformedWords, initialWpm),
    session: createSession(initialWpm),
    textScale,
    readingMode,
    sourceWords,
    sourceText: wordsToSourceText(sourceWords),
    modeWordCache,
    lineMapCache: null,
    summary: {
      enabled: false,
      preset: DEFAULT_SUMMARY_PRESET,
      provider: null,
      model: null,
      sourceLabel: null,
    },
    keyPhrases: [],
  };
}

function buildAgentIngestResult(
  document: AgentIngestDocument,
  options: AgentIngestRuntimeOptions,
  readingMode: ReadingMode
): { runtime: AgentReaderRuntime; sourceLabel: string; wordCount: number } {
  const runtime = createAgentReaderRuntime(
    tokenize(document.content),
    options.initialWpm ?? 300,
    options.textScale ?? DEFAULT_TEXT_SCALE,
    readingMode
  );

  return {
    runtime,
    sourceLabel: document.source,
    wordCount: document.wordCount,
  };
}

export async function executeAgentIngestUrlCommand(
  command: AgentIngestUrlCommand,
  readUrlFn: typeof readUrl = readUrl
): Promise<AgentIngestUrlResult> {
  const readingMode =
    command.readingMode === undefined
      ? DEFAULT_READING_MODE
      : requireReadingMode(command.readingMode, "ingest_url command");
  const document = await readUrlFn(command.url, command.readUrlOptions);
  return buildAgentIngestResult(document, command, readingMode);
}

export async function executeAgentIngestFileCommand(
  command: AgentIngestFileCommand,
  readFileSourceFn: typeof readFileSource = readFileSource
): Promise<AgentIngestFileResult> {
  const readingMode =
    command.readingMode === undefined
      ? DEFAULT_READING_MODE
      : requireReadingMode(command.readingMode, "ingest_file command");
  let document: Awaited<ReturnType<typeof readFileSource>>;
  try {
    document = await readFileSourceFn(command.path);
  } catch (error: unknown) {
    throw toAgentIngestFileError(error, command.path);
  }

  return buildAgentIngestResult(document, command, readingMode);
}

export async function executeAgentIngestClipboardCommand(
  command: AgentIngestClipboardCommand,
  readClipboardFn: typeof readClipboard = readClipboard
): Promise<AgentIngestClipboardResult> {
  const readingMode =
    command.readingMode === undefined
      ? DEFAULT_READING_MODE
      : requireReadingMode(command.readingMode, "ingest_clipboard command");
  let document: Awaited<ReturnType<typeof readClipboard>>;
  try {
    document = await readClipboardFn();
  } catch (error: unknown) {
    throw toAgentIngestClipboardError(error);
  }

  return buildAgentIngestResult(document, command, readingMode);
}

function isEpubPath(path: string): boolean {
  return path.toLowerCase().endsWith(".epub");
}

function isMarkdownPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return lowerPath.endsWith(".md") || lowerPath.endsWith(".markdown");
}

function toAgentIngestFileError(
  error: unknown,
  sourcePath?: string
): AgentIngestFileError {
  if (error instanceof IngestFileError) {
    switch (error.code) {
      case "FILE_NOT_FOUND":
        return new AgentIngestFileError("FILE_NOT_FOUND", error.message);
      case "INPUT_TOO_LARGE":
        return new AgentIngestFileError("INPUT_TOO_LARGE", error.message);
      case "BINARY_FILE":
        if (sourcePath && isMarkdownPath(sourcePath)) {
          return new AgentIngestFileError("MARKDOWN_BINARY", error.message);
        }
        return new AgentIngestFileError("BINARY_FILE", error.message);
      case "MARKDOWN_EMPTY_TEXT":
        return new AgentIngestFileError("MARKDOWN_EMPTY_TEXT", error.message);
      case "MARKDOWN_PARSE_FAILED":
        return new AgentIngestFileError("MARKDOWN_PARSE_FAILED", "Failed to parse Markdown file");
      default:
        break;
    }
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message === "File not found") {
    return new AgentIngestFileError("FILE_NOT_FOUND", message);
  }

  if (message === "Invalid or corrupted PDF file") {
    return new AgentIngestFileError("PDF_INVALID", message);
  }

  if (message === "PDF is encrypted or password-protected") {
    return new AgentIngestFileError("PDF_ENCRYPTED", message);
  }

  if (message === "PDF has no extractable text") {
    return new AgentIngestFileError("PDF_EMPTY_TEXT", message);
  }

  if (message === "Invalid or corrupted EPUB file") {
    return new AgentIngestFileError("EPUB_INVALID", message);
  }

  if (message === "EPUB is encrypted or DRM-protected") {
    return new AgentIngestFileError("EPUB_ENCRYPTED", message);
  }

  if (message === "EPUB has no extractable text") {
    return new AgentIngestFileError("EPUB_EMPTY_TEXT", message);
  }

  if (message === "Markdown has no readable text") {
    return new AgentIngestFileError("MARKDOWN_EMPTY_TEXT", message);
  }

  if (message === "Binary file detected") {
    if (sourcePath && isMarkdownPath(sourcePath)) {
      return new AgentIngestFileError("MARKDOWN_BINARY", message);
    }
    return new AgentIngestFileError("BINARY_FILE", message);
  }

  if (message === "Input exceeds maximum supported size") {
    return new AgentIngestFileError("INPUT_TOO_LARGE", message);
  }

  if (message === "EPUB parsing timed out" || message === "Failed to parse EPUB file") {
    return new AgentIngestFileError("EPUB_PARSE_FAILED", "Failed to parse EPUB file");
  }

  if (message === "Markdown parsing timed out" || message === "Failed to parse Markdown file") {
    return new AgentIngestFileError("MARKDOWN_PARSE_FAILED", "Failed to parse Markdown file");
  }

  if (sourcePath && isMarkdownPath(sourcePath)) {
    return new AgentIngestFileError("MARKDOWN_PARSE_FAILED", "Failed to parse Markdown file");
  }

  if (sourcePath && isEpubPath(sourcePath)) {
    return new AgentIngestFileError("EPUB_PARSE_FAILED", "Failed to parse EPUB file");
  }

  return new AgentIngestFileError("PDF_PARSE_FAILED", "Failed to parse PDF file");
}

function toAgentIngestClipboardError(error: unknown): AgentIngestClipboardError {
  if (error instanceof IngestFileError) {
    switch (error.code) {
      case "CLIPBOARD_EMPTY":
        return new AgentIngestClipboardError("CLIPBOARD_EMPTY", error.message);
      case "CLIPBOARD_UNAVAILABLE":
        return new AgentIngestClipboardError("CLIPBOARD_UNAVAILABLE", error.message);
      case "CLIPBOARD_PERMISSION_DENIED":
        return new AgentIngestClipboardError("CLIPBOARD_PERMISSION_DENIED", error.message);
      case "INPUT_TOO_LARGE":
        return new AgentIngestClipboardError("INPUT_TOO_LARGE", error.message);
      case "CLIPBOARD_READ_FAILED":
        return new AgentIngestClipboardError("CLIPBOARD_READ_FAILED", error.message);
      default:
        break;
    }
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message === "Clipboard is empty") {
    return new AgentIngestClipboardError("CLIPBOARD_EMPTY", message);
  }

  if (message === "Clipboard is unavailable on this system") {
    return new AgentIngestClipboardError("CLIPBOARD_UNAVAILABLE", message);
  }

  if (message === "Clipboard access denied") {
    return new AgentIngestClipboardError("CLIPBOARD_PERMISSION_DENIED", message);
  }

  if (message === "Input exceeds maximum supported size") {
    return new AgentIngestClipboardError("INPUT_TOO_LARGE", message);
  }

  return new AgentIngestClipboardError("CLIPBOARD_READ_FAILED", "Failed to read clipboard");
}

export async function executeAgentSummarizeCommand(
  runtime: AgentReaderRuntime,
  command: AgentSummarizeCommand,
  summarize: typeof summarizeText = summarizeText
): Promise<AgentReaderRuntime> {
  const readingMode =
    command.readingMode === undefined
      ? runtime.readingMode
      : requireReadingMode(command.readingMode, "summarize command");
  const runtimeBounds = normalizeLlmRuntimeBounds(command.llmConfig);
  const timeoutOutcome = resolveAgentTimeoutOutcome(command.timeoutOutcome);

  const originalContent = runtime.sourceText;
  let summaryContent: string;
  try {
    summaryContent = await summarize({
      provider: command.llmConfig.provider,
      model: command.llmConfig.model,
        apiKey: command.llmConfig.apiKey,
        preset: command.preset,
        input: originalContent,
        timeoutMs: runtimeBounds.timeoutMs,
        maxRetries: runtimeBounds.maxRetries,
        signal: command.signal,
      });
  } catch (error: unknown) {
    if (error instanceof SummarizeRuntimeError) {
      if (error.stage === "timeout" && timeoutOutcome === "continue") {
        return runtime;
      }

      const provider = sanitizeTerminalText(command.llmConfig.provider);
      const model = sanitizeTerminalText(command.llmConfig.model);
      const safeMessage = sanitizeRuntimeMessage(error.message, command.llmConfig.apiKey);
      throw new SummarizeRuntimeError(
        `${safeMessage} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new SummarizeRuntimeError(
      `Summarization failed [runtime]: ${sanitizeRuntimeMessage(message, command.llmConfig.apiKey)}`,
      "runtime"
    );
  }

  const summaryWords = tokenize(summaryContent);
  const { words: transformedSummaryWords, modeWordCache } = getWordsForMode(
    summaryWords,
    readingMode,
    { rsvp: summaryWords }
  );
  const currentWpm = runtime.reader.currentWpm;

  return {
    reader: createReader(transformedSummaryWords, currentWpm),
    session: createSession(currentWpm),
    textScale: runtime.textScale,
    readingMode,
    sourceWords: summaryWords,
    sourceText: wordsToSourceText(summaryWords),
    modeWordCache,
    lineMapCache: null,
    summary: {
      enabled: true,
      preset: command.preset,
      provider: command.llmConfig.provider,
      model: command.llmConfig.model,
      sourceLabel: buildSummarySourceLabel(
        command.sourceLabel,
        command.preset,
        readingMode
      ),
    },
    keyPhrases: [],
  };
}

export async function executeAgentNoBsCommand(
  runtime: AgentReaderRuntime,
  command: AgentNoBsCommand,
  runNoBs: typeof noBsText = noBsText,
  cleanText: typeof applyDeterministicNoBs = applyDeterministicNoBs
): Promise<AgentReaderRuntime> {
  const readingMode =
    command.readingMode === undefined
      ? runtime.readingMode
      : requireReadingMode(command.readingMode, "no-bs command");
  const runtimeBounds = normalizeLlmRuntimeBounds(command.llmConfig);
  const timeoutOutcome = resolveAgentTimeoutOutcome(command.timeoutOutcome);

  const originalContent = runtime.sourceText;
  const deterministicCleaned = cleanText(originalContent);
  if (!deterministicCleaned.trim()) {
    throw new NoBsRuntimeError("No-BS failed [schema]: no-bs produced empty text.", "schema");
  }

  let cleanedContent: string;
  try {
    cleanedContent = await runNoBs({
      provider: command.llmConfig.provider,
        model: command.llmConfig.model,
        apiKey: command.llmConfig.apiKey,
        input: deterministicCleaned,
        timeoutMs: runtimeBounds.timeoutMs,
        maxRetries: runtimeBounds.maxRetries,
        signal: command.signal,
      });
  } catch (error: unknown) {
    if (error instanceof NoBsRuntimeError) {
      if (error.stage === "timeout" && timeoutOutcome === "continue") {
        return runtime;
      }

      const provider = sanitizeTerminalText(command.llmConfig.provider);
      const model = sanitizeTerminalText(command.llmConfig.model);
      const safeMessage = sanitizeRuntimeMessage(error.message, command.llmConfig.apiKey);
      throw new NoBsRuntimeError(
        `${safeMessage} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new NoBsRuntimeError(
      `No-BS failed [runtime]: ${sanitizeRuntimeMessage(message, command.llmConfig.apiKey)}`,
      "runtime"
    );
  }

  const cleanedWords = tokenize(cleanedContent);
  const { words: transformedWords, modeWordCache } = getWordsForMode(
    cleanedWords,
    readingMode,
    { rsvp: cleanedWords }
  );
  const currentWpm = runtime.reader.currentWpm;

  return {
    reader: createReader(transformedWords, currentWpm),
    session: createSession(currentWpm),
    textScale: runtime.textScale,
    readingMode,
    sourceWords: cleanedWords,
    sourceText: wordsToSourceText(cleanedWords),
    modeWordCache,
    lineMapCache: null,
    summary: {
      enabled: false,
      preset: DEFAULT_SUMMARY_PRESET,
      provider: null,
      model: null,
      sourceLabel: `${command.sourceLabel} (no-bs)`,
    },
    keyPhrases: [],
  };
}

export async function executeAgentTranslateCommand(
  runtime: AgentReaderRuntime,
  command: AgentTranslateCommand,
  normalizeTarget: typeof normalizeTargetLanguage = normalizeTargetLanguage,
  runTranslate: typeof translateText = translateText
): Promise<AgentReaderRuntime> {
  const readingMode =
    command.readingMode === undefined
      ? runtime.readingMode
      : requireReadingMode(command.readingMode, "translate command");
  const runtimeBounds = normalizeLlmRuntimeBounds(command.llmConfig);
  const timeoutOutcome = resolveAgentTimeoutOutcome(command.timeoutOutcome);

  let targetLanguage: string;
  try {
    targetLanguage = await normalizeTarget({
      target: command.target,
      provider: command.llmConfig.provider,
        model: command.llmConfig.model,
        apiKey: command.llmConfig.apiKey,
        timeoutMs: runtimeBounds.timeoutMs,
        maxRetries: runtimeBounds.maxRetries,
      });
  } catch (error: unknown) {
    if (error instanceof LanguageNormalizationError) {
      throw new UsageError(error.message);
    }
    throw error;
  }

  const originalContent = runtime.sourceText;
  const chunkCount = splitIntoTranslationChunks(originalContent).length;
  const chunkWaves = Math.max(1, Math.ceil(chunkCount / DEFAULT_TRANSLATE_CONCURRENCY));
  const baseTimeoutMs = resolveAdaptiveTimeoutMs(runtimeBounds.timeoutMs, originalContent);
  const timeoutMs = Math.min(baseTimeoutMs * chunkWaves, runtimeBounds.timeoutMs * 12);
  const timeoutDeadlineMs = createTimeoutDeadline(timeoutMs);

  let translatedContent: string;
  try {
    translatedContent = await translateContentInChunks({
      content: originalContent,
      translateChunk: async (chunk) =>
        runTranslate({
          provider: command.llmConfig.provider,
          model: command.llmConfig.model,
          apiKey: command.llmConfig.apiKey,
          targetLanguage,
          input: chunk,
          timeoutMs,
          maxRetries: runtimeBounds.maxRetries,
          signal: command.signal,
          timeoutDeadlineMs,
        }),
    });
  } catch (error: unknown) {
    if (error instanceof TranslateRuntimeError) {
      if (error.stage === "timeout" && timeoutOutcome === "continue") {
        return runtime;
      }

      const provider = sanitizeTerminalText(command.llmConfig.provider);
      const model = sanitizeTerminalText(command.llmConfig.model);
      const safeMessage = sanitizeRuntimeMessage(error.message, command.llmConfig.apiKey);
      throw new TranslateRuntimeError(
        `${safeMessage} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new TranslateRuntimeError(
      `Translation failed [runtime]: ${sanitizeRuntimeMessage(message, command.llmConfig.apiKey)}`,
      "runtime"
    );
  }

  const translatedWords = tokenize(translatedContent);
  const { words: transformedWords, modeWordCache } = getWordsForMode(
    translatedWords,
    readingMode,
    { rsvp: translatedWords }
  );
  const currentWpm = runtime.reader.currentWpm;

  return {
    reader: createReader(transformedWords, currentWpm),
    session: createSession(currentWpm),
    textScale: runtime.textScale,
    readingMode,
    sourceWords: translatedWords,
    sourceText: wordsToSourceText(translatedWords),
    modeWordCache,
    lineMapCache: null,
    summary: {
      enabled: false,
      preset: DEFAULT_SUMMARY_PRESET,
      provider: null,
      model: null,
      sourceLabel: buildTranslatedSourceLabel(command.sourceLabel, targetLanguage, readingMode),
    },
    keyPhrases: [],
  };
}

export async function executeAgentKeyPhrasesCommand(
  runtime: AgentReaderRuntime,
  command: AgentKeyPhrasesCommand,
  runExtract: typeof extractKeyPhrases = extractKeyPhrases
): Promise<AgentReaderRuntime> {
  const readingMode =
    command.readingMode === undefined
      ? runtime.readingMode
      : requireReadingMode(command.readingMode, "key-phrases command");
  const mode = resolveKeyPhrasesMode(command.mode);
  const runtimeBounds = normalizeLlmRuntimeBounds(command.llmConfig);
  const timeoutOutcome = resolveAgentTimeoutOutcome(command.timeoutOutcome);

  const maxPhrases = Math.min(
    10,
    Math.max(5, command.maxPhrases ?? DEFAULT_KEY_PHRASES_MAX_PHRASES)
  );

  const originalContent = runtime.sourceText;
  let keyPhrases: string[];
  try {
    keyPhrases = await runExtract({
      provider: command.llmConfig.provider,
      model: command.llmConfig.model,
      apiKey: command.llmConfig.apiKey,
      input: originalContent,
      maxPhrases,
      timeoutMs: runtimeBounds.timeoutMs,
      maxRetries: runtimeBounds.maxRetries,
      signal: command.signal,
    });
  } catch (error: unknown) {
    if (error instanceof KeyPhrasesRuntimeError) {
      if (error.stage === "timeout" && timeoutOutcome === "continue") {
        return runtime;
      }

      const provider = sanitizeTerminalText(command.llmConfig.provider);
      const model = sanitizeTerminalText(command.llmConfig.model);
      const safeMessage = sanitizeRuntimeMessage(error.message, command.llmConfig.apiKey);
      throw new KeyPhrasesRuntimeError(
        `${safeMessage} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new KeyPhrasesRuntimeError(
      `Key-phrases failed [runtime]: ${sanitizeRuntimeMessage(message, command.llmConfig.apiKey)}`,
      "runtime"
    );
  }

  if (keyPhrases.length === 0) {
    throw new KeyPhrasesRuntimeError(
      "Key-phrases failed [schema]: extracted key phrases are empty.",
      "schema"
    );
  }

  if (mode === "list") {
    return {
      ...runtime,
      keyPhrases,
    };
  }

  const annotatedSourceWords = annotateWordsWithKeyPhrases(runtime.sourceWords, keyPhrases);
  const { words: transformedWords, modeWordCache } = getWordsForMode(
    annotatedSourceWords,
    readingMode,
    { rsvp: annotatedSourceWords }
  );
  const currentWpm = runtime.reader.currentWpm;

  return {
    reader: createReader(transformedWords, currentWpm),
    session: createSession(currentWpm),
    textScale: runtime.textScale,
    readingMode,
    sourceWords: annotatedSourceWords,
    sourceText: runtime.sourceText,
    modeWordCache,
    lineMapCache: null,
    summary: {
      enabled: false,
      preset: DEFAULT_SUMMARY_PRESET,
      provider: null,
      model: null,
      sourceLabel: `${command.sourceLabel} (key-phrases)`,
    },
    keyPhrases,
  };
}

export async function executeAgentStrategyCommand(
  runtime: AgentReaderRuntime,
  command: AgentStrategyCommand,
  runStrategy: typeof recommendStrategy = recommendStrategy
): Promise<AgentStrategyResult> {
  const selectedMode =
    command.selectedMode === undefined
      ? runtime.readingMode
      : requireReadingMode(command.selectedMode, "strategy command");
  const explicitModeProvided = command.explicitModeProvided ?? false;

  const sourceContent = runtime.sourceText;

  const strategyResult = await strategyBeforeRsvp({
    documentContent: sourceContent,
    strategyOption: resolveStrategyOption(true),
    selectedMode,
    explicitModeProvided,
    signal: command.signal,
    captureSigInt: false,
    loadConfig: () => ({
      provider: command.llmConfig.provider,
      model: command.llmConfig.model,
      apiKey: command.llmConfig.apiKey,
      defaultPreset: DEFAULT_SUMMARY_PRESET,
      timeoutMs: command.llmConfig.timeoutMs,
      maxRetries: command.llmConfig.maxRetries,
    }),
    recommend: runStrategy,
    createLoading: () => ({
      start: () => {},
      stop: () => {},
      succeed: () => {},
      fail: () => {},
    }),
  });

  const appliedMode = resolveModeAfterStrategy({
    selectedMode,
    explicitModeProvided,
    recommendedMode: strategyResult.recommendedMode,
  });

  const nextRuntime =
    appliedMode === runtime.readingMode
      ? runtime
      : executeAgentCommand(runtime, {
          type: "set_reading_mode",
          readingMode: appliedMode,
        });

  return {
    runtime: nextRuntime,
    recommendedMode: strategyResult.recommendedMode,
    appliedMode,
    rationale: strategyResult.rationale,
    warning: strategyResult.warning,
  };
}

export function executeAgentCommand(
  runtime: AgentReaderRuntime,
  command: AgentReaderCommand,
  nowMs = Date.now()
): AgentReaderRuntime {
  let nextReader: Reader;
  let nextLineMapCache = runtime.lineMapCache;

  switch (command.type) {
    case "play_pause":
      nextReader = togglePlayPause(runtime.reader);
      break;
    case "step_next":
      nextReader = stepForward(runtime.reader);
      break;
    case "step_prev":
      nextReader = stepBackward(runtime.reader);
      break;
    case "step_next_line":
      ({ lineMapCache: nextLineMapCache } = getCachedLineMap(
        runtime,
        command.contentWidth ?? AGENT_SCROLL_CONTENT_WIDTH
      ));
      nextReader = stepReaderByLine(runtime.reader, nextLineMapCache.lineMap, "next");
      break;
    case "step_prev_line":
      ({ lineMapCache: nextLineMapCache } = getCachedLineMap(
        runtime,
        command.contentWidth ?? AGENT_SCROLL_CONTENT_WIDTH
      ));
      nextReader = stepReaderByLine(runtime.reader, nextLineMapCache.lineMap, "prev");
      break;
    case "jump_next_paragraph":
      nextReader = jumpToNextParagraph(runtime.reader);
      break;
    case "jump_prev_paragraph":
      nextReader = jumpToPreviousParagraph(runtime.reader);
      break;
    case "set_wpm_delta":
      nextReader = adjustWpm(runtime.reader, command.delta);
      break;
    case "set_text_scale":
      return {
        ...runtime,
        textScale: command.textScale,
      };
    case "set_reading_mode": {
      const readingMode = requireReadingMode(
        command.readingMode,
        "set_reading_mode command"
      );
      if (readingMode === runtime.readingMode) {
        return runtime;
      }

      const { words: transformedWords, modeWordCache } = getWordsForMode(
        runtime.sourceWords,
        readingMode,
        runtime.modeWordCache
      );
      const currentWpm = runtime.reader.currentWpm;
      const baseReader = createReader(transformedWords, currentWpm);
      const targetIndex = mapPositionToNewWords(
        runtime.reader.currentIndex,
        runtime.reader.words,
        transformedWords
      );
      let session = runtime.session;
      if (runtime.reader.state === "playing") {
        session = markPaused(session, nowMs);
      }

      return {
        ...runtime,
        reader: {
          ...baseReader,
          currentIndex: targetIndex,
          state: runtime.reader.state === "finished" ? "finished" : "paused",
        },
        session,
        readingMode,
        modeWordCache,
        lineMapCache: null,
      };
    }
    case "restart":
      nextReader = restartReader(runtime.reader);
      return {
        reader: nextReader,
        session: createSession(nextReader.currentWpm),
        textScale: runtime.textScale,
        readingMode: runtime.readingMode,
        sourceWords: runtime.sourceWords,
        sourceText: runtime.sourceText,
        modeWordCache: runtime.modeWordCache,
        lineMapCache: runtime.lineMapCache,
        summary: runtime.summary,
        keyPhrases: runtime.keyPhrases,
      };
    default: {
      const unreachable: never = command;
      throw new Error(`Unsupported command: ${JSON.stringify(unreachable)}`);
    }
  }

  return {
    reader: nextReader,
    session: applyReaderAndSession(runtime.reader, runtime.session, nextReader, nowMs),
    textScale: runtime.textScale,
    readingMode: runtime.readingMode,
    sourceWords: runtime.sourceWords,
    sourceText: runtime.sourceText,
    modeWordCache: runtime.modeWordCache,
    lineMapCache: nextReader.words === runtime.reader.words ? nextLineMapCache : null,
    summary: runtime.summary,
    keyPhrases: runtime.keyPhrases,
  };
}

export function getAgentReaderState(runtime: AgentReaderRuntime): AgentReaderState {
  const { reader, session } = runtime;
  const totalWords = reader.words.length;
  const progress = totalWords <= 1 ? 1 : reader.currentIndex / (totalWords - 1);

  return {
    mode: reader.state,
    currentIndex: reader.currentIndex,
    currentWord: reader.words[reader.currentIndex]?.text ?? "",
    currentWpm: reader.currentWpm,
    textScale: runtime.textScale,
    readingMode: runtime.readingMode,
    totalWords,
    progress,
    wordsRead: session.wordsRead,
    summaryEnabled: runtime.summary.enabled,
    summaryPreset: runtime.summary.preset,
    summaryProvider: runtime.summary.provider,
    summaryModel: runtime.summary.model,
    summarySourceLabel: runtime.summary.sourceLabel,
    keyPhrases: runtime.keyPhrases,
    keyPhrasesCount: runtime.keyPhrases.length,
  };
}
