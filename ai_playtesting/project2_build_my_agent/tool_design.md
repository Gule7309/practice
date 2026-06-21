## example
- tool_name
- input fields from state
- output fields to state
- fallback behavior

### open_game_tool
- input: game_url
- output: browser_session_id, page_status
- fallback behavior: if game_url is invalid, return error_message.

### take_screenshot_tool
- input: browser_session_id
- output: screenshot_path
- fallback behavior: if browser_session_id is invalid, return error_message.