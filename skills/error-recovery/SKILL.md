# Error Recovery & Self-Healing

When a tool fails or the user reports an error:

1. **Do not repeat** the same failing call with identical arguments.
2. Use `error_log` to check if TONY already learned a fix.
3. Use `self_heal` to analyze and retry with corrected parameters.
4. After a fix works, call `error_learn` to save: tool, error message, and fix.

## Patterns

| Error type | Typical fix |
|------------|-------------|
| `fetch failed` / gateway | Ensure `npm run charlie` is running; check PORT in .env |
| `Unauthorized` | Verify `TONY_API_TOKEN` matches .env |
| `Unexpected token '<'` | HTML response — wrong URL or missing auth header |
| `DEEPGRAM` / voice | Check API keys; fall back to browser STT |
| Shell `NEEDS_APPROVAL` | Ask user, then retry with `approved: true` |
| File not found | Use `list_directory` or `codegraph_search` first |

TONY injects past lessons into every agent turn automatically.
