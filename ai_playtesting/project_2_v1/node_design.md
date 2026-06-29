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

Responsibility:
Runs one playtesting step in the browser environment.

Input:
- state.run
- state.game
- state.plan
- state.working_memory
- tools.browser
- tools.screenshot
- tools.dom_console

Output:
- play_step_result

Does not:
- decide whether a bug is real
- write final report
- update long-term memory directly

### Agent: Supervisor

Responsibility:
Runs one playtesting step in the browser environment.

Input:
- state.run
- state.game
- state.plan
- state.working_memory
- tools.browser
- tools.screenshot
- tools.dom_console

Output:
- play_step_result

Does not:
- decide whether a bug is real
- write final report
- update long-term memory directly