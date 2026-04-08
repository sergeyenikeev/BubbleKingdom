import type { RemoteConfig } from "@bubble-kingdom/config";

export function assignExperimentVariants(
  anonymousId: string,
  remoteConfig: RemoteConfig,
): Record<string, string> {
  return Object.fromEntries(
    remoteConfig.experiments.map((experiment) => {
      const index = deterministicHash(`${anonymousId}:${experiment.key}`) % experiment.variants.length;
      return [experiment.key, experiment.variants[index] ?? experiment.defaultVariant];
    }),
  );
}

function deterministicHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
