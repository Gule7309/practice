# Multi-Agent Learning Textbook (for kook1)

## 0) 這份文件的用途

這是我的學習作業系統。  
任何人類教練或 AI 助手，只要先讀這份文件，就應該知道：

- 我想成為什麼角色
- 我不想怎麼學
- 該怎麼設計教學與實作任務
- 如何評估我有沒有真的變強

---

## 1) 我的最終學習目標

我要成為 **AI-native multi-agent 系統設計師**，而不是純工程碼農。  
我希望能做到：

1. 不必手寫大量程式，也能設計出高品質 multi-agent 架構
2. 能把需求拆成 state / nodes / routing / guardrails / eval
3. 能指揮 AI 實作，並用專業 review 把品質控住
4. 能持續優化成本、延遲、成功率，並做架構創新

一句話：**我主導設計與驗收，AI 負責高比例實作。**

---

## 2) 我的定位（非常重要）

我的定位是：

- **Architect / Orchestrator / Reviewer**
- 不是「每行都自己寫」的 IC developer

我需要的能力優先序：

1. 架構切分能力
2. 規格定義能力（contract/schema）
3. 風險審查能力（failure path / control flow）
4. 指標化優化能力（latency/token/success rate）
5. 最後才是手寫能力

---

## 3) 教學原則（人/AI 都必須遵守）

### 3.1 溝通風格

- 使用繁體中文
- 先給可執行答案，再補原因
- 不要空泛高層廢話
- 內容要可落地、可驗收、可迭代

### 3.2 教學方式

- 預設 **我不想先手寫大量 code**
- 先教我「怎麼設計、怎麼驗收、怎麼下指令給 AI」
- 除非我主動要求，否則不做大段黑箱改碼
- 每次交付都要附：
  - 為什麼這樣設計
  - 風險在哪
  - 下一步怎麼進化

### 3.3 互動規則

- 請以「架構師訓練」模式回應我
- 給我模板、檢查表、rubric、決策樹
- 優先提供能直接複用的 artifact（規格檔、評分表、SOP）

---

## 4) 我目前採用的學習策略

### 4.1 20/80 策略

- 20%：我自己寫關鍵骨架（state、router、contract、驗收規則）
- 80%：AI 寫實作與重構
- 我專注：設計品質、流程正確性、風險控制

### 4.2 以 review 取代大量手寫

我會把學習主軸放在：

- 看 AI 產出是否符合 contract
- 看流程是否有誤路由/死路/迴圈爆炸
- 看失敗路徑是否完整
- 看觀測性與成本治理是否具備

---

## 5) Multi-Agent 學習地圖（由淺到深）

## Stage 1: Single Graph, Multi-Role Nodes

目標：先有 Router + Worker 分工概念  
必備能力：

- Intent classifier + routeNext
- explain/assessment/generic 職責分離
- thread-level state 記憶
- 基本 fallback

通關條件：

- 路由不硬編碼
- 狀態欄位定義清楚
- 節點責任單一

## Stage 2: Contract-Driven Agents

目標：每個 node 都有明確 I/O schema  
必備能力：

- zod / structured output
- 輸入輸出驗證
- 解析失敗處理策略

通關條件：

- 無裸 `JSON.parse` 關鍵路徑
- schema mismatch 有降級策略

## Stage 3: Planner -> Executor -> Critic Loop

目標：引入可反思迭代流程  
必備能力：

- planner 產計畫
- executor 執行
- critic 判斷是否重試
- max-iteration guard

通關條件：

- 無限循環被限制
- critic 有可解釋判準

## Stage 4: Production Hardening

目標：可運維、可優化、可審計  
必備能力：

- observability（latency/token/error）
- budget policy（模型與 token 成本）
- checkpoint persistence
- HITL 節點設計

通關條件：

- 有 dashboard 指標基線
- 有故障回放能力

---

## 6) 我應該具備的 Code Review 能力（必要，不可省）

我不需要變成每行手寫高手，但一定要能做以下 review：

1. Contract Review  
   - state/node I/O 是否符合規格
2. Control-Flow Review  
   - 有無死路、誤路由、無限迴圈
3. Failure-Path Review  
   - JSON 壞掉、timeout、低信心是否有 fallback
4. Cost/Latency Review  
   - 重模型是否放在必要節點
5. Observability Review  
   - 每個 node 是否可量測與追查

---

## 7) 標準 Review Checklist（每次都要跑）

1. 有沒有新增未批准的 state 欄位？
2. 每個 node 的輸入/輸出 schema 是否明確？
3. router 是否只做決策，不混執行邏輯？
4. 低信心或失敗是否有降級路徑？
5. retry / recursion 是否有上限？
6. human-in-the-loop 插點是否合理？
7. 有無 latency/token/error 指標輸出？
8. thread_id 能否支援回放與追蹤？

若任一題答「否」，該 PR 不算完成。

---

## 8) 人/AI 教學 SOP（照這個教我）

每次教學請遵守以下流程：

1. 先問本次目標 stage（1~4）
2. 先輸出「架構設計稿」（不先寫大段 code）
3. 等我確認設計稿後，再產生程式碼
4. 程式碼交付時附上：
   - 變更清單
   - 設計理由
   - 風險與限制
   - 驗收步驟
5. 最後給下一輪優化提案（至少 2 個）

---

## 9) 我對 AI 助手的指令模板

可直接貼給 AI：

```md
你現在是我的 multi-agent 系統設計搭檔。
目標：<填入本次目標>

請先輸出：
1) state schema
2) node responsibilities
3) routing policy
4) failure/fallback policy
5) evaluation metrics

限制：
- 未經批准不可新增 state 欄位
- 必須提供可驗收 checklist
- 先設計再寫碼
```

---

## 10) 每週訓練節奏（建議）

- Day 1: 架構設計與規格定義
- Day 2: AI 實作 + 第一次 review
- Day 3: 補 failure path + observability
- Day 4: 成本/延遲優化
- Day 5: retrospective（學到什麼、下週要改什麼）

每週至少產出 1 份：

- 架構決策紀錄（ADR）
- 評分 rubric 結果
- 下一週優化計畫

---

## 11) 成熟度評分標準（0~5）

- 0: 只能聊天，無法落地
- 1: 能做單節點 demo
- 2: 能做基本路由與狀態
- 3: 能做 contract 驅動與失敗處理
- 4: 能做多代理迭代與可觀測優化
- 5: 能主導 production multi-agent 演進與創新

我的近期目標：**從 2 -> 4**。

---

## 12) 本文件維護規則

- 每完成一輪實作/回顧就更新一次
- 若學習策略改變，優先更新本文件再更新程式
- 新教練/新 AI 一律先讀本文件再開始教學

