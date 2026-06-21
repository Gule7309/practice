def base_event(
    *,
    state,
    event: str,
    action: str,
    position_before: tuple[int, int],
    position_after: tuple[int, int],
    result: str,
) -> dict:
    return {
        "seed": state.seed,
        "run_id": state.run_id,
        "turn": state.turn,
        "agent_id": state.agent_id,
        "agent_type": state.agent_type,
        "event": event,
        "action": action,
        "position_before": list(position_before),
        "position_after": list(position_after),
        "result": result,
    }


def chest_opened_event(
    *,
    state,
    position_before: tuple[int, int],
    chest_id: str,
    chest: dict,
    state_before: str,
    state_after: str,
    gold_before: int,
    gold_after: int,
    result: str,
) -> dict:
    event = base_event(
        state=state,
        event="ChestOpened",
        action="OpenChest",
        position_before=position_before,
        position_after=state.player_position,
        result=result,
    )
    event.update(
        {
            "object_type": "chest",
            "object_id": chest_id,
            "object_position": list(chest["position"]),
            "object_state_before": state_before,
            "object_state_after": state_after,
            "gold_before": gold_before,
            "gold_after": gold_after,
        }
    )
    return event

