import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const models = {
  "gemini-2.5-flash": google("gemini-2.5-flash-preview-05-20"),
  "gpt-5-mini": openai("gpt-5-mini"),
  o3: openai("o3"),
  "gemini-2.5-pro": google("gemini-2.5-pro-preview-05-06"),
  "gpt-5.2": openai("gpt-5.2"),
  "gpt-5.2-pro": openai("gpt-5.2-pro"),
} as const;

export const imageModels = {
  "gemini-3-pro-image": google.image("gemini-3-pro-image-preview"),
  "gemini-2.5-flash-image": google.image("gemini-2.5-flash-image"),
  "imagen-4": google.image("imagen-4.0-generate-001"),
  "gpt-image-1": openai.image("gpt-image-1"),
} as const;

export type ModelId = keyof typeof models;
export type ImageModelId = keyof typeof imageModels;

export const modelInfo: Record<
  ModelId,
  { name: string; provider: string; bestFor: string; tier: "economy" | "balanced" | "premium" }
> = {
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    provider: "Google",
    bestFor: "High-volume drafting, section generation",
    tier: "economy",
  },
  "gpt-5-mini": {
    name: "GPT-5 mini",
    provider: "OpenAI",
    bestFor: "Structured drafting, automation tasks",
    tier: "economy",
  },
  o3: {
    name: "o3",
    provider: "OpenAI",
    bestFor: "Claim analysis, complex reasoning",
    tier: "balanced",
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    provider: "Google",
    bestFor: "Research synthesis, novelty analysis",
    tier: "balanced",
  },
  "gpt-5.2": {
    name: "GPT-5.2",
    provider: "OpenAI",
    bestFor: "Professional patent writing, final drafts",
    tier: "premium",
  },
  "gpt-5.2-pro": {
    name: "GPT-5.2 Pro",
    provider: "OpenAI",
    bestFor: "Legal precision, mission-critical outputs",
    tier: "premium",
  },
};

export const imageModelInfo: Record<
  ImageModelId,
  { name: string; provider: string; bestFor: string }
> = {
  "gemini-3-pro-image": {
    name: "Gemini 3 Pro Image",
    provider: "Google",
    bestFor: "High-quality drawings with up to 4K resolution",
  },
  "gemini-2.5-flash-image": {
    name: "Gemini 2.5 Flash Image",
    provider: "Google",
    bestFor: "Fast, cost-effective patent drawings",
  },
  "imagen-4": {
    name: "Imagen 4",
    provider: "Google",
    bestFor: "Photorealistic image generation",
  },
  "gpt-image-1": {
    name: "GPT Image 1",
    provider: "OpenAI",
    bestFor: "High-quality drawings with text labels",
  },
};

export function getModel(modelId: ModelId) {
  return models[modelId];
}

export function getImageModel(modelId: ImageModelId) {
  return imageModels[modelId];
}
