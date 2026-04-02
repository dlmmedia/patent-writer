import type { Patent, PatentDrawing, ReferenceNumeral } from "@/lib/types";

export type ImageModelId =
  | "nano-banana-2"
  | "gemini-2.5-flash-image"
  | "imagen-4"
  | "gpt-image-1";

export const IMAGE_MODEL_OPTIONS: { value: ImageModelId; label: string }[] = [
  { value: "nano-banana-2", label: "Nano Banana 2 (Google)" },
  { value: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
  { value: "imagen-4", label: "Imagen 4" },
  { value: "gpt-image-1", label: "GPT Image 1" },
];

export interface PlacedNumeral {
  id: string;
  numeral: number;
  elementName: string;
  xPercent: number;
  yPercent: number;
}

export interface DrawingStudioProps {
  patent: Patent & {
    drawings: PatentDrawing[];
    referenceNumerals: ReferenceNumeral[];
  };
}

export interface VersionEntry {
  url: string;
  prompt: string;
  model: string;
  createdAt: string;
}
