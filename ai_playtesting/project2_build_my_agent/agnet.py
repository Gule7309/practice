from typing import Annotated, Sequence, TypedDict, List, Literal, Optional, Any
from dotenv import load_dotenv  
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import uuid
import json
import atexit
import datetime
import base64
import os
import time
from pydantic import BaseModel, Field
from playwright.sync_api import sync_playwright
from langgraph.checkpoint.sqlite import SqliteSaver

load_dotenv()

class BrowserManager:
    def __init__(self):
        self.playwright = None
        self.sessions = {}  # session_id -> {"browser": Browser, "context": BrowserContext, "page": Page}

    def init_session(self, game_url: str) -> tuple[str, str]:
        """
        Starts a playwright instance, opens the game_url, registers the session,
        and returns (session_id, page_status).
        """
        try:
            if not self.playwright:
                self.playwright = sync_playwright().start()

            # Launch browser with GPU bypass flags to ensure WebGL/Canvas games load correctly
            try:
                browser = self.playwright.chromium.launch(
                    headless=False,
                    channel="chrome",
                    args=["--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"]
                )
            except Exception:
                browser = self.playwright.chromium.launch(
                    headless=False,
                    args=["--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox"]
                )
            context = browser.new_context()
            page = context.new_page()

            # Navigate to game_url
            response = page.goto(game_url)
            page_status = "success"
            if response:
                if response.status >= 400:
                    page_status = f"error_{response.status}"
                else:
                    page_status = f"ok_{response.status}"
            else:
                page_status = "failed_no_response"

            session_id = str(uuid.uuid4())
            self.sessions[session_id] = {
                "browser": browser,
                "context": context,
                "page": page
            }
            return session_id, page_status
        except Exception as e:
            return "", f"failed_to_open: {e}"

    def get_page(self, session_id: str):
        session = self.sessions.get(session_id)
        if session:
            return session["page"]
        raise ValueError(f"Session ID {session_id} not found.")

    def close_session(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if session:
            try:
                session["context"].close()
                session["browser"].close()
            except Exception:
                pass

    def close_all(self):
        for session_id in list(self.sessions.keys()):
            self.close_session(session_id)
        if self.playwright:
            try:
                self.playwright.stop()
            except Exception:
                pass
            self.playwright = None

# Global instance of BrowserManager
browser_manager = BrowserManager()

# Auto-cleanup at exit
atexit.register(browser_manager.close_all)


# class Observation(TypedDict, total=False):
#     screenshot_path: str
#     dom_summary: str
#     canvas_focused: bool
#     console_errors: list[str]
#     page_url: str
#     page_title: str
#     visual_summary: str
#     image_hash: str


# class Action(TypedDict, total=False):
#     name: str
#     params: dict
#     reason: str
#     expected_result: str


# class ActionResult(TypedDict, total=False):
#     ok: bool
#     error: Optional[str]
#     executed_at: str


# class VerificationResult(TypedDict, total=False):
#     passed: bool
#     failure_type: Optional[str]
#     confidence: float
#     notes: str


# class BugCandidate(TypedDict, total=False):
#     is_bug: bool
#     title: str
#     severity: Literal["low", "medium", "high", "critical"]
#     bug_type: str
#     evidence: list[str]


from langchain_core.runnables import RunnableConfig

class PlaytestState(TypedDict, total=False):
    run_id: str
    game_url: str
    browser_session_id: str
    page_status: str
    screenshot_path: str
    game_type: str
    genre: str
    classification_reason: List[str]
    game_type_confidence: float
    exist_game_type: bool
    retry_count: int

    test_plan: List[str]
    plan_reasoning: str
    critical_checkpoints: List[str]
    current_goal: dict

@tool
def open_game_tool(game_url: str) -> str:
    """Open the game in the browser and return session info as a JSON string."""
    session_id, status = browser_manager.init_session(game_url)
    return json.dumps({
        "browser_session_id": session_id,
        "page_status": status
    })

@tool
def take_screenshot_tool(browser_session_id: str) -> str:
    """Take a screenshot of the current page associated with the browser_session_id.
    
    Returns the saved screenshot file path.
    """
    try:
        # 1. 從全域的 browser_manager 取得對應的 Page 物件
        page = browser_manager.get_page(browser_session_id)
        
        # Wait for page/network stability to avoid loading race conditions
        try:
            page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass

        # 2. 建立儲存截圖的資料夾 (例如專案目錄下的 screenshots)
        os.makedirs("screenshots", exist_ok=True)
        
        # 3. 產生不重複的檔名：用 session_id 搭配時間戳記
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"screenshots/{browser_session_id}_{timestamp}.png"
        
        # 4. 呼叫 Playwright 截圖 API，它會自動把畫面寫入硬碟
        page.screenshot(path=screenshot_path)
        
        # 5. 回傳檔案路徑，供後續節點（例如 LLM 視覺節點）讀取
        return screenshot_path
    except Exception as e:
        return f"failed_to_take_screenshot: {e}"

def open_game_node(state: PlaytestState) -> PlaytestState:
    """This node is used to open the game in the browser and return the session info."""
    try:
        # Invoke the open_game_tool to get the browser session
        result_str = open_game_tool.invoke({"game_url": state["game_url"]})
        result = json.loads(result_str)
        return {
            "browser_session_id": result.get("browser_session_id", ""),
            "page_status": result.get("page_status", "error")
        }
    except Exception as e:
        return {
            "browser_session_id": "",
            "page_status": f"error: {e}"
        }

class GameClassification(BaseModel):
    game_type: str = Field(description="The type of the game. Choose from: 'canvas' (uses HTML5 canvas/WebGL), 'html_ui' (standard HTML elements/buttons), 'text' (text adventure/terminal-like), or 'unknown'.")
    genre: str = Field(description="The genre of the game, e.g. RPG, platformer, puzzle, action, or 'unknown'.")
    reasons: List[str] = Field(description="A list of specific visual reasons or evidence seen on screen that support this classification (e.g. 'found health bar', 'found d-pad', 'found canvas element', 'found menu buttons').")

def check_game_exists(target_game_type: str, target_genre: str, current_thread_id: Optional[str] = None) -> bool:
    """Check if the combination of game_type and genre has occurred in any previous checkpoints in the database (excluding current thread)."""
    if target_game_type == "unknown" or target_genre == "unknown":
        return False
    try:
        # Query checkpoints from the global memory saver
        for checkpoint_tuple in memory.list(None):
            thread_id = checkpoint_tuple.config.get("configurable", {}).get("thread_id")
            if current_thread_id and thread_id == current_thread_id:
                continue
            vals = checkpoint_tuple.checkpoint.get("channel_values", {})
            if (vals.get("game_type") == target_game_type and 
                vals.get("genre") == target_genre):
                return True
    except Exception as e:
        print(f"Error checking previous checkpoints: {e}")
    return False

def classify_game_node(state: PlaytestState, config: RunnableConfig) -> PlaytestState:
    """This node is used to classify the game type using the multimodal LLM (Gemini 2.5 Flash)."""
    try:
        # 0. Wait 5 seconds for initial page stabilization
        try:
            page = browser_manager.get_page(state["browser_session_id"])
            page.wait_for_timeout(5000)
        except Exception:
            pass

        # 1. Take a screenshot using the tool (returns raw file path string)
        screenshot_path = take_screenshot_tool.invoke({"browser_session_id": state["browser_session_id"]})
        
        if screenshot_path.startswith("failed_to_take_screenshot"):
            return {
                "screenshot_path": screenshot_path,
                "game_type": "unknown",
                "genre": "unknown",
                "classification_reason": [],
                "game_type_confidence": 0.0,
                "exist_game_type": False
            }

        # 2. Read the image and base64-encode it
        with open(screenshot_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode("utf-8")

        # 3. Construct a multimodal message instructing loading rules
        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": (
                        "Analyze this screenshot of the game.\n"
                        "1. Check if the game has finished loading and is in a playable/interactive state.\n"
                        "2. If the screenshot shows a loading screen (e.g. 'Loading...', progress bar), a completely black/blank/empty screen, a generic loading spinner, or is otherwise not fully loaded:\n"
                        "   - game_type MUST be 'unknown'\n"
                        "   - genre MUST be 'unknown'\n"
                        "   - reasons MUST list the loading indicators (e.g., 'found loading screen', 'black/empty area').\n"
                        "3. If the game is fully loaded and playable:\n"
                        "   - game_type: classify as 'canvas' (uses HTML5 canvas/WebGL), 'html_ui' (standard HTML elements/buttons), or 'text' (text adventure/terminal-like).\n"
                        "   - genre: classify as RPG, platformer, puzzle, action, etc.\n"
                        "   - reasons: list specific visual elements of the game (e.g., 'health bar', 'joystick', 'start button', 'rendered game environment'). Do NOT list loading/empty screens as reasons for a valid classification."
                    )
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_data}"},
                },
            ]
        )

        # 4. Use structured output to get the Pydantic schema result
        structured_llm = model_1.with_structured_output(GameClassification)
        classification = structured_llm.invoke([message])

        # Force unknown if loading indicators are in reasons
        reasons = classification.reasons or []
        is_loading_detected = (
            classification.game_type == "unknown" or
            classification.genre == "unknown" or
            any("loading" in r.lower() for r in reasons) or
            any("black" in r.lower() for r in reasons) or
            any("empty" in r.lower() for r in reasons)
        )

        if is_loading_detected:
            g_type = "unknown"
            genre = "unknown"
            confidence = 0.0
            is_existing = False
        else:
            g_type = classification.game_type
            genre = classification.genre
            # Calculate confidence score programmatically based on the reasons list:
            # - Reasons empty -> confidence = 0.3
            # - Reasons count > 3 -> confidence = 0.9
            # - Reasons count between 1 and 3 -> confidence = 0.6
            if not reasons:
                confidence = 0.3
            elif len(reasons) > 3:
                confidence = 0.9
            else:
                confidence = 0.6

            # Determine if the classified game_type and genre combination already exists in persistence
            thread_id = config.get("configurable", {}).get("thread_id")
            is_existing = check_game_exists(g_type, genre, thread_id)

        return {
            "screenshot_path": screenshot_path,
            "game_type": g_type,
            "genre": genre,
            "classification_reason": reasons,
            "game_type_confidence": confidence,
            "exist_game_type": is_existing
        }
    except Exception as e:
        return {
            "screenshot_path": f"error: {e}",
            "game_type": "unknown",
            "genre": "unknown",
            "classification_reason": [],
            "game_type_confidence": 0.0,
            "exist_game_type": False
        }

class TestPlan(BaseModel):
    steps: List[str] = Field(description="Sequential list of actions to perform.")
    reasoning: str = Field(description="Logic behind this test plan based on game type.")
    checkpoints: List[str] = Field(description="Key states to verify during execution.")

def make_test_plan_node(state: PlaytestState) -> PlaytestState:
    """Generates a playtesting plan based on the game type and genre using Gemini."""
    try:
        # Read the screenshot if exists and base64-encode it for multimodal input
        image_data = None
        screenshot_path = state.get("screenshot_path")
        if screenshot_path and os.path.exists(screenshot_path):
            try:
                with open(screenshot_path, "rb") as image_file:
                    image_data = base64.b64encode(image_file.read()).decode("utf-8")
            except Exception as e:
                print(f"Warning: failed to read screenshot for test plan: {e}")

        # Construct a comprehensive prompt using all the required inputs
        prompt_text = (
            f"You are a professional QA playtesting assistant.\n"
            f"The game URL is: {state.get('game_url')}\n"
            f"The game classification details are:\n"
            f"  - Game Type: {state.get('game_type')}\n"
            f"  - Genre: {state.get('genre')}\n"
            f"  - Previously seen: {state.get('exist_game_type')}\n"
            f"  - Classification confidence: {state.get('game_type_confidence')}\n"
            f"  - Visual evidence: {', '.join(state.get('classification_reason', []))}\n\n"
            f"Based on the game type, genre, and the screenshot, generate a TestPlan detailing:\n"
            f"1. A sequential list of playtesting steps/actions to perform.\n"
            f"2. The QA reasoning/logic behind this plan.\n"
            f"3. Key checkpoints/states to verify during execution to ensure the game works properly."
        )

        content = [{"type": "text", "text": prompt_text}]
        if image_data:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{image_data}"}
            })

        message = HumanMessage(content=content)
        structured_llm = model_2.with_structured_output(TestPlan)
        plan = structured_llm.invoke([message])
        
        print("\n[Node Executed] make_test_plan_node")
        print(f"Generated Test Plan Reasoning: {plan.reasoning}")
        print("Generated Test Plan Steps:")
        for idx, step in enumerate(plan.steps, 1):
            print(f"  {idx}. {step}")
        print("Generated Checkpoints to Verify:")
        for idx, checkpoint in enumerate(plan.checkpoints, 1):
            print(f"  {idx}. {checkpoint}")
        
        return {
            "test_plan": plan.steps,
            "plan_reasoning": plan.reasoning,
            "critical_checkpoints": plan.checkpoints
        }
    except Exception as e:
        print(f"Error in make_test_plan_node: {e}")
        return {
            "test_plan": [],
            "plan_reasoning": f"failed_to_make_test_plan: {e}",
            "critical_checkpoints": []
        }

def route_game_ready(state: PlaytestState) -> str:
    """Routes the graph based on whether the game is fully loaded or still loading."""
    game_type = state.get("game_type", "unknown")
    genre = state.get("genre", "unknown")
    reasons = state.get("classification_reason", [])
    retry_count = state.get("retry_count", 0)

    # Consider it loading if type/genre is unknown, or if reasons specifically mention loading/empty
    is_loading = (
        game_type == "unknown" or 
        genre == "unknown" or 
        any("loading" in r.lower() for r in reasons) or
        any("black" in r.lower() for r in reasons) or
        any("empty" in r.lower() for r in reasons)
    )

    if is_loading:
        if retry_count < 3:
            print("Game is still loading or unknown. Routing to wait...")
            return "wait"
        else:
            print("Maximum retry limit reached (3). Proceeding to END...")
            return "end"
    else:
        print("Game is ready and classified successfully. Routing to make_test_plan...")
        return "make_test_plan"

tools = [open_game_tool]

model_1 = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0).bind_tools(tools)
model_2 = ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0.2).bind_tools(tools)

graph = StateGraph(PlaytestState)

graph.add_node("open_game", open_game_node)
graph.add_node("classify_game", classify_game_node)
graph.add_node("make_test_plan", make_test_plan_node)

graph.set_entry_point("open_game")
graph.add_edge("open_game", "classify_game")

# Route conditionally based on game readiness check
graph.add_conditional_edges(
    "classify_game",
    route_game_ready,
    {
        "wait": "wait",
        "make_test_plan": "make_test_plan",
        "end": END
    }
)

# Loop back to classify_game after waiting
graph.add_edge("wait", "classify_game")

# Once test plan is created, end the flow
graph.add_edge("make_test_plan", END)

# SQLite Checkpointer for persistent state saving
memory_context = SqliteSaver.from_conn_string("state_db.sqlite")
memory = memory_context.__enter__()

# Register SQLite cleanup at exit
atexit.register(lambda: memory_context.__exit__(None, None, None))

app = graph.compile(checkpointer=memory)

if __name__ == "__main__":
    print("=== LangGraph Playtesting Agent Test CLI ===")
    mode = input("Select mode:\n  (1) Start a new playtest run (default)\n  (2) Resume an existing run\nChoose [1/2]: ").strip()

    if mode == "2":
        # Resume mode
        run_id = input("Enter the Run ID (thread_id) to resume: ").strip()
        if not run_id:
            print("Error: Run ID cannot be empty.")
            exit(1)
        initial_state = None  # Load state history from checkpointer
        config = {"configurable": {"thread_id": run_id}}
        print(f"\n=== Resuming LangGraph Execution for Run ID: {run_id} ===")
    else:
        # New run mode
        input_url = input("Please enter the game URL to test (default: https://example.com): ").strip()
        test_url = input_url if input_url else "https://example.com"

        # Generate run_id dynamically: task_{timestamp}_{short_hash}
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        short_hash = uuid.uuid4().hex[:6]
        run_id = f"task_{timestamp}_{short_hash}"

        initial_state = {
            "run_id": run_id,
            "game_url": test_url
        }
        config = {"configurable": {"thread_id": run_id}}
        print(f"\n=== Starting New LangGraph Test Execution ===")
        print(f"Generated Run ID: {run_id}")
        print(f"Initial State: {initial_state}\n")

    # Use stream() with config to persist and trace the execution step-by-step
    for event in app.stream(initial_state, config=config):
        for node_name, state_update in event.items():
            print(f"[Node Executed] {node_name}")
            print("State Updates:")
            print(json.dumps(state_update, indent=4, ensure_ascii=False))
            print("-" * 40)

    print("\n=== Graph Execution Completed ===")
