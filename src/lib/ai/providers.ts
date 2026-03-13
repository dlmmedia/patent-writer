import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key is not configured. Set OPENAI_API_KEY in your environment.");
  return createOpenAI({ apiKey: key });
}

function getGoogle() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("Google AI API key is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in your environment.");
  return createGoogleGenerativeAI({ apiKey: key });
}

export const MODEL_PROVIDER_MAP = {
  "gemini-3.1-pro": "google",
  "gemini-2.5-flash": "google",
  "gemini-2.5-pro": "google",
  "gpt-4o-mini": "openai",
  "gpt-4o": "openai",
  o3: "openai",
  "o4-mini": "openai",
} as const;

export const IMAGE_MODEL_PROVIDER_MAP = {
  "nano-banana-2": "google",
  "gemini-2.5-flash-image": "google",
  "imagen-4": "google",
  "gpt-image-1": "openai",
} as const;

export type ModelId = keyof typeof MODEL_PROVIDER_MAP;
export type ImageModelId = keyof typeof IMAGE_MODEL_PROVIDER_MAP;

const MODEL_SDK_IDS: Record<ModelId, string> = {
  "gemini-3.1-pro": "gemini-3.1-pro-preview",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4o": "gpt-4o",
  o3: "o3",
  "o4-mini": "o4-mini",
};

const IMAGE_MODEL_SDK_IDS: Record<ImageModelId, string> = {
  "nano-banana-2": "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image": "gemini-2.5-flash-image",
  "imagen-4": "imagen-4.0-generate-001",
  "gpt-image-1": "gpt-image-1",
};

export function isGoogleModel(modelId: string): boolean {
  return modelId in MODEL_PROVIDER_MAP && MODEL_PROVIDER_MAP[modelId as ModelId] === "google";
}

export function isOpenAIModel(modelId: string): boolean {
  return modelId in MODEL_PROVIDER_MAP && MODEL_PROVIDER_MAP[modelId as ModelId] === "openai";
}

export function isGoogleImageModel(modelId: string): boolean {
  return modelId in IMAGE_MODEL_PROVIDER_MAP && IMAGE_MODEL_PROVIDER_MAP[modelId as ImageModelId] === "google";
}

export function isOpenAIImageModel(modelId: string): boolean {
  return modelId in IMAGE_MODEL_PROVIDER_MAP && IMAGE_MODEL_PROVIDER_MAP[modelId as ImageModelId] === "openai";
}

export const modelInfo: Record<
  ModelId,
  { name: string; provider: "Google" | "OpenAI"; bestFor: string; tier: "economy" | "balanced" | "premium" }
> = {
  "gemini-3.1-pro": {
    name: "Gemini 3.1 Pro",
    provider: "Google",
    bestFor: "Best-in-class patent drafting, complex reasoning",
    tier: "premium",
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    provider: "Google",
    bestFor: "High-volume drafting, section generation",
    tier: "economy",
  },
  "gpt-4o-mini": {
    name: "GPT-4o mini",
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
  "gpt-4o": {
    name: "GPT-4o",
    provider: "OpenAI",
    bestFor: "Professional patent writing, final drafts",
    tier: "premium",
  },
  "o4-mini": {
    name: "o4-mini",
    provider: "OpenAI",
    bestFor: "Fast reasoning, cost-effective analysis",
    tier: "economy",
  },
};

export const imageModelInfo: Record<
  ImageModelId,
  { name: string; provider: "Google" | "OpenAI"; bestFor: string }
> = {
  "nano-banana-2": {
    name: "Nano Banana 2",
    provider: "Google",
    bestFor: "Pro-quality patent drawings at Flash speed",
  },
  "gemini-2.5-flash-image": {
    name: "Gemini 2.5 Flash Image",
    provider: "Google",
    bestFor: "Fast, cost-effective patent drawings",
  },
  "imagen-4": {
    name: "Imagen 4",
    provider: "Google",
    bestFor: "High-quality patent illustrations",
  },
  "gpt-image-1": {
    name: "GPT Image 1",
    provider: "OpenAI",
    bestFor: "High-quality drawings with text labels",
  },
};

export function getModel(modelId: ModelId) {
  const provider = MODEL_PROVIDER_MAP[modelId];
  const sdkId = MODEL_SDK_IDS[modelId];
  if (provider === "google") {
    return getGoogle()(sdkId);
  }
  return getOpenAI()(sdkId);
}

export function getImageModel(modelId: ImageModelId) {
  const provider = IMAGE_MODEL_PROVIDER_MAP[modelId];
  const sdkId = IMAGE_MODEL_SDK_IDS[modelId];
  if (provider === "google") {
    return getGoogle().image(sdkId);
  }
  return getOpenAI().image(sdkId);
}

export function checkProviderAvailability() {
  return {
    google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  };
}

export function getAvailableModels(): ModelId[] {
  const avail = checkProviderAvailability();
  return (Object.keys(MODEL_PROVIDER_MAP) as ModelId[]).filter(
    (id) => avail[MODEL_PROVIDER_MAP[id]]
  );
}

export function getAvailableImageModels(): ImageModelId[] {
  const avail = checkProviderAvailability();
  return (Object.keys(IMAGE_MODEL_PROVIDER_MAP) as ImageModelId[]).filter(
    (id) => avail[IMAGE_MODEL_PROVIDER_MAP[id]]
  );
}

export function getRequiredKeyForModel(modelId: string): string {
  if (isGoogleModel(modelId) || isGoogleImageModel(modelId)) {
    return "GOOGLE_GENERATIVE_AI_API_KEY";
  }
  return "OPENAI_API_KEY";
}
