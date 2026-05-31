# Week 1 Plan: Phase 0 Kickoff

## 本週目標

建立 AI Playtesting 的第一個 mental model：agent 不是只負責「玩遊戲」，而是負責系統性探索遊戲狀態，找出可重現的 QA 風險。

## Read

1. MDA: A Formal Approach to Game Design and Game Research
   - 重點：Mechanics, Dynamics, Aesthetics
   - 產出：`mda_notes.md`

2. ISTQB Game Testing overview
   - 重點：學會用 QA 語言描述問題
   - 產出：`game_testing_taxonomy.md`

3. A Theory of Fun 前半
   - 重點：fun, pattern, learning, boredom
   - 產出：先寫 5 行摘要即可，不要求完整筆記

## Build

本週不急著寫完整遊戲。先寫 Project 1 的最小設計 brief：

- grid dungeon 有哪些 rules
- player 有哪些 actions
- game state 需要記哪些欄位
- 哪些 event 必須 log
- 哪些 bug 可以被 rule-based detector 找出

輸出到：`ai_dungeon_tester_v0_brief.md`

## Measure

用下面 5 題檢查本週是否有效：

1. 我能不能分辨 mechanics 和 dynamics？
2. 我能不能說出 agent playtesting 比一般 bot demo 多了什麼？
3. 我能不能列出至少 8 種遊戲 QA 風險？
4. 我能不能設計一個 seed + action_sequence 可重播的最小遊戲？
5. 我能不能說明第一版為什麼不該先用 RL？

## Reflect

本週結束時回答：

```text
如果我讓 1,000 個 agents 玩我的 grid dungeon，哪些 dynamics 可能會跑出來？
```

## Write

寫一篇短 build log：

```text
Week 1:
我開始建立 AI Playtesting 的 mental model。
這週讀 MDA，整理了 Mechanics -> Dynamics -> Aesthetics 的視角，
並開始把 Project 1 拆成 seed、action、event log、replay 這些可重現系統。
```

## 下週銜接

下週開始做最小可執行 grid dungeon：

- fixed-size grid map
- seed-based generation
- player movement
- wall / trap / treasure / exit
- action log
- event log

