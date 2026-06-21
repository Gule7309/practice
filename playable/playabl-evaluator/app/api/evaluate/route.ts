import { NextResponse } from "next/server";
import { z } from "zod";
import { captureGame } from "@/lib/captureGame";
import { evaluateGame } from "@/lib/evaluateGame";
import path from "path";
import fs from "fs";

export const maxDuration = 60;
export const runtime = "nodejs";

const RequestSchema = z.object({
  url: z.string().url(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const capture = await captureGame(parsed.data.url);
    const evaluation = await evaluateGame(capture, parsed.data.notes);

    // Housekeeping: Clean up old videos in public/temp-videos/ that are older than 10 minutes
    const tempVideosDir = path.join(process.cwd(), "public", "temp-videos");
    try {
      if (fs.existsSync(tempVideosDir)) {
        const files = fs.readdirSync(tempVideosDir);
        const now = Date.now();
        for (const file of files) {
          // Skip cleaning the current video we just recorded
          if (file === capture.videoFilename) continue;
          
          const filePath = path.join(tempVideosDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > 10 * 60 * 1000) { // 10 minutes
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (e) {
      console.error("Failed to clean up old temp videos:", e);
    }

    return NextResponse.json({
      capture: {
        url: capture.url,
        title: capture.title,
        description: capture.description,
        interactionTrace: capture.interactionTrace,
        videoFilename: capture.videoFilename,
      },
      evaluation,
    });
  } catch (error) {
    console.error("[/api/evaluate] Error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while evaluating the game.",
      },
      { status: 500 }
    );
  }
}

