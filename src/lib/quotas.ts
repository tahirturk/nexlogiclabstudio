export const TTS_PACKAGES = {
  starter: { name: "Starter", characters: 50_000 },
  pro: { name: "Pro", characters: 250_000 },
} as const;

export type TtsPackageId = keyof typeof TTS_PACKAGES;

export function isTtsPackageId(value: unknown): value is TtsPackageId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(TTS_PACKAGES, value)
  );
}
