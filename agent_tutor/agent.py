from crewai import Agent, Task, Crew
from crewai_tools import SerperDevTool
from langchain_google_genai import ChatGoogleGenerativeAI
from crewai.tools import BaseTool

import os

os.environ["GOOGLE_API_KEY"] = "AIzaSyDrgYit4Wm6KAolvRh-c1xsorS1DTmpyuQ"

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    verbose=True,
    temperature=0.5,
    google_api_key=os.environ["GOOGLE_API_KEY"]
)