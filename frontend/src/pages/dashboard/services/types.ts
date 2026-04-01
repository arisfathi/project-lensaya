import type { ComponentType } from "react";

export type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  thumbnailUrl: string | null;
  packageCount: number;
  order: number;
};

export type ServiceForm = {
  name: string;
  description: string;
  emoji: string;
  order: string;
};

export type EmojiSelection = {
  native: string;
};

export type EmojiPickerComponent = ComponentType<{
  data: unknown;
  previewPosition?: string;
  theme?: string;
  onEmojiSelect?: (emoji: EmojiSelection) => void;
}>;
