from dataclasses import dataclass
from enum import Enum


class ActionType(str, Enum):
    MOVE_UP = "MoveUp"
    MOVE_DOWN = "MoveDown"
    MOVE_LEFT = "MoveLeft"
    MOVE_RIGHT = "MoveRight"
    OPEN_CHEST = "OpenChest"
    WAIT = "Wait"


@dataclass(frozen=True)
class ActionRecord:
    seed: int
    run_id: str
    turn: int
    agent_id: str
    agent_type: str
    action: ActionType
    target_id: str | None
    position_before: tuple[int, int]

    def to_dict(self) -> dict:
        return {
            "seed": self.seed,
            "run_id": self.run_id,
            "turn": self.turn,
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "action": self.action.value,
            "target_id": self.target_id,
            "position_before": list(self.position_before),
        }

