export interface HelpOverlayInputParams {
  input: string;
  escape: boolean;
  helpVisible: boolean;
}

export interface HelpOverlayInputResult {
  nextHelpVisible: boolean | null;
  suppressInput: boolean;
}

type ReaderPlaybackState = "idle" | "paused" | "playing" | "finished";

export function resolveHelpOverlayInput({
  input,
  escape,
  helpVisible,
}: HelpOverlayInputParams): HelpOverlayInputResult {
  if (helpVisible) {
    if (input === "?" || escape) {
      return { nextHelpVisible: false, suppressInput: true };
    }

    return { nextHelpVisible: null, suppressInput: true };
  }

  if (input === "?") {
    return { nextHelpVisible: true, suppressInput: true };
  }

  return { nextHelpVisible: null, suppressInput: false };
}

export function shouldPauseForHelpOverlayOpen(
  readerState: ReaderPlaybackState,
  openingHelpOverlay: boolean
): boolean {
  return openingHelpOverlay && readerState === "playing";
}
