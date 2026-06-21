from __future__ import annotations

import time

from agents import ReporterAgent, ReviewerAgent
from llm_client import LLMUnavailable, LocalLlama3Client
from main import print_json
from reporter_fixture import build_fixture_issue, build_fixture_observation


class AlwaysUnavailableClient:
    def generate(self, system_prompt: str, user_prompt: str) -> str:
        raise LLMUnavailable("forced fallback for comparison")


def timed_report(label: str, reporter: ReporterAgent, issues: list[dict], observation: dict) -> dict:
    start = time.perf_counter()
    report = reporter.report(issues, observation)
    latency = time.perf_counter() - start
    review = ReviewerAgent().review(report, issues)
    return {
        "label": label,
        "latency_seconds": round(latency, 2),
        "review": review,
        "report": report,
    }


def main() -> None:
    observation = build_fixture_observation()
    issues = build_fixture_issue(observation)

    fallback_result = timed_report(
        "fallback",
        ReporterAgent(llm_client=AlwaysUnavailableClient()),
        issues,
        observation,
    )
    llama3_result = timed_report(
        "llama3",
        ReporterAgent(
            llm_client=LocalLlama3Client(timeout_seconds=15, max_attempts=3),
        ),
        issues,
        observation,
    )

    summary = {
        "fallback": _summary(fallback_result),
        "llama3": _summary(llama3_result),
        "selected_report": _select_report(fallback_result, llama3_result),
    }

    print_json("Comparison Summary", summary)
    print("\n== Fallback Report ==")
    print(fallback_result["report"])
    print("\n== Llama3 Report ==")
    print(llama3_result["report"])


def _summary(result: dict) -> dict:
    return {
        "latency_seconds": result["latency_seconds"],
        "review_passed": result["review"]["passed"],
        "missing_terms": result["review"]["missing_terms"],
        "evidence_errors": result["review"]["evidence_errors"],
        "used_fallback": "ReporterAgent fallback" in result["report"],
    }


def _select_report(fallback_result: dict, llama3_result: dict) -> str:
    if llama3_result["review"]["passed"] and "ReporterAgent fallback" not in llama3_result["report"]:
        return "llama3"
    if fallback_result["review"]["passed"]:
        return "fallback"
    return "none"


if __name__ == "__main__":
    main()

