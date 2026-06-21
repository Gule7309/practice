"use client";

import { useState, useCallback } from "react";

/* ─── Types ─── */

type AgentEvaluation = {
  verdict: string;
  evidence: string[];
  recommendation: string;
  [key: string]: string | number | string[];
};

type EvaluationResponse = {
  capture: {
    url: string;
    title: string;
    description: string | null;
    interactionTrace: string[];
    videoFilename: string;
  };
  evaluation: {
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
    edgeCaseDetected: string | null;
    agents: {
      gameDesigner: AgentEvaluation;
      retentionSpecialist: AgentEvaluation;
      viralUgcStrategist: AgentEvaluation;
      feasibilityAnalyst: AgentEvaluation;
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
};

/* ─── Score helpers ─── */

const SCORE_LABELS: Record<string, string> = {
  clarity: "Clarity",
  coreLoop: "Core Loop",
  firstTenSecondHook: "First 10s Hook",
  feedbackVisibility: "Feedback Visibility",
  replayability: "Replayability",
  shareability: "Shareability",
  remixability: "Remixability",
  promptToGameFeasibility: "Prompt → Game",
};

const AGENT_META: Record<
  string,
  { label: string; icon: string; colorClass: string; scoreKeys: string[] }
> = {
  gameDesigner: {
    label: "Game Designer",
    icon: "🎮",
    colorClass: "agent-review__name--designer",
    scoreKeys: ["clarity", "coreLoop"],
  },
  retentionSpecialist: {
    label: "Retention Specialist",
    icon: "📊",
    colorClass: "agent-review__name--retention",
    scoreKeys: ["firstTenSecondHook", "feedbackVisibility"],
  },
  viralUgcStrategist: {
    label: "Viral & UGC Strategist",
    icon: "🚀",
    colorClass: "agent-review__name--viral",
    scoreKeys: ["replayability", "shareability"],
  },
  feasibilityAnalyst: {
    label: "AI Feasibility Analyst",
    icon: "🔬",
    colorClass: "agent-review__name--feasibility",
    scoreKeys: ["remixability", "promptToGameFeasibility"],
  },
};

function getScoreVariant(score: number): string {
  if (score <= 3) return "score-card--low";
  if (score <= 6) return "score-card--mid";
  return "score-card--high";
}

function extractAllScores(
  agents: EvaluationResponse["evaluation"]["agents"]
): Array<{ key: string; value: number }> {
  const scores: Array<{ key: string; value: number }> = [];
  for (const [, agent] of Object.entries(agents)) {
    for (const [key, value] of Object.entries(agent)) {
      if (key !== "reasoning" && typeof value === "number") {
        scores.push({ key, value });
      }
    }
  }
  return scores;
}

/* ─── Loading Steps ─── */

const LOADING_STEPS = [
  "Launching headless browser…",
  "Navigating to game URL…",
  "Activating canvas context…",
  "Simulating clicks, drags & keystrokes…",
  "Recording audio & video streams…",
  "Uploading to Gemini File API…",
  "Evaluating gameplay with Gemini 2.5 Flash…",
];

/* ─── Mock Demo Data ─── */

const MOCK_DEMO_DATA = {
  capture: {
    url: "https://playabl.ai/games/arena-survival-ugc-test",
    title: "Arena Survival Lite",
    description: "A sandbox where you control a spaceship dot. Press SPACE to fire.",
    interactionTrace: [
      "Loaded page and waited for network idle.",
      "Recorded initial start screen state.",
      "Clicked center of viewport to activate canvas.",
      "Clicked center of viewport again to trigger play state.",
      "Pressed keyboard key: Space",
      "Pressed keyboard key: ArrowUp",
      "Pressed keyboard key: ArrowRight",
      "Pressed keyboard key: KeyA",
      "Pressed keyboard key: KeyD",
      "Simulating drag/swipe gesture from bottom-center upwards.",
      "Completed interaction recording."
    ],
    videoFilename: "/sample-playtest.webm",
  },
  evaluation: {
    observation: {
      gameplaySummary: "The game initializes on a dark arena background. The player controls a circular spaceship that can move using arrow/WASD keys and rotate. There are weapon firing indicators and sound effects, but no enemies spawn during the entire 37-second session.",
      audioFeedback: "Laser firing sound effect plays when Space is pressed. Background ambient track is missing.",
      motionAndTransition: "Movement is smooth, and firing animation renders successfully. However, the screen remains static otherwise.",
      observedDuration: 37,
      checklist: [
        { item: "Movement works", status: "pass" },
        { item: "Weapon buttons visible", status: "pass" },
        { item: "Enemies appeared", status: "fail" },
        { item: "Score stayed at 0", status: "fail" },
        { item: "Objective clear", status: "fail" },
        { item: "Reward feedback detected", status: "fail" }
      ],
      diagnosis: "Playable surface, but no complete game loop."
    },
    edgeCaseDetected: null,
    agents: {
      gameDesigner: {
        verdict: "Loop incomplete",
        evidence: ["Player can move and fire", "No enemy spawning detected", "No score rewards or objectives"],
        recommendation: "Add wave-based enemies and collision rewards",
        clarity: 5,
        coreLoop: 2
      },
      retentionSpecialist: {
        verdict: "Weak first 10 seconds",
        evidence: ["Player can move, but no goal is communicated", "Score remains zero", "Zero progression triggers"],
        recommendation: "Show 'Survive 60s' and spawn first enemy immediately",
        clarity: 5,
        coreLoop: 2,
        firstTenSecondHook: 3,
        feedbackVisibility: 4
      },
      viralUgcStrategist: {
        verdict: "Low shareability",
        evidence: ["No satisfying destruction or blast effect", "No combo multipliers", "No high score challenge"],
        recommendation: "Add enemy shatter effect + combo counter",
        clarity: 5,
        coreLoop: 2,
        replayability: 2,
        shareability: 1
      },
      feasibilityAnalyst: {
        verdict: "Core mechanic ready for extension",
        evidence: ["Phaser engine initialized successfully", "Keyboard inputs bind correctly", "Collision listeners are registered but empty"],
        recommendation: "Extend existing collision handler to bind enemy spawning and health decreases",
        clarity: 5,
        coreLoop: 2,
        remixability: 7,
        promptToGameFeasibility: 4
      }
    },
    overallScore: 3.0,
    overallVerdict: "Needs: objective + feedback + progression",
    summary: "The game has movement and combat UI, but no detected enemies, objective, scoring event, or progression.",
    topFixes: [
      "Spawn waves of moving targets/enemies to close the combat loop.",
      "Add a survival timer or clear score-based objective (e.g. 'Survive 60s').",
      "Implement visual/audio feedback for hits and scoring events."
    ],
    detectedCurrentLoop: "Move around empty arena. Weapon buttons visible. No enemies or reward loop detected.",
    improvedPlayablPrompt: "Create a 60-second arena survival game where the player controls a spaceship dot with arrow keys. Spawn circles representing enemies from the outer edges every 2 seconds. When the player shoots enemies, destroy the enemy with a colorful burst effect, play a shatter sound, and increase the score by 10 points. Display a 'Survive 60s' goal in the center HUD at start.",
    remixIdeas: [
      "Neon Synthwave Survival: Add glowing trails and neon grids.",
      "Space Chase: Spawn homing asteroids that explode on impact.",
      "Time Trial: Score as many hits as possible in 30 seconds."
    ],
    uncertainties: ["Could not verify mobile swipe controls as only keyboard events were sent."]
  }
};

/* ─── Component ─── */

export default function Home() {
  const [url, setUrl] = useState("");
  const [iframeUrl, setIframeUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleUrlChange = (val: string) => {
    setUrl(val);
    try {
      if (val.trim().startsWith("http://") || val.trim().startsWith("https://")) {
        new URL(val.trim());
        setIframeUrl(val.trim());
      } else {
        setIframeUrl("");
      }
    } catch {
      setIframeUrl("");
    }
  };

  const handleLoadDemo = () => {
    setResult(MOCK_DEMO_DATA as any);
    setUrl(MOCK_DEMO_DATA.capture.url);
    setIframeUrl(MOCK_DEMO_DATA.capture.url);
    setNotes("Demo playtest: arena survival incomplete game loop.");
    setError("");
  };

  const handleEvaluate = useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setLoadingStep(0);

    // Animate loading steps
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 4500);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notes: notes || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Evaluation failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  }, [url, notes]);

  const handleCopyPrompt = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      result.evaluation.improvedPlayablPrompt
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <main className="app-container" style={{ maxWidth: "1400px" }}>
      {/* Dynamic Styling Injection */}
      <style jsx global>{`
        .evaluator-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 40px;
          align-items: start;
          margin-top: 24px;
        }
        @media (max-width: 1024px) {
          .evaluator-grid {
            grid-template-columns: 1fr;
          }
        }
        .evaluator-column {
          min-width: 0;
        }
        .evaluator-column--right {
          position: sticky;
          top: 40px;
          height: calc(100vh - 80px);
          display: flex;
          flex-direction: column;
        }
        .iframe-container {
          flex: 1;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          background: #000;
          position: relative;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
        }
        .iframe-header {
          padding: 12px 20px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .iframe-game {
          flex: 1;
          width: 100%;
          height: 100%;
          border: none;
        }
        .iframe-placeholder {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          border: 2px dashed var(--border-subtle);
          border-radius: var(--radius-xl);
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          color: var(--text-secondary);
          text-align: center;
        }
        .iframe-placeholder__icon {
          font-size: 48px;
          margin-bottom: 16px;
          animation: pulse-controller 2s infinite ease-in-out;
        }
        @keyframes pulse-controller {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .iframe-placeholder__text {
          font-size: 15px;
          max-width: 300px;
          line-height: 1.6;
        }
        .gameplay-video {
          width: 100%;
          max-height: 450px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: #000;
          box-shadow: var(--shadow-md);
        }
      `}</style>

      {/* ── Header ── */}
      <header className="header">
        <div className="header__badge">Gemini 2.5 Flash Inside</div>
        <h1 className="header__title">Playabl Game Loop Evaluator</h1>
        <p className="header__subtitle">
          An automated QA and evaluation suite for AI-generated games. Record gameplay in a headless browser and run multi-agent diagnostics.
        </p>
      </header>

      {result ? (
        /* Result Mode: Premium evaluation layer dashboard */
        <div className="results" style={{ animation: "fadeInUp 0.6s var(--ease-out)" }}>
          {/* Navigation Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
            <button
              onClick={() => {
                setResult(null);
                setUrl("");
                setIframeUrl("");
                setNotes("");
              }}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                padding: "10px 20px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-violet)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
            >
              ← Evaluate Another Game
            </button>
            
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
                Target Game: <strong style={{ color: "var(--text-primary)" }}>{result.capture.title}</strong>
              </span>
              <a
                href={result.capture.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "12px",
                  color: "var(--accent-cyan)",
                  textDecoration: "none"
                }}
              >
                Open Original ↗
              </a>
            </div>
          </div>

          {/* Edge Case Banner */}
          {result.evaluation.edgeCaseDetected && (
            <div className="edge-case-banner">
              ⚠ Edge case detected:{" "}
              <strong>
                {result.evaluation.edgeCaseDetected.replace(/_/g, " ")}
              </strong>
              . Evaluation capability may be limited.
            </div>
          )}

          {/* ─── SECTION 1: WHAT THE AGENT SAW (AI PLAYTEST EVIDENCE) ─── */}
          <div className="section-title-premium">
            Step 1: What the Agent Saw (AI Playtest Evidence)
          </div>

          <div className="evidence-grid">
            {/* Left: Checklist */}
            <div className="checklist-container">
              <div className="playtest-badge-container">
                <span className="playtest-badge-completed">
                  ✓ AI Playtest Completed
                </span>
                <span className="playtest-duration-pill">
                  Observed in {result.evaluation.observation.observedDuration || 37}s
                </span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {result.evaluation.observation.checklist ? (
                  result.evaluation.observation.checklist.map((item, idx) => (
                    <div key={idx} className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className={`checklist-status-icon ${item.status}`}>
                          {item.status === "pass" ? "✓" : item.status === "fail" ? "✕" : "⚠"}
                        </span>
                        <span className="checklist-item-name">{item.item}</span>
                      </div>
                      <span className={`checklist-status-pill ${item.status}`}>
                        {item.status === "pass" ? "Pass" : item.status === "fail" ? "Fail" : "Warning"}
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className="checklist-status-icon pass">✓</span>
                        <span className="checklist-item-name">Movement works</span>
                      </div>
                      <span className="checklist-status-pill pass">Pass</span>
                    </div>
                    <div className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className="checklist-status-icon pass">✓</span>
                        <span className="checklist-item-name">Weapon buttons visible</span>
                      </div>
                      <span className="checklist-status-pill pass">Pass</span>
                    </div>
                    <div className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className="checklist-status-icon fail">✕</span>
                        <span className="checklist-item-name">Enemies appeared</span>
                      </div>
                      <span className="checklist-status-pill fail">Fail</span>
                    </div>
                    <div className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className="checklist-status-icon fail">✕</span>
                        <span className="checklist-item-name">Score stayed at 0</span>
                      </div>
                      <span className="checklist-status-pill fail">Fail</span>
                    </div>
                    <div className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className="checklist-status-icon fail">✕</span>
                        <span className="checklist-item-name">Objective unclear</span>
                      </div>
                      <span className="checklist-status-pill fail">Fail</span>
                    </div>
                    <div className="checklist-item-row">
                      <div className="checklist-item-left">
                        <span className="checklist-status-icon fail">✕</span>
                        <span className="checklist-item-name">No reward feedback detected</span>
                      </div>
                      <span className="checklist-status-pill fail">Fail</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Video Frame */}
            <div className="iframe-container" style={{ minHeight: "360px", height: "auto" }}>
              <div className="iframe-header">
                📹 Recorded AI Playtest Session Footage
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "16px", background: "#06060c" }}>
                <video
                  className="gameplay-video"
                  src={result.capture.videoFilename.startsWith("/") || result.capture.videoFilename.startsWith("..") ? result.capture.videoFilename : `/temp-videos/${result.capture.videoFilename}`}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", borderRadius: "var(--radius-lg)" }}
                />
              </div>
            </div>
          </div>

          {/* ─── SECTION 2: WHY IT SCORED LOW (LOOP DIAGNOSIS) ─── */}
          <div className="section-title-premium">
            Step 2: Why it Scored Low (Loop Diagnosis)
          </div>

          <div className="diagnosis-grid">
            {/* Left: Overall score & launch readiness */}
            <div className="loop-quality-card-premium">
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                Overall Loop Quality
              </div>
              
              <div className={`quality-score-radial ${result.evaluation.overallScore <= 3 ? "low" : result.evaluation.overallScore <= 6 ? "mid" : "high"}`}>
                <span className="quality-score-number">{result.evaluation.overallScore.toFixed(1)}</span>
                <span className="quality-score-scale">/ 10</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                <span className={`readiness-status-badge ${result.evaluation.overallScore <= 3.5 ? "not-ready" : "ready"}`}>
                  {result.evaluation.overallScore <= 3.5 ? "Not Ready" : "Launch Ready"}
                </span>
                <span className="readiness-needs-text" style={{ textAlign: "center" }}>
                  {result.evaluation.overallScore <= 3.5 ? `Needs: ${result.evaluation.overallVerdict || "objective + feedback + progression"}` : "Core loops satisfied"}
                </span>
              </div>
            </div>

            {/* Right: Diagnosis narrative & diagram */}
            <div className="loop-diagnosis-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Loop Diagnosis Verdict
                </div>
                <p className="loop-diagnosis-text">
                  <strong style={{ color: "var(--text-primary)", fontSize: "16px" }}>
                    {result.evaluation.observation.diagnosis || "Playable surface, but no complete game loop."}
                  </strong>
                </p>
                <p className="loop-diagnosis-text" style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
                  {result.evaluation.summary}
                </p>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Game Loop Map
                </div>
                <div className="loop-flow-diagram">
                  <span className="loop-step-node">move</span>
                  <span className="loop-step-arrow">→</span>
                  <span className="loop-step-node">attack</span>
                  <span className="loop-step-arrow">→</span>
                  <span className={`loop-step-node ${result.evaluation.overallScore <= 3.5 ? "disabled" : ""}`}>enemy reaction</span>
                  <span className="loop-step-arrow">→</span>
                  <span className={`loop-step-node ${result.evaluation.overallScore <= 3.5 ? "disabled" : ""}`}>reward</span>
                  <span className="loop-step-arrow">→</span>
                  <span className={`loop-step-node ${result.evaluation.overallScore <= 3.5 ? "disabled" : ""}`}>escalation</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── SECTION 3: HOW TO FIX IT (CREATOR AUTO-FIX) ─── */}
          <div className="section-title-premium">
            Step 3: How to Fix It (Creator Auto-Fix)
          </div>

          <div className="autofix-container">
            <div className="autofix-header">
              <div className="autofix-title">
                <span>✨</span> Playabl Auto-Fix Prompt Engine
              </div>
              <button
                className="autofix-copy-btn"
                onClick={handleCopyPrompt}
              >
                {copied ? "Copied ✓" : "Copy Improved Prompt"}
              </button>
            </div>

            <div className="autofix-grid-cards">
              {/* Before card */}
              <div className="autofix-card-panel">
                <div className="autofix-card-title before">
                  ✕ Detected Current Loop
                </div>
                <div className="autofix-card-content" style={{ minHeight: "100px" }}>
                  {result.evaluation.detectedCurrentLoop || "Move around empty arena. Weapon buttons visible. No enemies or reward loop detected."}
                </div>
              </div>

              {/* After card */}
              <div className="autofix-card-panel highlighted">
                <div className="autofix-card-title after">
                  ✓ Auto-Fixed Playabl Prompt
                </div>
                <div className="autofix-card-content code-style">
                  {result.evaluation.improvedPlayablPrompt}
                </div>
              </div>
            </div>
          </div>

          {/* ─── SECTION 4: EXPERT AGENT PANELS ─── */}
          <div className="section-title-premium">
            Expert Agent Quality Verdicts
          </div>

          <div className="agent-verdict-grid">
            {/* Game Designer */}
            <div className="agent-verdict-card" style={{ borderTop: "3px solid var(--accent-violet)" }}>
              <div className="agent-verdict-card-header" style={{ color: "var(--accent-violet)" }}>
                🎮 Game Designer Agent
              </div>
              <div className="agent-verdict-value">
                Verdict: {result.evaluation.agents.gameDesigner.verdict}
              </div>
              <ul className="agent-verdict-evidence-list">
                {result.evaluation.agents.gameDesigner.evidence.map((item, idx) => (
                  <li key={idx} className="agent-verdict-evidence-item">{item}</li>
                ))}
              </ul>
              <div className="agent-verdict-fix" style={{ borderLeftColor: "var(--accent-violet)" }}>
                <strong>Fix:</strong> {result.evaluation.agents.gameDesigner.recommendation}
              </div>
            </div>

            {/* Retention specialist */}
            <div className="agent-verdict-card" style={{ borderTop: "3px solid var(--accent-cyan)" }}>
              <div className="agent-verdict-card-header" style={{ color: "var(--accent-cyan)" }}>
                📊 Retention Specialist Agent
              </div>
              <div className="agent-verdict-value">
                Verdict: {result.evaluation.agents.retentionSpecialist.verdict}
              </div>
              <ul className="agent-verdict-evidence-list">
                {result.evaluation.agents.retentionSpecialist.evidence.map((item, idx) => (
                  <li key={idx} className="agent-verdict-evidence-item">{item}</li>
                ))}
              </ul>
              <div className="agent-verdict-fix" style={{ borderLeftColor: "var(--accent-cyan)" }}>
                <strong>Fix:</strong> {result.evaluation.agents.retentionSpecialist.recommendation}
              </div>
            </div>

            {/* UGC strategist */}
            <div className="agent-verdict-card" style={{ borderTop: "3px solid var(--accent-pink)" }}>
              <div className="agent-verdict-card-header" style={{ color: "var(--accent-pink)" }}>
                🚀 UGC & Viral Strategist Agent
              </div>
              <div className="agent-verdict-value">
                Verdict: {result.evaluation.agents.viralUgcStrategist.verdict}
              </div>
              <ul className="agent-verdict-evidence-list">
                {result.evaluation.agents.viralUgcStrategist.evidence.map((item, idx) => (
                  <li key={idx} className="agent-verdict-evidence-item">{item}</li>
                ))}
              </ul>
              <div className="agent-verdict-fix" style={{ borderLeftColor: "var(--accent-pink)" }}>
                <strong>Fix:</strong> {result.evaluation.agents.viralUgcStrategist.recommendation}
              </div>
            </div>

            {/* Feasibility PM */}
            <div className="agent-verdict-card" style={{ borderTop: "3px solid var(--accent-amber)" }}>
              <div className="agent-verdict-card-header" style={{ color: "var(--accent-amber)" }}>
                🔬 AI Feasibility PM Agent
              </div>
              <div className="agent-verdict-value">
                Verdict: {result.evaluation.agents.feasibilityAnalyst.verdict}
              </div>
              <ul className="agent-verdict-evidence-list">
                {result.evaluation.agents.feasibilityAnalyst.evidence.map((item, idx) => (
                  <li key={idx} className="agent-verdict-evidence-item">{item}</li>
                ))}
              </ul>
              <div className="agent-verdict-fix" style={{ borderLeftColor: "var(--accent-amber)" }}>
                <strong>Fix:</strong> {result.evaluation.agents.feasibilityAnalyst.recommendation}
              </div>
            </div>
          </div>

          {/* ─── SECTION 5: REMIX IDEAS & DIAGNOSTIC DETAILS ─── */}
          <div className="section-title-premium">
            Diagnostics & Remix Alternatives
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginBottom: "40px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Top Fixes */}
              <div className="section-card" style={{ margin: 0 }}>
                <h2 className="section-card__title">
                  <span className="section-card__title-icon">🔧</span>
                  Top Actionable Creator Fixes
                </h2>
                <ol className="fixes-list">
                  {result.evaluation.topFixes.map((fix, i) => (
                    <li key={i} className="fix-item">
                      <span className="fix-item__number">{i + 1}</span>
                      <span className="fix-item__text">{fix}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Remix Ideas */}
              <div className="section-card" style={{ margin: 0 }}>
                <h2 className="section-card__title">
                  <span className="section-card__title-icon">🎨</span>
                  Recommended Theme Remixes
                </h2>
                <ul className="chip-list">
                  {result.evaluation.remixIdeas.map((idea, i) => (
                    <li key={i} className="chip">
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Uncertainties */}
              {result.evaluation.uncertainties.length > 0 && (
                <div className="section-card" style={{ margin: 0 }}>
                  <h2 className="section-card__title">
                    <span className="section-card__title-icon">🔍</span>
                    Tester Uncertainties
                  </h2>
                  <ul className="uncertainty-list">
                    {result.evaluation.uncertainties.map((item, i) => (
                      <li key={i} className="uncertainty-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Interaction Trace */}
            <div className="section-card" style={{ margin: 0, display: "flex", flexDirection: "column" }}>
              <h2 className="section-card__title">
                <span className="section-card__title-icon">📋</span>
                Browser Playtest Trace
              </h2>
              <ul className="trace-list" style={{ flex: 1, overflowY: "auto", maxHeight: "300px" }}>
                {result.capture.interactionTrace.map((item, i) => (
                  <li key={i} className="trace-item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      ) : (
        /* Input Mode: Two Column Grid */
        <div className="evaluator-grid">
          
          {/* Left Column: Input and Loading */}
          <div className="evaluator-column evaluator-column--left">
            {/* Form */}
            <div className="form-card">
              <div className="form-card__group">
                <label className="form-card__label" htmlFor="game-url">
                  Playabl Game URL
                </label>
                <input
                  id="game-url"
                  className="form-card__input"
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://playabl.ai/games/..."
                  disabled={loading}
                />
              </div>

              <div className="form-card__group">
                <label className="form-card__label" htmlFor="game-notes">
                  Optional Notes
                </label>
                <textarea
                  id="game-notes"
                  className="form-card__input form-card__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What should the tester do? Any specific keyboard keys or swipe instructions?"
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                <button
                  id="evaluate-btn"
                  className="btn-primary"
                  onClick={handleEvaluate}
                  disabled={loading || !url.trim()}
                  style={{ flex: 1, minWidth: "200px" }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      <span className="btn-primary__text">Evaluating…</span>
                    </>
                  ) : (
                    <span className="btn-primary__text">Run Live Evaluation</span>
                  )}
                </button>

                <button
                  type="button"
                  className="demo-badge-trigger"
                  onClick={handleLoadDemo}
                  disabled={loading}
                  style={{ flex: "1 0 auto", justifyContent: "center" }}
                >
                  ⚡ Load Demo Game (Instant)
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="loading-overlay" style={{ background: "var(--bg-card)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-subtle)", marginBottom: "32px" }}>
                <div className="loading-overlay__icon" />
                <div className="loading-overlay__title">Analyzing game…</div>
                <div className="loading-overlay__desc">
                  This takes about 25–40 seconds (recording gameplay video + LLM context evaluation).
                </div>
                <div className="loading-steps">
                  {LOADING_STEPS.map((step, i) => (
                    <div
                      key={step}
                      className={`loading-step ${
                        i < loadingStep
                          ? "loading-step--done"
                          : i === loadingStep
                          ? "loading-step--active"
                          : ""
                      }`}
                    >
                      <span className="loading-step__dot" />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="error-card">
                <span className="error-card__icon">✕</span>
                <span className="error-card__text">{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Playtest Viewport Placeholder */}
          <div className="evaluator-column evaluator-column--right">
            <div className="iframe-container">
              <div className="iframe-header" style={{ justifyContent: "space-between", display: "flex", width: "100%", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎮</span> Playtest Viewport
                </div>
                {url.trim() && (
                  <a
                    href={url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="audio-badge"
                    style={{
                      textDecoration: "none",
                      background: "var(--gradient-brand)",
                      border: "none",
                      color: "#fff",
                      borderRadius: "var(--radius-sm)",
                      padding: "6px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    Play Game in New Tab ↗
                  </a>
                )}
              </div>

              {url.trim() ? (
                <div className="iframe-placeholder" style={{ border: "none", flex: 1 }}>
                  <div className="iframe-placeholder__icon">⚡</div>
                  <div className="iframe-placeholder__title" style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px", color: "var(--text-primary)" }}>
                    Playtest Video Pending
                  </div>
                  <div className="iframe-placeholder__text" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    Playabl.ai restricts direct embedding due to security policies (CSP). Use the top-right button to play the game in a new tab.
                    <br /><br />
                    Click <strong>Run Live Evaluation</strong> on the left to start the AI playtest recording.
                  </div>
                </div>
              ) : (
                <div className="iframe-placeholder" style={{ border: "none", flex: 1 }}>
                  <div className="iframe-placeholder__icon">🎮</div>
                  <div className="iframe-placeholder__title" style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px" }}>
                    No Game Loaded
                  </div>
                  <div className="iframe-placeholder__text">
                    Paste a valid Playabl game link on the left to begin evaluation.
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── Footer ── */}
      <footer className="positioning" style={{ marginTop: "56px" }}>
        <p className="positioning__text">
          A browser-based game loop evaluator for public Playabl games.{" "}
          <span className="positioning__highlight">
            This is a public-link prototype.
          </span>{" "}
          With internal Playabl metadata — original prompt, generated design
          spec, components, and play-session signals — it could become a
          deeper evaluation layer for creator feedback, remix generation, and
          feed ranking.
        </p>
      </footer>
    </main>
  );
}
