import { applyBionicMode } from "../processor/bionic";
import { chunkWords } from "../processor/chunker";
import { transformWordsForMode } from "../processor/mode-transform";
import { tokenize } from "../processor/tokenizer";
import type { Word } from "../processor/types";
import type { ReadingMode } from "./mode-option";
import type { SummaryOption } from "./summary-option";

interface ReadingPipelineInput {
  documentContent: string;
  sourceLabel: string;
  summaryOption: SummaryOption;
  mode: ReadingMode;
}

interface ReadingPipelineDeps {
  summarizeBefore?: (input: {
    documentContent: string;
    sourceLabel: string;
    summaryOption: SummaryOption;
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
          documentContent: input.documentContent,
          sourceLabel: input.sourceLabel,
          summaryOption: input.summaryOption,
        });
      })()
    : {
        readingContent: input.documentContent,
        sourceLabel: input.sourceLabel,
      };

  const tokenized = tokenizeFn(summaryResult.readingContent);
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
    sourceLabel: summaryResult.sourceLabel,
  };
}
