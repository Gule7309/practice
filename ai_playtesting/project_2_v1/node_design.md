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
- state.WorkingMemory.last_review_result
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
- state.WorkingMemory.last_review_result (for replan)

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