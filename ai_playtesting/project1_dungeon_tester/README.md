# AI Dungeon Tester v0

Week 2 implementation slice.

This is not a full game. It is a minimal QA sandbox for proving:

```text
seed + action_log = same final GameState + same event_log
```

## v0 Mechanics

- movement
- wall
- chest

## v0 QA Target

`DuplicateRewardDetector` catches a deliberately preserved bug:

```text
Opening the same chest twice grants gold twice.
```

## Run

From this directory:

```bash
python main.py
```

Expected behavior:

- prints the action log
- prints the event log
- confirms replay consistency
- reports an economy exploit for duplicate chest reward

