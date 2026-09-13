function objectBody(source, declarationPattern) {
  const match = source.match(declarationPattern);
  return match?.[1] ?? "";
}

export function parseCharacterResolverEvents(characterRuntimeSource) {
  const body = objectBody(
    characterRuntimeSource,
    /const resolverEvents:[^{=]*=\s*\{([\s\S]*?)\n\};/m,
  );
  const result = new Map();
  for (const match of body.matchAll(/"([^"]+)"\s*:\s*\[([^\]]*)\]/g)) {
    const events = [...match[2].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    result.set(match[1], events);
  }
  return result;
}

export function parseCharacterCompatibilityOwnership(migrationSource) {
  const body = objectBody(
    migrationSource,
    /QUICK_DUEL_CHARACTER_COMPATIBILITY_RESOLVERS:[\s\S]*?=\s*\{([\s\S]*?)\n\} as const;/m,
  );
  const result = new Map();
  for (const helperMatch of body.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\[([\s\S]*?)^\s{2}\],/gm)) {
    const helper = helperMatch[1];
    for (const resolverMatch of helperMatch[2].matchAll(/"([^"]+)"/g)) {
      result.set(resolverMatch[1], helper);
    }
  }
  return result;
}

export function classifyCharacterResolver(resolver, characterRuntimeSource, migrationSource) {
  const resolverEvents = parseCharacterResolverEvents(characterRuntimeSource);
  const compatibilityOwnership = parseCharacterCompatibilityOwnership(migrationSource);
  const events = resolverEvents.get(resolver) ?? [];
  const helper = compatibilityOwnership.get(resolver) ?? null;
  return {
    resolver,
    events,
    owner: helper ? "compatibility-helper" : "event-runtime",
    helper,
  };
}

export function characterEventHostEvidence(event, playtestSource, quickDuelHostSource) {
  const lifecycleTrigger = event === "initiate" ? "onInitiate" : event === "hide" ? "onHide" : null;
  if (lifecycleTrigger) {
    const published = new RegExp(
      `publishQuickDuelPlaytestLifecycleEvent\\([\\s\\S]{0,300}?["']${lifecycleTrigger}["']`,
      "m",
    ).test(playtestSource);
    const routed = quickDuelHostSource.includes(`trigger === "${lifecycleTrigger}"`)
      && quickDuelHostSource.includes(`? "${event}"`);
    return published && routed;
  }

  // Non-lifecycle Character events must be explicitly published from the live
  // Playtest host. Merely declaring a route or implementing a resolver is not
  // execution evidence.
  return new RegExp(
    `publishQuickDuelPlaytestCharacterEvent\\([\\s\\S]{0,420}?type:\\s*["']${event}["']`,
    "m",
  ).test(playtestSource);
}

export function characterResolverHostEvidence({
  resolver,
  characterRuntimeSource,
  migrationSource,
  playtestSource,
  quickDuelHostSource,
}) {
  const classification = classifyCharacterResolver(resolver, characterRuntimeSource, migrationSource);
  if (classification.events.length === 0) {
    return {
      ...classification,
      liveEvents: [],
      hostLive: false,
      reason: `Character resolver ${resolver || "(missing)"} has no runtime-event mapping.`,
    };
  }

  if (classification.owner === "compatibility-helper") {
    const hostLive = Boolean(classification.helper)
      && new RegExp(`\\b${classification.helper}\\s*\\(`).test(playtestSource);
    return {
      ...classification,
      liveEvents: hostLive ? [...classification.events] : [],
      hostLive,
      reason: hostLive
        ? `Character resolver ${resolver} remains intentionally owned by compatibility helper ${classification.helper}.`
        : `Compatibility helper ${classification.helper ?? "(missing)"} is not called by the live Quick Duel host.`,
    };
  }

  const liveEvents = classification.events.filter((event) =>
    characterEventHostEvidence(event, playtestSource, quickDuelHostSource),
  );
  const hostLive = liveEvents.length === classification.events.length;
  const missingEvents = classification.events.filter((event) => !liveEvents.includes(event));
  return {
    ...classification,
    liveEvents,
    hostLive,
    reason: hostLive
      ? `Character resolver ${resolver} is published through ${classification.events.join(", ")}.`
      : `Character resolver ${resolver} is event-runtime owned, but Quick Duel does not yet publish ${missingEvents.join(", ")}.`,
  };
}
