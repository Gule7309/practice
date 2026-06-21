from __future__ import annotations

import json
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


class LocalLlama3Client:
    def __init__(
        self,
        *,
        base_url: str = "http://127.0.0.1:11434/v1",
        model: str = "llama3",
        timeout_seconds: int = 20,
        max_attempts: int = 3,
        backoff_multiplier: float = 2.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_attempts = max_attempts
        self.backoff_multiplier = backoff_multiplier

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "stream": False,
        }
        request = Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        last_error: Exception | None = None
        for attempt in range(self.max_attempts):
            timeout = self.timeout_seconds * (self.backoff_multiplier**attempt)
            try:
                with urlopen(request, timeout=timeout) as response:
                    data = json.loads(response.read().decode("utf-8"))
                break
            except (OSError, URLError, TimeoutError) as error:
                last_error = error
                if attempt == self.max_attempts - 1:
                    raise LLMUnavailable(str(error)) from error
                time.sleep(min(2**attempt, 5))
        else:
            raise LLMUnavailable(str(last_error))

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LLMUnavailable(f"Unexpected LLM response: {data}") from error


class LLMUnavailable(Exception):
    pass
