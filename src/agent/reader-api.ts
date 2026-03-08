import {
  DEFAULT_READING_MODE,
  READING_MODES,
  type ReadingMode,
} from "../cli/mode-option";
import {
  DEFAULT_SUMMARY_PRESET,
  type SummaryPreset,
} from "../cli/summary-option";
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
import { summarizeText } from "../llm/summarize";
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
import { readUrl, type ReadUrlOptions } from "../ingest/url";

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

export interface AgentReaderRuntime {
  reader: Reader;
  session: Session;
  textScale: TextScalePreset;
  readingMode: ReadingMode;
  sourceWords: Word[];
  modeWordCache: ModeWordCache;
  lineMapCache: AgentLineMapCache | null;
  summary: AgentSummaryContext;
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
}

interface AgentSummarizeCommand {
  preset: SummaryPreset;
  sourceLabel: string;
  readingMode?: ReadingMode;
  llmConfig: Pick<LLMConfig, "provider" | "model" | "apiKey" | "timeoutMs" | "maxRetries">;
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

const AGENT_SCROLL_CONTENT_WIDTH = 78;

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
    modeWordCache,
    lineMapCache: null,
    summary: {
      enabled: false,
      preset: DEFAULT_SUMMARY_PRESET,
      provider: null,
      model: null,
      sourceLabel: null,
    },
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
  const runtime = createAgentReaderRuntime(
    tokenize(document.content),
    command.initialWpm ?? 300,
    command.textScale ?? DEFAULT_TEXT_SCALE,
    readingMode
  );

  return {
    runtime,
    sourceLabel: document.source,
    wordCount: document.wordCount,
  };
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

  const originalContent = runtime.sourceWords.map((word) => word.text).join(" ");
  const summaryContent = await summarize({
    provider: command.llmConfig.provider,
    model: command.llmConfig.model,
    apiKey: command.llmConfig.apiKey,
    preset: command.preset,
    input: originalContent,
    timeoutMs: command.llmConfig.timeoutMs,
    maxRetries: command.llmConfig.maxRetries,
  });

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
        modeWordCache: runtime.modeWordCache,
        lineMapCache: runtime.lineMapCache,
        summary: runtime.summary,
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
    modeWordCache: runtime.modeWordCache,
    lineMapCache: nextReader.words === runtime.reader.words ? nextLineMapCache : null,
    summary: runtime.summary,
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
  };
}
