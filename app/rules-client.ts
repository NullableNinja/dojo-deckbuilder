export type RulesSyncState = {
  status: "checking" | "current" | "update-available" | "offline";
  currentVersion: string;
  latestVersion: string;
  checkedAt: number;
};

type RulesManifest = {
  schemaVersion: number;
  rulesVersion: string;
  refreshIntervalMs: number;
  activeMatchPolicy: "pin-until-match-ends";
};

export async function fetchRulesManifest(signal?: AbortSignal): Promise<RulesManifest> {
  const base = import.meta.env.BASE_URL;
  const response = await fetch(`${base}rules-manifest.json?stamp=${Date.now()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Rules manifest returned ${response.status}`);
  return response.json() as Promise<RulesManifest>;
}

export function rulesSyncState(currentVersion: string, latestVersion: string): RulesSyncState {
  return {
    status: currentVersion === latestVersion ? "current" : "update-available",
    currentVersion,
    latestVersion,
    checkedAt: Date.now(),
  };
}
