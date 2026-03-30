-- Legacy bundle: replica + edit/delete policies. Prefer team_chat_messages_edit_delete_window.sql for policy-only updates.

ALTER TABLE public.team_chat_messages REPLICA IDENTITY FULL;

-- See team_chat_messages.sql or team_chat_messages_edit_delete_window.sql for current policy definitions.
