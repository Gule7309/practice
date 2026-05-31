import {
  Annotation,
  END,
  MemorySaver,
  messagesStateReducer,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import { createUIMessageStreamResponse } from "ai";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { z } from "zod";

const model = new ChatOllama({
  model: "llama3",
  baseUrl: "http://localhost:11434",
  temperature: 0.7,
});
const intentClassifier = model.withStructuredOutput(
  z.object({ intent: z.enum(["answering", "confused", "generic"]) })
);
const assessmentEvaluator = model.withStructuredOutput(
  z.object({
    feedback: z.string(),
    isCorrect: z.boolean(),
    masteredTerm: z.string().optional(),
  })
);

export type LearningLevel = "beginner" | "intermediate" | "advanced";
type UserIntent = "answering" | "confused" | "generic";

export const TutorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  termsMastered: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  currentLevel: Annotation<LearningLevel>({
    reducer: (x, y) => y ?? x,
    default: () => "beginner",
  }),
  projectProgress: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  userIntent: Annotation<UserIntent>({
    reducer: (x, y) => y ?? x,
    default: () => "generic",
  }),
});

function nextLearningLevel(
  current: LearningLevel,
  isCorrect: boolean
): LearningLevel {
  if (!isCorrect) return current;
  if (current === "beginner") return "intermediate";
  if (current === "intermediate") return "advanced";
  return "advanced";
}

function getLatestUserText(state: typeof TutorState.State): string {
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const msg = state.messages[i] as {
      content?: unknown;
      _getType?: () => string;
    };
    if (msg?._getType?.() === "human" && typeof msg.content === "string") {
      return msg.content;
    }
  }
  return "";
}

export async function classifyIntentNode(state: typeof TutorState.State) {
  const latestInput = getLatestUserText(state);
  const prompt = {
    role: "system" as const,
    content: `你是意圖分類器。只回傳 JSON：
{"intent":"answering"|"confused"|"generic"}
判斷規則：
- 使用者在回答題目、提交解釋 -> answering
- 使用者說看不懂、卡住、要求再解釋 -> confused
- 其他 -> generic`,
  };

  const parsed = await intentClassifier.invoke([
    prompt,
    { role: "user", content: latestInput || "你好" },
  ]);
  const intent: UserIntent =
    parsed?.intent === "answering" ||
    parsed?.intent === "confused" ||
    parsed?.intent === "generic"
      ? parsed.intent
      : "generic";

  return { userIntent: intent };
}

export async function explainNode(state: typeof TutorState.State) {
  const systemPrompt = {
    role: "system" as const,
    content: `你是一位 Agent 導師。學生等級：${state.currentLevel}。
請用清楚、可實作的方式解釋打造 agent 需要的觀念，並附一個可立即嘗試的小任務。`,
  };
  const response = await model.invoke([systemPrompt, ...state.messages]);
  return {
    messages: [response],
    termsMastered: ["Planning"],
  };
}

export async function assessmentNode(state: typeof TutorState.State) {
  const systemPrompt = {
    role: "system" as const,
    content: `你是 AI 導師。請評估學生的最後一則回答，僅回傳 JSON：
{
  "feedback": "string",
  "isCorrect": true,
  "masteredTerm": "string 可省略"
}`,
  };

  const data = await assessmentEvaluator.invoke([systemPrompt, ...state.messages]);
  if (!data?.feedback) {
    return {
      messages: [
        {
          role: "assistant",
          content: "我這次評估格式失敗，請你再貼一次答案，我會重新評估。",
        },
      ],
    };
  }

  return {
    messages: [{ role: "assistant", content: data.feedback }],
    currentLevel: nextLearningLevel(state.currentLevel, !!data.isCorrect),
    termsMastered:
      data.isCorrect && data.masteredTerm ? [data.masteredTerm] : [],
  };
}

export async function genericNode() {
  return {
    messages: [
      {
        role: "assistant",
        content:
          "你好，我是你的 Agent 導師。你可以直接丟一段你寫的 flow，我幫你拆解成可優化點。",
      },
    ],
  };
}

function routeNext(state: typeof TutorState.State) {
  if (state.userIntent === "answering") return "assessment";
  if (state.userIntent === "confused") return "explain";
  return "generic";
}

const checkpointer = new MemorySaver();

const workflow = new StateGraph(TutorState)
  .addNode("classifyIntent", classifyIntentNode)
  .addNode("explain", explainNode)
  .addNode("assessment", assessmentNode)
  .addNode("generic", genericNode)
  .addEdge(START, "classifyIntent")
  .addConditionalEdges("classifyIntent", routeNext, {
    explain: "explain",
    assessment: "assessment",
    generic: "generic",
  })
  .addEdge("explain", END)
  .addEdge("assessment", END)
  .addEdge("generic", END);

export const tutorGraph = workflow.compile({
  checkpointer,
  interruptBefore: ["assessment"],
});

export async function POST(req: Request) {
  const { messages, threadId = "default-student" } = await req.json();
  const langchainMessages = await toBaseMessages(messages);

  const eventStream = await tutorGraph.stream(
    { messages: langchainMessages },
    {
      streamMode: "values",
      configurable: { thread_id: threadId },
    }
  );

  return createUIMessageStreamResponse({
    stream: toUIMessageStream(eventStream),
  });
}
