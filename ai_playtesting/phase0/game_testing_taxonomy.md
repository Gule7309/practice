# Game Testing Taxonomy

Source: https://istqb.org/certifications/certified-tester-game-testing-ct-game/

這份表是為 AI Dungeon Tester v0 準備的 QA 語言表。每個 bug detector 最後都應該能對應到一個 category。

| Category | 中文理解 | Dungeon v0 範例 | 可觀測訊號 |
|---|---|---|---|
| Crash | 程式直接崩潰 | 執行某個 action 後 exception | run failed, stack trace |
| Softlock | 遊戲沒崩，但玩家無法繼續 | 玩家被牆和陷阱困住 | position unchanged for N turns |
| Progression blocker | 主線或通關路徑被阻斷 | key 不可達，exit 不可達 | no path from spawn to exit/key |
| Regression bug | 之前正常，改版後壞掉 | 新增 door 後舊 seed 無法通關 | baseline seed failed |
| Balance issue | 難度或收益不合理 | trap 太密導致 death rate 過高 | death rate, completion rate |
| Economy exploit | 資源可被不合理複製 | 同一個 chest 可重複給 gold | repeated reward from same source |
| UX issue | 操作或回饋不清楚 | OpenDoor 失敗但沒有 event reason | missing feedback event |
| Localization issue | 語系文字問題 | 不適用於第一版 CLI dungeon | text coverage check |
| Performance issue | 執行過慢或資源過高 | 10,000 runs 太慢 | runtime per run |

## 第一版優先 detector

先做這 5 個：

1. `UnwinnableMapDetector`
   - no path from spawn to exit

2. `StuckDetector`
   - player_position_unchanged_for_n_turns

3. `InvalidStateDetector`
   - hp < 0, gold < 0, player outside map

4. `DuplicateRewardDetector`
   - same chest opened twice and gold increased

5. `CompletionDetector`
   - reached exit with valid state

## 不急著做的 detector

- UX issue
- Localization issue
- Performance issue
- complex balance detector

原因：第一版目標是可重現 QA evidence，不是完整 QA 平台。

