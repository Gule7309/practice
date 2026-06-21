## example
- node_name
- input fields from state
- output fields to state
- uses model?
- uses tools?
- failure modes


### open_game_node
 - input: run_id, game_url
 - output: browser_session_id, page_status
 - uses model? no
 - uses tools? open_game_tool
 - failure modes: return error_message and ask user to try another url.

### classify_game_node
 - input: game_url, browser_session_id, page_status
 - output: game_type, genre, exist_game_type, classification_reason, game_type_confidence
 - uses model? yes
 - uses tools? take_screenshot_tool
 - failure modes: failed_to_take_screenshot: {error_message}.

 #### router_game_ready_node
  - input: game_type, genre, exist_game_type, classification_reason, game_type_confidence
  - router: if game_type, genre, exist_game_type, game_type_confidence != unknown and  classification_reason not contains unknown, go to make_test_plan_node, else go to classify_game_node.
  - uses model? no
  - uses tools? no

 ### make_test_plan_node
 - input: game_type, test_plan
 - output: test_plan

 ### validate_test_plan_node
 - input: game_type, test_plan
 - output: test_plan

 ### observe_before_node
 - input: game_type, test_plan
 - output: test_plan

 ### select_test_goal_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### select_action_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### validate_action_node
 - input: game_type, test_plan, error_message
 - output: test_plan

### execute_action_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### observe_after_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### verify_result_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### detect_bug_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### write_trace_node
 - input: game_type, test_plan, error_message
 - output: test_plan


 #### route_after_step_node

 ### recovery_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### create_report_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 ### validate_report_node
 - input: game_type, test_plan, error_message
 - output: test_plan

 #### route_continue_testing_node

 