from actions import ActionType
from game_state import GameState


def replay(seed: int, run_id: str, action_log: list[dict]) -> GameState:
    state = GameState.from_seed(seed=seed, run_id=run_id)

    for record in action_log:
        state.apply_action(
            ActionType(record["action"]),
            target_id=record.get("target_id"),
        )

    return state

