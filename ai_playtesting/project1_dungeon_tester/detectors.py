from collections.abc import Iterable


def detect_duplicate_rewards(event_log: Iterable[dict]) -> list[dict]:
    opened_chests: set[str] = set()
    reports: list[dict] = []

    for event in event_log:
        if event.get("event") != "ChestOpened":
            continue

        chest_id = event.get("object_id")
        gold_increased = event.get("gold_after", 0) > event.get("gold_before", 0)

        if chest_id in opened_chests and gold_increased:
            reports.append(
                {
                    "title": "Player can duplicate gold by reopening the same chest",
                    "severity": "High",
                    "category": "Economy exploit",
                    "detector": "DuplicateRewardDetector",
                    "seed": event["seed"],
                    "run_id": event["run_id"],
                    "turn": event["turn"],
                    "object_id": chest_id,
                    "evidence": event,
                }
            )

        if chest_id:
            opened_chests.add(chest_id)

    return reports

