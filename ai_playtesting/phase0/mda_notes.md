# MDA Notes

Source: https://users.cs.northwestern.edu/~hunicke/MDA.pdf

## 1. 一句話摘要

MDA 把遊戲拆成 Mechanics, Dynamics, Aesthetics；對 AI Playtesting 來說，重點是觀測 mechanics 在大量 agent 行為下產生的 dynamics。

## 2. 三層定義

### Mechanics

遊戲明確定義的規則、資料、演算法、可執行動作。

在 AI Dungeon Tester v0 中可能包含：

- grid map
- wall / trap / door / key / chest / exit
- HP, gold, inventory
- MoveUp / MoveDown / MoveLeft / MoveRight
- OpenChest / OpenDoor / Attack / Wait

### Dynamics

玩家或 agent 和 mechanics 互動後，在 runtime 出現的行為模式。

在 AI Dungeon Tester v0 中可能包含：

- agent 卡在 trap loop
- greedy agent 一直刷最近 treasure
- explorer agent 發現 exit 不可達
- speedrunner 找到 sequence break
- exploiter 重複開寶箱刷 gold

### Aesthetics

玩家實際感受到的體驗，例如 challenge, discovery, frustration, boredom。

AI Playtesting 第一版不直接測「好不好玩」，但可以用 telemetry 找到會導致壞體驗的 proxy：

- stuck rate 太高
- death rate 太高
- completion rate 太低
- reward loop 太單一
- optimal route 太固定

## 3. 對 AI Playtesting 的啟發

agent playtesting 的核心價值不是讓 agent 像人一樣玩，而是讓 agent 系統性探索 mechanics 會產生哪些 dynamics。

有價值的輸出不是「agent 過關了」，而是：

- 哪個 seed 出問題
- 哪串 action 會重現問題
- 哪個 event log 顯示風險
- 這個問題屬於哪種 QA category
- 工程師如何重現

## 4. 本週必答問題

如果我讓 1,000 個 agents 玩這個遊戲，哪些 dynamics 會跑出來？

答案草稿：

```text
待填。
```

## 5. 和 Project 1 的連結

AI Dungeon Tester v0 需要先保證：

- mechanics 明確
- actions 可序列化
- state 可記錄
- event 可查詢
- seed + action_sequence 可重播

否則後面就算做出 agents，也只能得到 demo，不能得到 QA evidence。

