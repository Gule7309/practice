from typing import Annotated, Sequence, TypedDict, List, Literal, Optional, Any
from dotenv import load_dotenv  
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import uuid
import json
import atexit
import datetime
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

            # Launch headful Chromium browser by default
            browser = self.playwright.chromium.launch(headless=False)
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


class PlaytestState(TypedDict, total=False):
    run_id: str
    game_url: str
    browser_session_id: str
    page_status: str

    # game_type: str
    # game_type_confidence: float
    # exist_game_type: bool

    # test_plan: list[dict]
    # current_goal: dict

    # step: int
    # max_steps: int

    # observation_before: Observation
    # observation_after: Observation

    # current_action: Action
    # action_valid: bool
    # action_result: ActionResult

    # verification_result: VerificationResult
    # bug_candidate: BugCandidate

    # recovery_attempt: int
    # fatal_error: bool

    # next_route: Literal[
    #     "continue",
    #     "revise_action",
    #     "recover",
    #     "report_now",
    #     "end"
    # ]

    # stop_reason: Optional[str]
    # report_mode: Optional[Literal["normal_end", "early_bug_report"]]

    # trace: list[dict]
    # final_report: str
    # report_valid: bool
    # exist_game_type: bool

@tool
def open_game_tool(game_url: str) -> str:
    """Open the game in the browser and return session info as a JSON string."""
    session_id, status = browser_manager.init_session(game_url)
    return json.dumps({
        "browser_session_id": session_id,
        "page_status": status
    })


def open_game_node(state: PlaytestState) -> PlaytestState:
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

tools = [open_game_tool]

model_1 = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0).bind_tools(tools)
model_2 = ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0.2).bind_tools(tools)

graph = StateGraph(PlaytestState)

graph.add_node("open_game", open_game_node)

graph.set_entry_point("open_game")
graph.add_edge("open_game", END)

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
