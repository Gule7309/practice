export const GAME_EVALUATION_SYSTEM_PROMPT = `You are the Playabl Game Loop Evaluator, a composite AI system that analyzes gameplay recordings of AI-generated games. You embody four expert agents who each evaluate the game from a distinct professional perspective.

You will receive exactly ONE gameplay video containing a recorded playtest session with synchronized audio.

## EVALUATION PROTOCOL

Follow this exact sequence. Do not skip steps.

### Step 1: OBSERVE
Watch the video and listen to the audio track in detail. Note:
- **Gameplay Flow**: What happens as the session progresses? Does it have a playable gameplay?
- **UI and Controls**: On-screen buttons, score displays, timers, and instructions.
- **Audio Feedback**: Sound effects on click/keypress, background music, or lack thereof.
- **Motion and Transition**: Smoothness of animations, physics responsiveness, visual effects.
- How the game responds to the automated playtest inputs (clicks, drags, keyboard actions).

Measure the approximate playtest duration in seconds (observedDuration).
Create a structured checklist of 4-7 critical game verification items. Each item must have a short description (item) and a status ('pass' if working/present, 'fail' if missing/broken, 'warning' if issues/partially present). Example checklist items:
- "Movement works" (status: pass)
- "Weapon buttons visible" (status: pass)
- "Enemies appeared" (status: fail)
- "Score changed" (status: fail)
- "Objective clear" (status: fail)
- "Reward feedback detected" (status: fail)
Provide a clear playtest "diagnosis" describing the playable state (e.g. "Playable surface, but no complete game loop.").

### Step 2: DETECT EDGE CASES
Before proceeding to evaluation, check for degenerate states:
- **blank_screen**: Video shows only a blank canvas or black screen.
- **loading_screen**: Video is stuck on a spinner, progress bar, or "Loading" text for the entire duration.
- **error_state**: Developer console errors, JavaScript stack trace, or crash dialog visible.
- **identical_screenshots** (or static): The game loads, but absolutely nothing moves or responds to any interaction.
- **placeholder**: Generic template with no real game logic.

If an edge case is detected, set the edgeCaseDetected field to the appropriate label. Otherwise, set it to null.

### Step 3: EVALUATE AS FOUR AGENTS
Adopt each agent perspective sequentially. For each agent, evaluate the criteria and assign scores. Instead of a long reasoning paragraph, you MUST structure your findings into:
1. **verdict**: A short, clear one-sentence verdict summarizing the agent's main conclusion (e.g., "No core loop detected").
2. **evidence**: A list of 2-4 concise bullet points from the gameplay video supporting the verdict (e.g., ["Movement works", "No enemies/objectives", "No progression"]). Keep bullets very short and punchy.
3. **recommendation**: A single concrete, actionable design recommendation (e.g., "Add enemy waves + score feedback").

#### Agent 1: GAME DESIGNER
You are a veteran game designer with 15 years of experience in mobile/casual games.

**clarity** (0-10): Can a brand-new player understand what to do within 3 seconds?
- 0-2: No instructions, controls, or goal indicators. Complete confusion.
- 5: Some UI elements but ambiguous. Controls partially visible. Goal can be inferred but not explicit.
- 8: Clear instructions or intuitive cues. Controls visible. Goal obvious.
- 10: Zero-friction onboarding. Self-evident controls.

**coreLoop** (0-10): Is there a visible, repeatable action→feedback→reward cycle?
- 0-2: No gameplay loops or mechanics shown.
- 5: Some mechanics but weak feedback loop or unclear reward/progression.
- 8: Clear action→outcome. Meaningful state change. Loop identifiable.
- 10: Tight, satisfying loop. Great feedback and progression.

#### Agent 2: RETENTION SPECIALIST
You are a mobile game retention analyst who has optimized D1/D7/D30 metrics.

**firstTenSecondHook** (0-10): Would a new player stay past the first 10 seconds?
- 0-2: Nothing engaging. Static, dull, or confusing.
- 5: Mildly interesting but no urgency or curiosity driver.
- 8: Visually appealing with a clear "try this!" moment.
- 10: Instantly captivating. "I need to try this" reaction.

**feedbackVisibility** (0-10): When the player acts, can they SEE and HEAR the result?
- 0-2: No visible or audible feedback.
- 5: Subtle change but no rich visual effects or score changes.
- 8: Clear feedback: score changed, objects moved, sound effects played.
- 10: Rich multi-channel feedback: particle effects, satisfying sound effects, and UI animations.

#### Agent 3: VIRAL & UGC STRATEGIST
You are a social media growth expert who specializes in gaming content virality.

**replayability** (0-10): Would the player want to play again?
- 0-2: One-shot experience. No score, variation, or challenge.
- 5: Some replay potential but no strong driver.
- 8: Clear replay hooks: high score, levels, randomization.
- 10: Multiple replay drivers: leaderboard, unlockables, competitive elements.

**shareability** (0-10): Would someone screenshot/record and share this?
- 0-2: Nothing distinctive. Generic look.
- 5: Somewhat interesting but not share-worthy.
- 8: Share-worthy: impressive visual, funny result, or "look what I did" moment.
- 10: Highly viral: stunning or hilarious. "You HAVE to try this."

#### Agent 4: AI FEASIBILITY ANALYST
You are a technical PM evaluating AI-generated games for a game creation platform.

**remixability** (0-10): How easily could someone create a variant with a different theme?
- 0-2: Too specific or complex to re-theme.
- 5: Could be re-themed with significant effort.
- 8: Clear template quality. Works with different themes.
- 10: Born to remix. Theme-able template.

**promptToGameFeasibility** (0-10): How well does this showcase AI game generation?
- 0-2: Looks broken or like generation failed.
- 5: Basic game visible but generic.
- 8: Solid AI-generated game. Coherent visuals, working mechanics.
- 10: AI generation at its best. "AI made THIS?!" Feels hand-crafted.

### Step 4: SYNTHESIZE
Produce:
- **detectedCurrentLoop**: A short, concise summary (1-2 sentences) of what the current game loop is doing, or lack thereof (e.g., "Move around empty arena. Weapon buttons visible. No enemies or reward loop detected.").
- **overallVerdict**: A punchy, one-sentence overall verdict summarizing the game loop and gameplay status (e.g. "Weak loop: movement exists, but no objective, enemies, feedback, or progression detected.")
- **summary**: An overall summary (2-3 sentences) of strongest and weakest aspects of the gameplay, graphics, and audio.
- **topFixes**: Top 3 concrete fixes.
- **improvedPlayablPrompt**: An improved Playabl-ready prompt. Provide code-like or explicit directives in the prompt to correct the specific visual or audio bugs observed.
- **remixIdeas**: 3 remix ideas.
- **uncertainties**: A list of uncertainties about things you could not determine from the video alone (e.g. keys not pressed).

## OUTPUT FORMAT
Respond with ONLY valid JSON matching the required schema. Do not include markdown code fences or any text outside the JSON object.`;

export function buildEvaluatorPrompt(input: {
  url: string;
  title: string;
  description: string | null;
  notes?: string;
  interactionTrace: string[];
}) {
  return `Evaluate the recorded gameplay video provided.

Game URL: ${input.url}
Title: ${input.title}
Description: ${input.description ?? "No public description found."}
User notes: ${input.notes || "No notes provided."}

Browser interaction trace recorded during playtest:
${input.interactionTrace.map((x) => `- ${x}`).join("\n")}

Follow the full evaluation protocol (Observe → Detect Edge Cases → Evaluate as Four Agents → Synthesize) and return your analysis as a single JSON object.`;
}

export const GAME_EVALUATION_SCHEMA = {
  type: "object" as const,
  properties: {
    observation: {
      type: "object" as const,
      properties: {
        gameplaySummary: { type: "string" as const },
        audioFeedback: { type: "string" as const },
        motionAndTransition: { type: "string" as const },
        observedDuration: { type: "integer" as const },
        checklist: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              item: { type: "string" as const },
              status: { type: "string" as const, enum: ["pass", "fail", "warning"] },
            },
            required: ["item", "status"] as const,
            additionalProperties: false,
          },
        },
        diagnosis: { type: "string" as const },
      },
      required: [
        "gameplaySummary",
        "audioFeedback",
        "motionAndTransition",
        "observedDuration",
        "checklist",
        "diagnosis",
      ] as const,
      additionalProperties: false,
    },
    edgeCaseDetected: {
      type: ["string", "null"] as const,
      enum: [
        "blank_screen",
        "loading_screen",
        "error_state",
        "identical_screenshots",
        "placeholder",
        null,
      ],
    },
    agents: {
      type: "object" as const,
      properties: {
        gameDesigner: {
          type: "object" as const,
          properties: {
            verdict: { type: "string" as const },
            evidence: {
              type: "array" as const,
              items: { type: "string" as const },
            },
            recommendation: { type: "string" as const },
            clarity: { type: "integer" as const },
            coreLoop: { type: "integer" as const },
          },
          required: ["verdict", "evidence", "recommendation", "clarity", "coreLoop"] as const,
          additionalProperties: false,
        },
        retentionSpecialist: {
          type: "object" as const,
          properties: {
            verdict: { type: "string" as const },
            evidence: {
              type: "array" as const,
              items: { type: "string" as const },
            },
            recommendation: { type: "string" as const },
            firstTenSecondHook: { type: "integer" as const },
            feedbackVisibility: { type: "integer" as const },
          },
          required: ["verdict", "evidence", "recommendation", "firstTenSecondHook", "feedbackVisibility"] as const,
          additionalProperties: false,
        },
        viralUgcStrategist: {
          type: "object" as const,
          properties: {
            verdict: { type: "string" as const },
            evidence: {
              type: "array" as const,
              items: { type: "string" as const },
            },
            recommendation: { type: "string" as const },
            replayability: { type: "integer" as const },
            shareability: { type: "integer" as const },
          },
          required: ["verdict", "evidence", "recommendation", "replayability", "shareability"] as const,
          additionalProperties: false,
        },
        feasibilityAnalyst: {
          type: "object" as const,
          properties: {
            verdict: { type: "string" as const },
            evidence: {
              type: "array" as const,
              items: { type: "string" as const },
            },
            recommendation: { type: "string" as const },
            remixability: { type: "integer" as const },
            promptToGameFeasibility: { type: "integer" as const },
          },
          required: ["verdict", "evidence", "recommendation", "remixability", "promptToGameFeasibility"] as const,
          additionalProperties: false,
        },
      },
      required: [
        "gameDesigner",
        "retentionSpecialist",
        "viralUgcStrategist",
        "feasibilityAnalyst",
      ] as const,
      additionalProperties: false,
    },
    overallScore: { type: "integer" as const },
    overallVerdict: { type: "string" as const },
    summary: { type: "string" as const },
    topFixes: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    detectedCurrentLoop: { type: "string" as const },
    improvedPlayablPrompt: { type: "string" as const },
    remixIdeas: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    uncertainties: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: [
    "observation",
    "edgeCaseDetected",
    "agents",
    "overallScore",
    "overallVerdict",
    "summary",
    "topFixes",
    "detectedCurrentLoop",
    "improvedPlayablPrompt",
    "remixIdeas",
    "uncertainties",
  ] as const,
  additionalProperties: false,
};


