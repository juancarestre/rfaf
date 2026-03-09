import { applyBionicMode } from "../processor/bionic";
import { chunkWords } from "../processor/chunker";
import { transformWordsForMode } from "../processor/mode-transform";
import { tokenize } from "../processor/tokenizer";
import type { Word } from "../processor/types";
import type { ReadingMode } from "./mode-option";
import type { NoBsOption } from "./no-bs-option";
import type { SummaryOption } from "./summary-option";
import type { TranslateOption } from "./translate-option";

interface ReadingPipelineInput {
  documentContent: string;
  sourceLabel: string;
  noBsOption?: NoBsOption;
  summaryOption: SummaryOption;
  translateOption?: TranslateOption;
  mode: ReadingMode;
}

interface ReadingPipelineDeps {
  noBsBefore?: (input: {
    documentContent: string;
    sourceLabel: string;
    noBsOption: NoBsOption;
  }) => Promise<{ readingContent: string; sourceLabel: string }>;
  summarizeBefore?: (input: {
    documentContent: string;
    sourceLabel: string;
    summaryOption: SummaryOption;
  }) => Promise<{ readingContent: string; sourceLabel: string }>;
  translateBefore?: (input: {
    documentContent: string;
    sourceLabel: string;
    translateOption: TranslateOption;
  }) => Promise<{ readingContent: string; sourceLabel: string }>;
  tokenizeFn?: typeof tokenize;
  chunkFn?: typeof chunkWords;
  bionicFn?: typeof applyBionicMode;
}

interface ReadingPipelineResult {
  words: Word[];
  sourceWords: Word[];
  sourceLabel: string;
}

export async function buildReadingPipeline(
  input: ReadingPipelineInput,
  deps: ReadingPipelineDeps = {}
): Promise<ReadingPipelineResult> {
  const tokenizeFn = deps.tokenizeFn ?? tokenize;
  const chunkFn = deps.chunkFn ?? chunkWords;
  const bionicFn = deps.bionicFn ?? applyBionicMode;

  const noBsResult = input.noBsOption?.enabled
    ? await (async () => {
        const noBsBefore =
          deps.noBsBefore ??
          (async (noBsInput: {
            documentContent: string;
            sourceLabel: string;
            noBsOption: NoBsOption;
          }) => {
            const { noBsBeforeRsvp } = await import("./no-bs-flow");
            return noBsBeforeRsvp(noBsInput);
          });

        return noBsBefore({
          documentContent: input.documentContent,
          sourceLabel: input.sourceLabel,
          noBsOption: input.noBsOption ?? { enabled: false },
        });
      })()
    : {
        readingContent: input.documentContent,
        sourceLabel: input.sourceLabel,
      };

  const summaryResult = input.summaryOption.enabled
    ? await (async () => {
        const summarize =
          deps.summarizeBefore ??
          (async (summarizeInput: {
            documentContent: string;
            sourceLabel: string;
            summaryOption: SummaryOption;
          }) => {
            const { summarizeBeforeRsvp } = await import("./summarize-flow");
            return summarizeBeforeRsvp(summarizeInput);
          });

        return summarize({
          documentContent: noBsResult.readingContent,
          sourceLabel: noBsResult.sourceLabel,
          summaryOption: input.summaryOption,
        });
      })()
    : {
        readingContent: noBsResult.readingContent,
        sourceLabel: noBsResult.sourceLabel,
      };

  const translateResult = input.translateOption?.enabled
    ? await (async () => {
        const translate =
          deps.translateBefore ??
          (async (translateInput: {
            documentContent: string;
            sourceLabel: string;
            translateOption: TranslateOption;
          }) => {
            const { translateBeforeRsvp } = await import("./translate-flow");
            return translateBeforeRsvp(translateInput);
          });

        return translate({
          documentContent: summaryResult.readingContent,
          sourceLabel: summaryResult.sourceLabel,
          translateOption: input.translateOption ?? { enabled: false, target: null },
        });
      })()
    : {
        readingContent: summaryResult.readingContent,
        sourceLabel: summaryResult.sourceLabel,
      };

  const tokenized = tokenizeFn(translateResult.readingContent);
  const words =
    deps.chunkFn || deps.bionicFn
      ? input.mode === "chunked"
        ? chunkFn(tokenized)
        : input.mode === "bionic"
          ? bionicFn(tokenized)
          : tokenized
      : transformWordsForMode(tokenized, input.mode);

  return {
    words,
    sourceWords: tokenized,
    sourceLabel: translateResult.sourceLabel,
  };
}
