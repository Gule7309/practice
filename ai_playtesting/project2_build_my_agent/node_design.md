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
 - input: game_url, action_result
 - output: game_type

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

 