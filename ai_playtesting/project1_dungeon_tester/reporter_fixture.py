from agents import ReporterAgent, ReviewerAgent
from llm_client import LocalLlama3Client
from main import print_json


def build_fixture_observation() -> dict:
    event_log = [
        {
            "seed": 83721,
            "run_id": "fixture_run_001",
            "turn": 5,
            "agent_id": "agent_001",
            "agent_type": "ExploiterAgent",
            "event": "ChestOpened",
            "action": "OpenChest",
            "position_before": [3, 2],
            "position_after": [3, 2],
            "result": "reward_granted",
            "object_type": "chest",
            "object_id": "chest_01",
            "object_position": [3, 2],
            "object_state_before": "closed",
            "object_state_after": "opened",
            "gold_before": 0,
            "gold_after": 10,
        },
        {
            "seed": 83721,
            "run_id": "fixture_run_001",
            "turn": 6,
            "agent_id": "agent_001",
            "agent_type": "ExploiterAgent",
            "event": "ChestOpened",
            "action": "OpenChest",
            "position_before": [3, 2],
            "position_after": [3, 2],
            "result": "reward_granted",
            "object_type": "chest",
            "object_id": "chest_01",
            "object_position": [3, 2],
            "object_state_before": "opened",
            "object_state_after": "opened",
            "gold_before": 10,
            "gold_after": 20,
        },
    ]
    action_log = [
        {"turn": 5, "action": "OpenChest", "target_id": "chest_01"},
        {"turn": 6, "action": "OpenChest", "target_id": "chest_01"},
    ]
    return {
        "seed": 83721,
        "run_id": "fixture_run_001",
        "action_count": len(action_log),
        "event_count": len(event_log),
        "action_log": action_log,
        "event_log": event_log,
    }


def build_fixture_issue(observation: dict) -> list[dict]:
    duplicate_event = observation["event_log"][1]
    return [
        {
            "title": "Player can duplicate gold by reopening the same chest",
            "severity": "High",
            "category": "Economy exploit",
            "detector": "DuplicateRewardDetector",
            "seed": observation["seed"],
            "run_id": observation["run_id"],
            "turn": duplicate_event["turn"],
            "object_id": duplicate_event["object_id"],
            "evidence": duplicate_event,
        }
    ]


def main() -> None:
    observation = build_fixture_observation()
    issues = build_fixture_issue(observation)
    reporter = ReporterAgent(
        llm_client=LocalLlama3Client(timeout_seconds=15, max_attempts=3),
    )
    reviewer = ReviewerAgent()

    report = reporter.report(issues, observation)
    review = reviewer.review(report, issues)

    print_json("Fixture Issues", issues)
    print("\n== Fixture QA Report Draft ==")
    print(report)
    print_json("Reviewer Result", review)


if __name__ == "__main__":
    main()
