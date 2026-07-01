### Agent: Supervisor

#### Responsibility:
The Supervisor Agent is the coordinator of the multi-agent playtesting system.

Its main responsibility is to inspect the current shared state, read the latest agent outputs, and decide which agent should run next. It controls the high-level execution flow, but it does not perform domain-specific work itself.

The Supervisor should not directly play the game, classify the game, verify bugs, recover the browser environment, or write the final report. Those responsibilities belong to specialist agents.

#### Input:
- state.RunContext.run_id
- state.RunContext.status
- state.RunContext.step
- state.RunContext.max_steps
- state.RunContext.stop_reason
- state.TestPlan.goals
- state.TestPlan.current_goal_id
- state.TestPlan.checkpoints
- state.WorkingMemory.last_play_step
- state.WorkingMemory.last_play_review
- state.WorkingMemory.recovery_attempts
- state.Artifacts.trace_ids

#### Output:
The Supervisor outputs a decision object:

{
  "next_agent": "playtester",
  "decision": "continue",
  "reason": "The last step passed and there are still unfinished test goals.",
  "stop_reason": null
}

### Possible next_agent values:

"game_analyst"
"planner"
"playtester"
"critic"
"recovery"
"reporter"
"end"

### Possible decision values:

"analyze_game"
"plan_test"
"continue"
"review_step"
"recover"
"replan"
"report_now"
"end"

#### Does not:
- decide whether a bug is real
- write final report
- update long-term memory directly

#### routing rules:

The Supervisor follows this high-level policy:

if state.game is missing:
    next_agent = "game_analyst"

elif state.plan is missing:
    next_agent = "planner"

elif state.run.step >= state.run.max_steps:
    next_agent = "reporter"
    decision = "end"

elif latest_review recommends "recover" and recovery_attempts < max_recovery_attempts:
    next_agent = "recovery"
    decision = "recover"

elif latest_review reports high_or_critical_bug:
    next_agent = "reporter"
    decision = "report_now"

elif latest_review recommends "replan":
    next_agent = "planner"
    decision = "replan"

elif last_play_step exists and has not been reviewed:
    next_agent = "critic"
    decision = "review_step"

else:
    next_agent = "playtester"
    decision = "continue"

### Agent: Playtester Agent

#### Responsibility:
The Playtester Agent is responsible for performing one playtesting step inside the browser game environment.

It observes the current game state, selects a test goal from the current test plan, chooses a valid action, executes the action through the environment tools, observes the result, and returns a structured play step result.

The Playtester Agent is the main actor that interacts with the game. However, it does not decide whether a behavior is a real bug, does not generate the final report, and does not update long-term memory directly.

### Internal Procedure

For each playtesting step, the Playtester follows this procedure:

1. Observe current state
2. Select current test goal
3. Choose an allowed action
4. Execute the action
5. Observe the result
6. Return play_step_result

#### Input:
- state.RunContext.run_id
- state.RunContext.game_url
- state.TestPlan.current_goal_id

#### Output:
The Playtester outputs a structured play_step_result:

{
  "step": 3,
  "selected_goal": {
    "id": "movement_right",
    "goal": "Verify that the player can move right",
    "success_criteria": "The character or camera should move after pressing ArrowRight"
  },
  "action": {
    "name": "press_key",
    "params": {
      "key": "ArrowRight",
      "duration_ms": 500
    },
    "reason": "Test whether the player can move right",
    "expected_result": "The character or scene should move right"
  },
  "observation_before": {
    "screenshot_path": "data/runs/run_001/screenshots/step_003_before.png",
    "dom_summary": "A canvas element is visible",
    "console_errors": [],
    "page_status": "active"
  },
  "action_result": {
    "ok": true,
    "error": null
  },
  "observation_after": {
    "screenshot_path": "data/runs/run_001/screenshots/step_003_after.png",
    "dom_summary": "A canvas element is visible",
    "console_errors": [],
    "page_status": "active"
  }
}

#### Tools Access

The Playtester can use these tools:

Browser Controller

For browser-level operations:

open_page(url)
reload_page()
get_page_status()
close_page()
Input Controller

For game interaction:

click(x, y)
click_center()
press_key(key)
hold_key(key, duration_ms)
mouse_move(x, y)
Screenshot Tool

For visual observation:

take_screenshot(run_id, step, phase)

Where phase is:

"before"
"after"
DOM / Console Tool

For environment inspection:

get_dom_summary()
get_console_errors()
detect_canvas()
detect_focused_element()
Image Diff Tool

Optional in v1:

compare_screenshots(before_path, after_path)

The Playtester may collect image diff data, but it should not make the final bug judgment. That belongs to the Critic Agent.

#### Failure Handling

If the Playtester fails to execute an action, it should still return a structured result to tell Critic agent what happened. The Playtester does not decide whether this is a game bug or an environment failure. It returns the evidence to the Critic Agent.

### Agent: Planner Agent

#### Responsibility:
The Planner Agent is responsible for generating or revising the test plan for a playtesting run.

It reads the current game profile, run constraints, existing trace context, and any previous critic feedback, then produces a structured list of test goals and checkpoints that the Playtester Agent can attempt.

The Planner Agent does not directly interact with the game, does not choose low-level browser actions, and does not verify whether a bug is real. Its job is to define what should be tested, not how each action should be executed.

#### Input:
- state.RunContext.run_id
- state.RunContext.game_url
- state.TestPlan
- state.WorkingMemory.last_play_review (for replan)

#### Output:
The Planner outputs a structured test_plan_result:

{
  "plan_id": "plan_001",
  "planning_mode": "initial_plan",
  "reasoning_summary": "The game appears to be a browser canvas arcade game. The test plan prioritizes start, input response, movement, failure state, and restart behavior.",
  "goals": [
    {
      "id": "start_game",
      "goal": "Verify that the game can start",
      "priority": "high",
      "success_criteria": "After clicking or pressing a start input, the game should enter a playable state.",
      "suggested_controls": ["click_center", "Enter", "Space"],
      "risk_notes": ["The canvas may need focus before keyboard input works."],
      "status": "pending"
    },
    {
      "id": "basic_input_response",
      "goal": "Verify that the game responds to basic input",
      "priority": "high",
      "success_criteria": "After a simple click or key press, the screen should change or the game should visibly respond.",
      "suggested_controls": ["click_center", "ArrowRight", "Space"],
      "risk_notes": ["If there is no response, it may be a focus issue rather than a game bug."],
      "status": "pending"
    },
    {
      "id": "movement_or_primary_action",
      "goal": "Verify movement or the primary game action",
      "priority": "high",
      "success_criteria": "The player, camera, or game state should change after movement or primary action input.",
      "suggested_controls": ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"],
      "risk_notes": [],
      "status": "pending"
    },
    {
      "id": "failure_and_restart",
      "goal": "Verify that the game handles failure and restart states",
      "priority": "medium",
      "success_criteria": "If the game reaches a failure state, restart should return it to a playable state.",
      "suggested_controls": ["click_restart_if_visible", "Enter", "reload_page"],
      "risk_notes": ["Some games may not expose a restart button."],
      "status": "pending"
    }
  ],
  "critical_checkpoints": [
    "Game becomes playable",
    "Input causes visible response",
    "No critical console errors",
    "Game can recover from failure or restart"
  ]
}

#### Planning Guidelines
The Planner should create goals, not low-level scripts.

Good goal:

{
  "goal": "Verify basic movement",
  "success_criteria": "The character or scene should respond to movement input.",
  "suggested_controls": ["ArrowLeft", "ArrowRight", "Space"]
}

Bad goal:

{
  "goal": "Press ArrowRight for 500ms, then press Space, then wait 1 second, then click at x=500 y=300"
}
The bad version is too close to a deterministic script. Low-level action choice belongs to the Playtester Agent.

#### Failure Handling

If the Planner cannot confidently create a game-specific plan, it should fall back to a generic browser game smoke test plan:

{
  "planning_mode": "fallback_plan",
  "reasoning_summary": "The game type is uncertain, so the plan focuses on basic browser game smoke tests.",
  "goals": [
    {
      "id": "page_load",
      "goal": "Verify that the game page loads without critical errors",
      "priority": "high",
      "success_criteria": "The page is visible and no critical console errors appear.",
      "status": "pending"
    },
    {
      "id": "basic_interaction",
      "goal": "Verify that the page responds to basic click or keyboard input",
      "priority": "high",
      "success_criteria": "The screen, UI, or canvas changes after basic input.",
      "status": "pending"
    },
    {
      "id": "stability",
      "goal": "Verify that the game remains stable during a short interaction session",
      "priority": "medium",
      "success_criteria": "The page does not crash, freeze, or show a black screen.",
      "status": "pending"
    }
  ],
  "critical_checkpoints": [
    "Page loads",
    "Canvas or game UI appears",
    "Basic input response exists",
    "No crash or black screen"
  ]
}

### Agent: Game Analyst Agent

#### Responsibility:
The Game Analyst Agent is responsible for understanding the target game before the playtest plan is generated.

It inspects the initial game page, screenshot, DOM summary, console output, and optional prior memory to produce a structured GameProfile. This profile helps the Planner Agent create a more relevant test plan and helps the Playtester Agent understand likely controls, risks, and interaction patterns.

The Game Analyst does not create the full test plan, does not play the game step-by-step, and does not determine whether a behavior is a real bug.

#### Input:
- state.RunContext.run_id
- state.RunContext.game_url
- state.RunContext.status
- state.Artifact.screenshots
- state.Artifact.trace_ids (for the re-analyze for replanning)

### It may also receive environment observations from tools:

initial_screenshot
dom_summary
console_errors
page_title
page_url
canvas_detected
focused_element

The Game Analyst may optionally query Memory Store for prior game-type profiles, but it should not write to long-term memory directly.

#### Output:
The Game Analyst outputs a structured game_profile_result:

{
  "game_type": "platformer",
  "genre": "arcade",
  "confidence": 0.76,
  "known_or_unknown": "known",
  "classification_reason": [
    "The screenshot appears to show a side-view game area.",
    "The page contains a canvas element.",
    "The visible scene suggests character movement and obstacle avoidance."
  ],
  "control_hypothesis": [
    "ArrowLeft",
    "ArrowRight",
    "Space"
  ],
  "interaction_model": "keyboard_and_canvas",
  "initial_state_summary": "The game appears to be loaded in a canvas. No obvious modal is blocking the screen.",
  "risk_notes": [
    "The canvas may need focus before keyboard input works.",
    "The game may require a click before it starts.",
    "If there is no response to keyboard input, it may be an environment focus issue rather than a game bug."
  ],
  "recommended_planning_focus": [
    "start_game",
    "basic_input_response",
    "movement_or_primary_action",
    "stability"
  ]
}

#### Tool Access
The Game Analyst may use read-only observation tools:

screenshot_tool.get_latest_screenshot()
dom_console_tool.get_dom_summary()
dom_console_tool.get_console_errors()
dom_console_tool.detect_canvas()
browser_controller.get_page_status()
memory_store.lookup_game_type_profiles()

It should not use active input tools such as:

click()
press_key()
hold_key()
reload_page()

Those belong to the Playtester or Recovery Agent.

#### Classification Guidelines

The Game Analyst should classify the game conservatively.

If the evidence is weak, it should return:

{
  "game_type": "unknown_browser_game",
  "genre": "unknown",
  "confidence": 0.35,
  "known_or_unknown": "unknown",
  "control_hypothesis": ["click_center", "Space", "ArrowKeys"],
  "risk_notes": [
    "The initial screenshot does not provide enough evidence for a specific genre.",
    "Use a generic browser game smoke test plan."
  ]
}

The Game Analyst should prefer uncertainty over hallucinating a specific game type.

### Example Output: Unknown Game
{
  "game_type": "unknown_browser_game",
  "genre": "unknown",
  "confidence": 0.42,
  "known_or_unknown": "unknown",
  "classification_reason": [
    "The game page appears loaded, but the visible UI does not clearly indicate the game mechanics.",
    "A canvas element is present, suggesting an interactive browser game.",
    "No clear character, score, enemies, or controls are visible yet."
  ],
  "control_hypothesis": [
    "click_center",
    "Space",
    "Enter",
    "ArrowKeys"
  ],
  "interaction_model": "unknown_canvas_or_ui",
  "initial_state_summary": "The page appears interactive but the game type is not clear from the initial observation.",
  "risk_notes": [
    "The game may require a click to start.",
    "The canvas may need focus.",
    "The first test plan should focus on basic page load and input response."
  ],
  "recommended_planning_focus": [
    "page_load",
    "basic_interaction",
    "input_response",
    "stability"
  ]
}

#### Failure Handling

If the Game Analyst cannot classify the game confidently, it should not fail the run. Instead, it should return an unknown or fallback profile:

{
  "game_type": "unknown_browser_game",
  "genre": "unknown",
  "confidence": 0.2,
  "known_or_unknown": "unknown",
  "control_hypothesis": ["click_center", "Space", "Enter", "ArrowKeys"],
  "risk_notes": [
    "Insufficient visual evidence for game classification.",
    "Planner should use a generic smoke test plan."
  ],
  "recommended_planning_focus": [
    "page_load",
    "basic_interaction",
    "stability"
  ]
}

The system should continue to Planner using the fallback profile.

### Agent: Critic Agent

#### Responsibility:
The Critic Agent is responsible for reviewing the result of a playtesting step.

It reads the latest last_play_step produced by the Playtester Agent, compares the action and expected result against the before/after observations, and produces a structured review.

The Critic Agent does not operate the browser, does not choose the next action, and does not write the final report. Its job is to evaluate evidence and recommend what should happen next.

#### Input:
- state.RunContext.run_id
- state.RunContext.game_url
- state.RunContext.status
- state.TestPlan
- state.WorkingMemory.last_play_step
- state.Artifacts.screenshots (before and after)

#### Output:
The Critic outputs a structured review_result:

{
  "review_id": "review_003",
  "step": 3,
  "passed": false,
  "failure_type": "no_screen_change",
  "confidence": 0.82,
  "evidence_summary": "The Playtester pressed ArrowRight to test movement, but the before and after screenshots appear visually unchanged. No console errors were found.",
  "expected_result": "The character or scene should move after pressing ArrowRight.",
  "actual_result": "No visible movement or state change was detected.",
  "likely_cause": "environment_or_focus_issue",
  "bug_candidate": {
    "is_bug": false,
    "severity": "low",
    "title": null,
    "description": null,
    "evidence": []
  },
  "recommendation": "recover",
  "recommendation_reason": "The failure may be caused by the canvas not receiving keyboard focus. Recovery should try clicking the canvas center before retrying."
}

#### Bug Candidate Guidelines

The Critic should only create a bug candidate when there is enough evidence.

Good bug candidate:

{
  "is_bug": true,
  "severity": "high",
  "title": "Game crashes after pressing Start",
  "description": "After clicking the Start button, the page becomes black and a JavaScript error appears in the console.",
  "evidence": [
    "before_screenshot_path",
    "after_screenshot_path",
    "console_error_summary"
  ]
}

Weak bug candidate that should not be treated as confirmed:

{
  "is_bug": false,
  "severity": "low",
  "title": null,
  "description": null,
  "evidence": []
}

Example weak evidence:

The game did not respond to ArrowRight once, but the canvas may not have been focused.

In that case, the Critic should recommend recover or retry, not report_now.

#### Does Not Do

The Critic Agent must not:

click, press keys, or operate the browser
choose the next low-level action
revise the test plan directly
recover the environment directly
write the final report
update long-term memory directly
label weak evidence as a confirmed game bug
ignore possible agent or environment failure

#### Review Guidelines

The Critic should evaluate a play step using the following questions:

1. What was the selected goal?
2. What action did the Playtester take?
3. What was expected to happen?
4. What actually happened?
5. Did the action execute successfully?
6. Did the screen, DOM, console, or game state change?
7. Is the result enough to mark the goal as passed?
8. If not passed, what is the most likely cause?
9. Is this a possible game bug or an agent/environment issue?
10. What should the Supervisor do next?

### Agent: Recovery Agent

#### Responsibility:
The Recovery Agent is responsible for attempting to recover the browser game environment when a playtesting step fails due to a likely environment, focus, loading, or interaction issue.

It receives the latest Critic review, the latest play step, and the current environment observation, then chooses a safe recovery action. Its goal is to make the game testable again so the Playtester Agent can retry or continue.

The Recovery Agent does not determine whether a behavior is a real game bug, does not write the final report, and does not create a new test plan. It only attempts controlled recovery.

#### Input:
- state.RunContext.run_id
- state.RunContext.game_url
- state.RunContext.status
- state.TestPlan
- state.WorkingMemory.last_play_review
- state.WorkingMemory.recovery_attempts
- state.WorkingMemory.last_recovery_result
- state.WorkingMemory.recovery_history
- state.Artifacts.screenshots (before and after)

#### Output:
The Recovery Agent outputs a structured recovery_result:

{
  "recovery_id": "recovery_004",
  "step": 4,
  "trigger_failure_type": "input_not_received",
  "trigger_likely_cause": "environment_or_focus_issue",
  "recovery_action": {
    "name": "click_canvas_center",
    "params": {},
    "reason": "The previous keyboard input may not have reached the canvas because the game was not focused."
  },
  "observation_before_recovery": {
    "screenshot_path": "data/runs/run_001/screenshots/step_004_recovery_before.png",
    "page_status": "active",
    "canvas_detected": true,
    "focused_element": "body",
    "console_errors": []
  },
  "action_result": {
    "ok": true,
    "error": null
  },
  "observation_after_recovery": {
    "screenshot_path": "data/runs/run_001/screenshots/step_004_recovery_after.png",
    "page_status": "active",
    "canvas_detected": true,
    "focused_element": "canvas",
    "console_errors": []
  },
  "recovery_status": "recovered",
  "next_recommendation": "retry_last_goal",
  "reason": "The canvas appears focused after clicking the center. The previous goal can be retried."
}

#### Recovery Guidelines

The Recovery Agent should prefer low-risk recovery actions before high-risk actions.

Recommended order:

1. wait_for_loading
2. click_canvas_center
3. refocus_page
4. press_escape
5. close_modal_if_detected
6. scroll_to_game_area
7. reload_page
8. no_safe_recovery

The Recovery Agent should avoid destructive or state-resetting actions unless necessary.

For example:

reload_page

should usually be used only when:

- the page crashed
- the game is frozen
- the screen is black
- loading timeout persists
- lighter recovery actions failed

#### Recovery Attempt Limit

The Recovery Agent must respect a maximum recovery attempt limit.

Example policy:

MAX_RECOVERY_ATTEMPTS = 2

If the limit is reached, the Recovery Agent should return:

{
  "recovery_status": "max_attempts_reached",
  "next_recommendation": "report_now",
  "reason": "Recovery was attempted multiple times but the environment did not return to a testable state."
}

The Supervisor should then decide whether to report, replan, or end.

### Agent: Reporter Agent

#### Responsibility
The Reporter Agent is responsible for generating the final playtest report for a run.

It reads the validated run data, trace events, play steps, critic reviews, recovery events, bug candidates, screenshots, and console summaries, then produces a structured report.

The Reporter Agent does not play the game, does not verify new bugs, does not recover the environment, and does not modify the test plan. Its job is to summarize the evidence collected by previous agents into a clear, useful QA-style report.

#### Input
- state.RunContext.run_id
- state.RunContext.game_url
- state.RunContext.status
- state.RunContext.total_steps
- state.GameProfile
- state.TestPlan
- state.WorkingMemory.review_history
- state.WorkingMemory.recovery_history
- state.Artifacts

#### Output
The Reporter outputs a structured report_result:

{
  "report_id": "report_run_001",
  "run_id": "run_001",
  "report_title": "Playtest Report: Browser Game Run 001",
  "summary": "The agent loaded the game, identified it as an unknown browser canvas game, tested basic interaction, and found one high-confidence blocking issue.",
  "overall_status": "issues_found",
  "tested_goals": [
    {
      "goal_id": "page_load",
      "goal": "Verify that the game page loads",
      "status": "passed",
      "evidence": ["trace_001", "screenshots/step_001_after.png"]
    },
    {
      "goal_id": "basic_interaction",
      "goal": "Verify that the game responds to basic input",
      "status": "failed",
      "evidence": ["trace_003", "trace_004"]
    }
  ],
  "bugs_found": [
    {
      "severity": "high",
      "title": "Game turns black after clicking Start",
      "description": "After clicking the Start area, the game screen became black and the console showed an uncaught runtime error.",
      "evidence": [
        "screenshots/step_006_before.png",
        "screenshots/step_006_after.png",
        "console_logs/step_006.json",
        "trace_006"
      ]
    }
  ],
  "uncertain_observations": [
    {
      "title": "Keyboard input did not trigger movement",
      "reason": "The canvas may not have been focused, so this was not treated as a confirmed game bug.",
      "evidence": ["trace_003", "trace_004"]
    }
  ],
  "recommendations": [
    "Investigate the console error after the Start action.",
    "Make canvas focus behavior clearer to players.",
    "Add visible start or control instructions if possible."
  ],
  "report_markdown": "# Playtest Report\n..."
}

#### Report Guidelines

The final Markdown report should include these sections:

# Playtest Report

## 1. Run Summary

## 2. Game Profile

## 3. Test Plan

## 4. What the Agent Tried

## 5. Results by Test Goal

## 6. Bugs Found

## 7. Uncertain Observations

## 8. Recovery Attempts

## 9. Evidence

## 10. Recommendations

The report should be useful to a game developer or product team.

#### Evidence Rules

The Reporter must ground every major claim in evidence.

For each bug or issue, the report should include:

- related step number
- related test goal
- action taken
- expected result
- actual result
- critic review
- screenshot paths
- console error summary if available
- trace IDs

If evidence is weak, the Reporter should label the item as uncertain.

Example:

### Uncertain Observation: Keyboard input did not trigger movement

The agent pressed ArrowRight, but no visible movement was detected. However, the Critic classified this as a possible focus issue rather than a confirmed game bug. The Recovery Agent attempted to refocus the canvas.

Evidence:
- trace_003
- trace_004
- screenshots/step_003_before.png
- screenshots/step_003_after.png

#### Input Context Prepared by Reporter Node

The Reporter Agent should not receive only raw trace_ids.

The Reporter Node should first prepare a report context:

report_context = {
    "run": state["run"],
    "game": state["game"],
    "plan": state["plan"],
    "bug_candidates": state["working_memory"].get("bug_candidates", []),
    "trace_events": trace_store.load_events(
        state["artifacts"].get("trace_ids", [])
    ),
    "screenshot_paths": state["artifacts"].get("screenshots", []),
    "stop_reason": state["run"].get("stop_reason"),
}

Then the Reporter Agent receives:

reporter_agent.generate_report(report_context=report_context)

This keeps the agent focused on writing the report rather than retrieving raw data.

#### Failure Handling

If the Reporter cannot generate a complete report because evidence is missing, it should generate a partial report instead of failing silently.

Example:

{
  "report_id": "report_run_001",
  "overall_status": "partial_report",
  "summary": "The run ended before enough evidence was collected. This report summarizes the available trace events.",
  "bugs_found": [],
  "uncertain_observations": [
    {
      "title": "Insufficient evidence",
      "reason": "The run ended before the Critic Agent produced a review."
    }
  ],
  "recommendations": [
    "Rerun the playtest with more steps.",
    "Ensure screenshots and trace events are saved before report generation."
  ],
  "report_markdown": "# Partial Playtest Report\n..."
}