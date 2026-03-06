import {
  DEFAULT_READING_MODE,
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
import {
  createSession,
  markPaused,
  markPlayStarted,
  markWordAdvanced,
  type Session,
} from "../engine/session";
import { summarizeText } from "../llm/summarize";
import { applyBionicMode } from "../processor/bionic";
import { chunkWords } from "../processor/chunker";
import { tokenize } from "../processor/tokenizer";
import type { Word } from "../processor/types";

interface AgentSummaryContext {
  enabled: boolean;
  preset: SummaryPreset;
  provider: LLMConfig["provider"] | null;
  model: string | null;
  sourceLabel: string | null;
}

export interface AgentReaderRuntime {
  reader: Reader;
  session: Session;
  textScale: TextScalePreset;
  readingMode: ReadingMode;
  sourceWords: Word[];
  summary: AgentSummaryContext;
}

export type AgentReaderCommand =
  | { type: "play_pause" }
  | { type: "step_next" }
  | { type: "step_prev" }
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

function transformWordsForMode(words: Word[], readingMode: ReadingMode): Word[] {
  if (readingMode === "chunked") {
    return chunkWords(words);
  }

  if (readingMode === "bionic") {
    return applyBionicMode(words);
  }

  return words;
}

function buildSummarySourceLabel(
  sourceLabel: string,
  preset: SummaryPreset,
  readingMode: ReadingMode
): string {
  const base = `${sourceLabel} (summary:${preset})`;
  return readingMode === "rsvp" ? base : `${base} [${readingMode}]`;
}

function syncSession(
  currentReader: Reader,
  currentSession: Session,
  nextReader: Reader,
  nowMs: number
): Session {
  let nextSession = currentSession;

  if (currentReader.state !== "playing" && nextReader.state === "playing") {
    nextSession = markPlayStarted(nextSession, nowMs);
  }

  if (currentReader.state === "playing" && nextReader.state !== "playing") {
    nextSession = markPaused(nextSession, nowMs);
  }

  if (
    currentReader.state === "playing" &&
    nextReader.currentIndex > currentReader.currentIndex
  ) {
    const steps = nextReader.currentIndex - currentReader.currentIndex;
    for (let i = 0; i < steps; i++) {
      nextSession = markWordAdvanced(nextSession);
    }
  }

  if (nextSession.currentWpm !== nextReader.currentWpm) {
    nextSession = { ...nextSession, currentWpm: nextReader.currentWpm };
  }

  return nextSession;
}

export function createAgentReaderRuntime(
  words: Word[],
  initialWpm = 300,
  textScale: TextScalePreset = DEFAULT_TEXT_SCALE,
  readingMode: ReadingMode = DEFAULT_READING_MODE
): AgentReaderRuntime {
  const sourceWords = words;
  const transformedWords = transformWordsForMode(sourceWords, readingMode);

  return {
    reader: createReader(transformedWords, initialWpm),
    session: createSession(initialWpm),
    textScale,
    readingMode,
    sourceWords,
    summary: {
      enabled: false,
      preset: DEFAULT_SUMMARY_PRESET,
      provider: null,
      model: null,
      sourceLabel: null,
    },
  };
}

export async function executeAgentSummarizeCommand(
  runtime: AgentReaderRuntime,
  command: AgentSummarizeCommand,
  summarize: typeof summarizeText = summarizeText
): Promise<AgentReaderRuntime> {
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
  const readingMode = command.readingMode ?? runtime.readingMode;
  const transformedSummaryWords = transformWordsForMode(summaryWords, readingMode);
  const currentWpm = runtime.reader.currentWpm;

  return {
    reader: createReader(transformedSummaryWords, currentWpm),
    session: createSession(currentWpm),
    textScale: runtime.textScale,
    readingMode,
    sourceWords: summaryWords,
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
      const transformedWords = transformWordsForMode(
        runtime.sourceWords,
        command.readingMode
      );
      const currentWpm = runtime.reader.currentWpm;
      const baseReader = createReader(transformedWords, currentWpm);
      const progressRatio =
        runtime.reader.words.length <= 1
          ? 0
          : runtime.reader.currentIndex / (runtime.reader.words.length - 1);
      const targetIndex =
        transformedWords.length <= 1
          ? 0
          : Math.min(
              transformedWords.length - 1,
              Math.round(progressRatio * (transformedWords.length - 1))
            );

      return {
        ...runtime,
        reader: {
          ...baseReader,
          currentIndex: targetIndex,
          state: runtime.reader.state === "finished" ? "finished" : "paused",
        },
        session: createSession(currentWpm),
        readingMode: command.readingMode,
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
        summary: runtime.summary,
      };
    default: {
      const unreachable: never = command;
      throw new Error(`Unsupported command: ${JSON.stringify(unreachable)}`);
    }
  }

  return {
    reader: nextReader,
    session: syncSession(runtime.reader, runtime.session, nextReader, nowMs),
    textScale: runtime.textScale,
    readingMode: runtime.readingMode,
    sourceWords: runtime.sourceWords,
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
