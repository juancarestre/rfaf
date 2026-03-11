export type RuntimeStepUnit = "word" | "chunk" | "line";

interface RuntimeControlEntry {
  key: string;
  action: string | ((stepUnit: RuntimeStepUnit) => string);
  cli?: string;
  status?: string;
}

const controls = {
  playPause: {
    key: "Space",
    action: "play/pause",
    cli: "Space play/pause",
  },
  switchMode: {
    key: "1-4",
    action: "switch mode",
    cli: "1-4 switch mode",
  },
  stepForward: {
    key: "l / Right",
    action: (stepUnit: RuntimeStepUnit) => `step forward (${stepUnit})`,
    cli: "Left/Right step",
    status: "←/→ nav",
  },
  stepBackward: {
    key: "h / Left",
    action: (stepUnit: RuntimeStepUnit) => `step backward (${stepUnit})`,
  },
  nextParagraph: {
    key: "p",
    action: "next paragraph",
    cli: "p/b paragraph",
  },
  previousParagraph: {
    key: "b",
    action: "previous paragraph",
  },
  speedUp: {
    key: "k / Up",
    action: "+25 WPM",
    cli: "Up/Down WPM",
    status: "↑/↓ speed",
  },
  speedDown: {
    key: "j / Down",
    action: "-25 WPM",
  },
  restart: {
    key: "r",
    action: "restart",
    cli: "r restart",
    status: "r restart",
  },
  quit: {
    key: "q",
    action: "quit",
    cli: "q quit",
    status: "q quit",
  },
  helpToggle: {
    key: "?",
    action: "toggle help overlay",
    cli: "? toggle help",
    status: "? help",
  },
  helpClose: {
    key: "Esc",
    action: "close help overlay",
    cli: "Esc close help",
  },
} satisfies Record<string, RuntimeControlEntry>;

function resolveAction(
  action: RuntimeControlEntry["action"],
  stepUnit: RuntimeStepUnit
): string {
  return typeof action === "function" ? action(stepUnit) : action;
}

export interface RuntimeControlGroup {
  heading: string;
  rows: Array<{ key: string; action: string }>;
}

export function getHelpOverlayGroups(stepUnit: RuntimeStepUnit): RuntimeControlGroup[] {
  return [
    {
      heading: "Playback",
      rows: [{ key: controls.playPause.key, action: resolveAction(controls.playPause.action, stepUnit) }],
    },
    {
      heading: "Mode",
      rows: [{ key: controls.switchMode.key, action: resolveAction(controls.switchMode.action, stepUnit) }],
    },
    {
      heading: "Navigation",
      rows: [
        { key: controls.stepForward.key, action: resolveAction(controls.stepForward.action, stepUnit) },
        { key: controls.stepBackward.key, action: resolveAction(controls.stepBackward.action, stepUnit) },
        { key: controls.nextParagraph.key, action: resolveAction(controls.nextParagraph.action, stepUnit) },
        {
          key: controls.previousParagraph.key,
          action: resolveAction(controls.previousParagraph.action, stepUnit),
        },
      ],
    },
    {
      heading: "Speed",
      rows: [
        { key: controls.speedUp.key, action: resolveAction(controls.speedUp.action, stepUnit) },
        { key: controls.speedDown.key, action: resolveAction(controls.speedDown.action, stepUnit) },
      ],
    },
    {
      heading: "Session",
      rows: [
        { key: controls.restart.key, action: resolveAction(controls.restart.action, stepUnit) },
        { key: controls.quit.key, action: resolveAction(controls.quit.action, stepUnit) },
        { key: controls.helpToggle.key, action: resolveAction(controls.helpToggle.action, stepUnit) },
        { key: controls.helpClose.key, action: resolveAction(controls.helpClose.action, stepUnit) },
      ],
    },
  ];
}

export function getCliRuntimeControlLines(): string[] {
  return [
    `${controls.playPause.cli} | ${controls.stepForward.cli} | ${controls.speedUp.cli}`,
    `${controls.nextParagraph.cli} | ${controls.restart.cli} | ${controls.switchMode.cli}`,
    `${controls.helpToggle.cli} | ${controls.helpClose.cli} | ${controls.quit.cli}`,
  ];
}

export function getStatusRuntimeHint(variant: "full" | "compact" = "full"): string {
  if (variant === "compact") {
    return controls.helpToggle.status ?? "? help";
  }

  return [
    controls.helpToggle.status,
    controls.stepForward.status,
    controls.speedUp.status,
    controls.restart.status,
    controls.quit.status,
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}
