import { GoogleGenAI } from "@google/genai";
import {
  GAME_EVALUATION_SYSTEM_PROMPT,
  GAME_EVALUATION_SCHEMA,
  buildEvaluatorPrompt,
} from "./prompts";
import type { CaptureResult } from "./captureGame";
import fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey || "",
});

export type GameEvaluation = {
  observation: {
    gameplaySummary: string;
    audioFeedback: string;
    motionAndTransition: string;
    observedDuration: number;
    checklist: Array<{
      item: string;
      status: "pass" | "fail" | "warning";
    }>;
    diagnosis: string;
  };
  edgeCaseDetected:
    | "blank_screen"
    | "loading_screen"
    | "error_state"
    | "identical_screenshots"
    | "placeholder"
    | null;
  agents: {
    gameDesigner: {
      verdict: string;
      evidence: string[];
      recommendation: string;
      clarity: number;
      coreLoop: number;
    };
    retentionSpecialist: {
      verdict: string;
      evidence: string[];
      recommendation: string;
      firstTenSecondHook: number;
      feedbackVisibility: number;
    };
    viralUgcStrategist: {
      verdict: string;
      evidence: string[];
      recommendation: string;
      replayability: number;
      shareability: number;
    };
    feasibilityAnalyst: {
      verdict: string;
      evidence: string[];
      recommendation: string;
      remixability: number;
      promptToGameFeasibility: number;
    };
  };
  overallScore: number;
  overallVerdict: string;
  summary: string;
  topFixes: string[];
  detectedCurrentLoop: string;
  improvedPlayablPrompt: string;
  remixIdeas: string[];
  uncertainties: string[];
};

export async function evaluateGame(
  capture: CaptureResult,
  notes?: string
): Promise<GameEvaluation> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  // 1. Upload the gameplay WebM video
  const uploadResult = await ai.files.upload({
    file: capture.absoluteVideoPath,
    config: {
      mimeType: "video/webm",
    },
  });

  if (!uploadResult.name) {
    throw new Error("Failed to upload gameplay video to Gemini (missing name).");
  }

  // 2. Poll the file status until it is ACTIVE (processing video takes a few seconds)
  let fileState = await ai.files.get({ name: uploadResult.name });
  let attempts = 0;
  while (fileState.state === "PROCESSING" && attempts < 15) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    fileState = await ai.files.get({ name: uploadResult.name });
    attempts++;
  }

  if (fileState.state === "FAILED") {
    await ai.files.delete({ name: uploadResult.name }).catch(console.error);
    throw new Error("Video processing failed on Gemini servers.");
  }

  try {
    // 3. Construct user evaluation prompt
    const userPrompt = buildEvaluatorPrompt({
      url: capture.url,
      title: capture.title,
      description: capture.description,
      notes,
      interactionTrace: capture.interactionTrace,
    });

    // 4. Generate content directly with system instructions (bypassing cache)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          fileData: {
            fileUri: uploadResult.uri,
            mimeType: uploadResult.mimeType || "video/webm",
          },
        },
        { text: userPrompt },
      ],
      config: {
        systemInstruction: GAME_EVALUATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GAME_EVALUATION_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned no text content.");
    }

    return JSON.parse(text) as GameEvaluation;
  } finally {
    // 5. Clean up the uploaded video on Gemini
    await ai.files.delete({ name: uploadResult.name }).catch(console.error);
  }
}

