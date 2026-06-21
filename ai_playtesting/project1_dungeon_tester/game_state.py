from dataclasses import dataclass, field
from random import Random

from actions import ActionRecord, ActionType
from events import base_event, chest_opened_event


Position = tuple[int, int]


@dataclass
class GameState:
    seed: int
    run_id: str
    agent_id: str = "agent_001"
    agent_type: str = "ManualTester"
    turn: int = 0
    map_width: int = 5
    map_height: int = 5
    player_position: Position = (0, 0)
    player_hp: int = 5
    player_gold: int = 0
    inventory: list[str] = field(default_factory=list)
    walls: set[Position] = field(default_factory=set)
    objects: dict[str, dict] = field(default_factory=dict)
    opened_chests: set[str] = field(default_factory=set)
    action_log: list[dict] = field(default_factory=list)
    event_log: list[dict] = field(default_factory=list)

    @classmethod
    def from_seed(cls, seed: int, run_id: str) -> "GameState":
        rng = Random(seed)
        state = cls(seed=seed, run_id=run_id)
        state.walls = {(1, 0), (1, 1), (3, 3)}
        chest_position = (2 + rng.randrange(2), 2)
        state.objects = {
            "chest_01": {
                "type": "chest",
                "position": chest_position,
                "state": "closed",
                "reward": {"gold": 10},
            }
        }
        return state

    def snapshot(self) -> dict:
        return {
            "seed": self.seed,
            "run_id": self.run_id,
            "turn": self.turn,
            "player_position": list(self.player_position),
            "player_hp": self.player_hp,
            "player_gold": self.player_gold,
            "inventory": list(self.inventory),
            "opened_chests": sorted(self.opened_chests),
            "objects": self.objects,
        }

    def apply_action(
        self,
        action: ActionType,
        *,
        target_id: str | None = None,
    ) -> None:
        position_before = self.player_position
        self.action_log.append(
            ActionRecord(
                seed=self.seed,
                run_id=self.run_id,
                turn=self.turn,
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                action=action,
                target_id=target_id,
                position_before=position_before,
            ).to_dict()
        )

        if action in {
            ActionType.MOVE_UP,
            ActionType.MOVE_DOWN,
            ActionType.MOVE_LEFT,
            ActionType.MOVE_RIGHT,
        }:
            self._move(action, position_before)
        elif action == ActionType.OPEN_CHEST:
            self._open_chest(target_id, position_before)
        elif action == ActionType.WAIT:
            self.event_log.append(
                base_event(
                    state=self,
                    event="Waited",
                    action=action.value,
                    position_before=position_before,
                    position_after=self.player_position,
                    result="success",
                )
            )
        else:
            self.event_log.append(
                base_event(
                    state=self,
                    event="InvalidAction",
                    action=str(action),
                    position_before=position_before,
                    position_after=self.player_position,
                    result="unsupported_action",
                )
            )

        self.turn += 1

    def _move(self, action: ActionType, position_before: Position) -> None:
        dx, dy = {
            ActionType.MOVE_UP: (0, -1),
            ActionType.MOVE_DOWN: (0, 1),
            ActionType.MOVE_LEFT: (-1, 0),
            ActionType.MOVE_RIGHT: (1, 0),
        }[action]
        target = (self.player_position[0] + dx, self.player_position[1] + dy)

        if not self._is_walkable(target):
            self.event_log.append(
                base_event(
                    state=self,
                    event="MoveBlocked",
                    action=action.value,
                    position_before=position_before,
                    position_after=self.player_position,
                    result="blocked",
                )
            )
            return

        self.player_position = target
        self.event_log.append(
            base_event(
                state=self,
                event="PlayerMoved",
                action=action.value,
                position_before=position_before,
                position_after=self.player_position,
                result="success",
            )
        )

    def _open_chest(self, target_id: str | None, position_before: Position) -> None:
        if target_id is None or target_id not in self.objects:
            self.event_log.append(
                base_event(
                    state=self,
                    event="InvalidAction",
                    action=ActionType.OPEN_CHEST.value,
                    position_before=position_before,
                    position_after=self.player_position,
                    result="missing_target",
                )
            )
            return

        chest = self.objects[target_id]
        if chest["type"] != "chest" or chest["position"] != self.player_position:
            self.event_log.append(
                base_event(
                    state=self,
                    event="InvalidAction",
                    action=ActionType.OPEN_CHEST.value,
                    position_before=position_before,
                    position_after=self.player_position,
                    result="target_not_reachable",
                )
            )
            return

        state_before = chest["state"]
        gold_before = self.player_gold

        if state_before == "opened":
            result = "already_opened"
        else:
            self.player_gold += chest["reward"]["gold"]
            chest["state"] = "opened"
            self.opened_chests.add(target_id)
            result = "reward_granted"

        self.event_log.append(
            chest_opened_event(
                state=self,
                position_before=position_before,
                chest_id=target_id,
                chest=chest,
                state_before=state_before,
                state_after=chest["state"],
                gold_before=gold_before,
                gold_after=self.player_gold,
                result=result,
            )
        )

    def _is_walkable(self, position: Position) -> bool:
        x, y = position
        if x < 0 or y < 0 or x >= self.map_width or y >= self.map_height:
            return False
        return position not in self.walls
