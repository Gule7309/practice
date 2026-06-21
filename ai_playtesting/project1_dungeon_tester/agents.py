from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from actions import ActionType
from detectors import detect_duplicate_rewards
from game_state import GameState
from llm_client import LLMUnavailable, LocalLlama3Client
from replay import replay


@dataclass(frozen=True)
class ScriptedAction:
    action: ActionType
    target_id: str | None = None


class RunnerAgent:
    def run(self, seed: int, run_id: str, script: list[ScriptedAction]) -> GameState:
        state = GameState.from_seed(seed=seed, run_id=run_id)
        for step in script:
            state.apply_action(step.action, target_id=step.target_id)
        return state


class ReplayAgent:
    def check(self, state: GameState) -> dict[str, bool]:
        replayed = replay(
            seed=state.seed,
            run_id=f"{state.run_id}_replay",
            action_log=state.action_log,
        )
        return {
            "same_final_state": _without_run_id(state.snapshot())
            == _without_run_id(replayed.snapshot()),
            "same_event_log_except_run_id": _normalize_run_id(state.event_log)
            == _normalize_run_id(replayed.event_log),
        }


class ObserverAgent:
    def summarize(self, state: GameState) -> dict[str, Any]:
        return {
            "seed": state.seed,
            "run_id": state.run_id,
            "turns": state.turn,
            "action_count": len(state.action_log),
            "event_count": len(state.event_log),
            "final_state": state.snapshot(),
            "action_log": state.action_log,
            "event_log": state.event_log,
        }


class DetectorAgent:
    def detect(self, event_log: list[dict]) -> list[dict]:
        return detect_duplicate_rewards(event_log)


class ReporterAgent:
    def __init__(self, llm_client: LocalLlama3Client | None = None) -> None:
        self.llm_client = llm_client or LocalLlama3Client()

    def report(self, issues: list[dict], observation: dict[str, Any]) -> str:
        if not issues:
            return self._fallback_report(issues, observation)

        try:
            return self._llm_report(issues, observation)
        except LLMUnavailable as error:
            return self._fallback_report(issues, observation, fallback_reason=str(error))

    def _llm_report(self, issues: list[dict], observation: dict[str, Any]) -> str:
        system_prompt = (
            "You are a game QA report writer. "
            "Write concise reproducible QA reports using only the supplied evidence. "
            "Include Title, Severity, Category, Seed, Run ID, Steps, Expected, Actual, Evidence. "
            "The report must explicitly cite seed, run_id, object_id, turn, gold_before, and gold_after "
            "when those values are present in the supplied issue evidence."
        )
        user_prompt = json.dumps(
            {
                "issues": issues,
                "event_log": observation["event_log"],
                "action_log": observation["action_log"],
            },
            ensure_ascii=False,
            indent=2,
        )
        return self.llm_client.generate(system_prompt, user_prompt)

    def _fallback_report(
        self,
        issues: list[dict],
        observation: dict[str, Any],
        *,
        fallback_reason: str | None = None,
    ) -> str:
        lines = ["# QA Report Draft", ""]
        if fallback_reason:
            lines.extend(
                [
                    "ReporterAgent fallback:",
                    f"- Local Llama3 unavailable: {fallback_reason}",
                    "",
                ]
            )

        if not issues:
            lines.extend(
                [
                    "Result:",
                    "- No detector issues found.",
                    "",
                    "Evidence:",
                    f"- seed: {observation['seed']}",
                    f"- run_id: {observation['run_id']}",
                    f"- action_count: {observation['action_count']}",
                    f"- event_count: {observation['event_count']}",
                ]
            )
            return "\n".join(lines)

        for issue in issues:
            evidence = issue["evidence"]
            lines.extend(
                [
                    f"Title: {issue['title']}",
                    f"Severity: {issue['severity']}",
                    f"Category: {issue['category']}",
                    f"Seed: {issue['seed']}",
                    f"Run ID: {issue['run_id']}",
                    "",
                    "Reproduction Steps:",
                    f"1. Start a dungeon run with seed {issue['seed']}.",
                    f"2. Replay action log for run {issue['run_id']}.",
                    f"3. Inspect ChestOpened event at turn {issue['turn']}.",
                    "",
                    "Expected:",
                    "- Reopening an already opened chest should not grant gold.",
                    "",
                    "Actual:",
                    (
                        f"- {issue['object_id']} granted gold again: "
                        f"{evidence['gold_before']} -> {evidence['gold_after']}."
                    ),
                    "",
                    "Evidence:",
                    f"- object_id: {issue['object_id']}",
                    f"- turn: {issue['turn']}",
                    f"- result: {evidence['result']}",
                    f"- object_state_before: {evidence['object_state_before']}",
                    f"- object_state_after: {evidence['object_state_after']}",
                    "",
                ]
            )

        return "\n".join(lines)


class ReviewerAgent:
    REQUIRED_REPORT_TERMS = ["Title", "Severity", "Category", "Expected", "Actual", "Evidence"]
    REQUIRED_NO_ISSUE_TERMS = ["Result", "No detector issues found", "Evidence"]

    def review(self, report: str, issues: list[dict] | None = None) -> dict[str, Any]:
        required_terms = (
            self.REQUIRED_NO_ISSUE_TERMS
            if "No detector issues found" in report
            else self.REQUIRED_REPORT_TERMS
        )
        missing = [term for term in required_terms if term not in report]
        evidence_errors = self._review_evidence_grounding(report, issues or [])
        return {
            "passed": not missing and not evidence_errors,
            "missing_terms": missing,
            "evidence_errors": evidence_errors,
        }

    def _review_evidence_grounding(self, report: str, issues: list[dict]) -> list[str]:
        errors: list[str] = []
        for issue in issues:
            evidence = issue.get("evidence", {})
            required_values = [
                str(issue.get("seed")),
                str(issue.get("run_id")),
                str(issue.get("object_id")),
                str(issue.get("turn")),
                str(evidence.get("gold_before")),
                str(evidence.get("gold_after")),
            ]
            for value in required_values:
                if value and value not in report:
                    errors.append(f"Report does not cite evidence value: {value}")
        return errors


def default_chest_duplicate_script() -> list[ScriptedAction]:
    return [
        ScriptedAction(ActionType.MOVE_DOWN),
        ScriptedAction(ActionType.MOVE_DOWN),
        ScriptedAction(ActionType.MOVE_RIGHT),
        ScriptedAction(ActionType.MOVE_RIGHT),
        ScriptedAction(ActionType.MOVE_RIGHT),
        ScriptedAction(ActionType.OPEN_CHEST, target_id="chest_01"),
        ScriptedAction(ActionType.OPEN_CHEST, target_id="chest_01"),
    ]


def _normalize_run_id(events: list[dict]) -> list[dict]:
    normalized = []
    for event in events:
        copy = dict(event)
        copy["run_id"] = "<normalized>"
        normalized.append(copy)
    return normalized


def _without_run_id(snapshot: dict) -> dict:
    copy = dict(snapshot)
    copy["run_id"] = "<normalized>"
    return copy
