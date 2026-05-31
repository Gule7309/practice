# AI Dungeon Tester v0 Brief

## 產品目的

做一個最小 grid dungeon，讓後續 agents 可以穩定測試、產生 event logs、action logs、replay 和 QA reports。

這不是完整遊戲。它是一個 AI playtesting sandbox。

## Non-goals

- 不做 3D。
- 不做美術。
- 不做完整 RPG。
- 不先用 RL。
- 不先做 LLM agent。
- 不做通用 QA 平台。

## Core Loop

```text
Generate map from seed
Initialize game state
Receive action
Apply rules
Update state
Emit events
Append action log
Stop on win/loss/max_turns
```

## Game State

```text
seed
turn
map_width
map_height
player_position
player_hp
player_gold
inventory
opened_chests
unlocked_doors
is_done
outcome
```

## Actions

```text
MoveUp
MoveDown
MoveLeft
MoveRight
Attack
OpenChest
UsePotion
PickUpItem
OpenDoor
Wait
```

## Events

```text
GameStarted
PlayerMoved
MoveBlocked
TrapTriggered
EnemyAttacked
PlayerDamaged
ItemPickedUp
ChestOpened
DoorOpened
ExitReached
PlayerDied
InvalidAction
GameEnded
```

## Replay Contract

```text
seed + action_sequence = same final state + same event log
```

如果這個 contract 不成立，後面的 bug report 就沒有 QA 價值。

## First Bugs To Seed Intentionally

第一版可以故意放 2 個 bug，讓 detector 有東西抓：

1. Duplicate chest reward
   - 同一個 chest 重複開會一直加 gold。

2. Unwinnable map
   - 某些 seed 產生 spawn 到 exit 不可達的地圖。

## Minimum Acceptance Criteria

- 可以用固定 seed 產生同一張地圖。
- 可以手動送 action sequence。
- 每個 action 都會進 action log。
- 重要 state change 都會進 event log。
- 相同 seed + actions 會得到相同結果。
- 至少能輸出一個簡單 QA report 草稿。

