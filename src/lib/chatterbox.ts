export const CHATTERBOX_VOICES = [
  "aaron",
  "abigail",
  "anaya",
  "andy",
  "archer",
  "brian",
  "chloe",
  "dylan",
  "emmanuel",
  "ethan",
  "evelyn",
  "gavin",
  "gordon",
  "ivan",
  "laura",
  "lucy",
  "madison",
  "marisol",
  "meera",
  "walter",
] as const;

export type ChatterboxVoice = (typeof CHATTERBOX_VOICES)[number];
