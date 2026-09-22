/**
 * Executable mode boundary for every local consumer.
 *
 * The canonical rules projection contains prose for more modes than the
 * headless engine currently implements. Only definitions declared under the
 * canonical game definition are executable. This module deliberately does
 * not infer missing mode rules from prose.
 */
export function executableModes(data) {
  const mode = data?.definition?.mode;
  if (!mode?.id) return [];
  return [{ ...structuredClone(mode), executable: true }];
}

export function modeSummary(data) {
  const executable = executableModes(data);
  const described = data?.rules?.chapters?.find((chapter) => chapter.id === "3-game-modes-victory")?.sections ?? [];
  const executableIds = new Set(executable.map((mode) => mode.id));
  return {
    executable,
    unavailable: described.filter((section) => !executableIds.has(section.id)).map((section) => ({ id: section.id, title: section.title, executable: false })),
  };
}

export function requireExecutableMode(data, requestedMode = null) {
  const requested = requestedMode || data?.definition?.mode?.id;
  const mode = executableModes(data).find((candidate) => candidate.id === requested);
  if (!mode) {
    const available = executableModes(data).map((candidate) => candidate.id).join(", ") || "none";
    throw new Error(`Mode ${requested ?? "(missing)"} is not executable in canonical rules ${data?.definition?.rulesVersion ?? "unknown"}. Executable modes: ${available}. Add the mode definition canonically before simulating it.`);
  }
  return mode;
}
