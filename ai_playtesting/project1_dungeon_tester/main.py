import json

from agents import (
    DetectorAgent,
    ObserverAgent,
    ReporterAgent,
    ReplayAgent,
    ReviewerAgent,
    RunnerAgent,
    default_chest_duplicate_script,
)


def print_json(title: str, value) -> None:
    print(f"\n== {title} ==")
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main() -> None:
    runner = RunnerAgent()
    observer = ObserverAgent()
    replay_agent = ReplayAgent()
    detector = DetectorAgent()
    reporter = ReporterAgent()
    reviewer = ReviewerAgent()

    state = runner.run(
        seed=83721,
        run_id="run_83721_001",
        script=default_chest_duplicate_script(),
    )
    observation = observer.summarize(state)
    replay_check = replay_agent.check(state)
    issues = detector.detect(state.event_log)
    qa_report = reporter.report(issues, observation)
    review = reviewer.review(qa_report, issues)

    print_json("Initial Seed", state.seed)
    print_json("Action Log", state.action_log)
    print_json("Event Log", state.event_log)
    print_json("Final GameState", state.snapshot())
    print_json("Replay Check", replay_check)
    print_json("Detector Issues", issues)
    print("\n== QA Report Draft ==")
    print(qa_report)
    print_json("Reviewer Result", review)


if __name__ == "__main__":
    main()
