# Prompt to give Codex from the repository root

Read `agent-docs/react-workbench/README.md`, `CODEX_TASK.md` and `WORD_SEGMENTATION.md`, then follow their linked specs. The goal is an integrated React Lyric Workbench with import, translation editing, per-occurrence timing, video presets, AI integration via the existing Python code, and a backward-compatible Remotion rendering workflow.

**First audit the local checkout**, especially uncommitted Streamlit/Python code, all Remotion composition families (music-video footage, image + visualizer, thumbnails), song-file contracts and media assets. Preserve everything already working. Write `LOCAL_AUDIT.md` and merge `ROADMAP.proposed.md` with the local roadmap rather than overwriting it.

Then implement milestones in the order and with the acceptance gates specified in `CODEX_TASK.md`. Start with the real React import/edit/export functionality; implement timing next. Keep the old Remotion compositions operational until you have reference-frame coverage and safe compatibility wrappers. Reuse Python AI logic rather than rewriting it in TypeScript. Avoid speculative dependencies and no destructive Git operations.

The HTML file is a **visual reference** and contains mock timing and video previews; build real functionality against the actual repository. Report changed files, tests that actually passed, and remaining work after each milestone.

**Additional v2.1 acceptance requirement:** Implement editable word segmentation (split one token, merge adjacent tokens) in the React MVP. Preserve phrase/occurrence structure and manually approved segmentations. Ensure every lexical `words[].pinyin` is a contiguous word spelling (`piàoliang`, not `piào liang`), with appropriate spaces **between words** in full-line Pinyin. Update Python generation prompts/postprocessing and tests before treating backend integration as complete.
