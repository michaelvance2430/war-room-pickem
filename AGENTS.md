# War Room — agent engineering rules

## Source control (mandatory)

**No task is considered complete until it exists on `origin/main`.**

“Done” means all of the following:

1. Code implemented
2. Project builds successfully (e.g. `tsc --noEmit` / existing sanity checks)
3. Relevant tests or smoke checks run when they exist
4. Changes committed with a meaningful message
5. **Commit pushed to `main`**
6. Push verified (`main` matches `origin/main`)
7. Report block returned to the user

### After every completed implementation

```text
Branch:
main

Commit:
<hash>

Remote:
origin/main

Push Status:
SUCCESS
```

### Do not

- Leave completed work only in a local repository
- Stop after creating a local commit
- Claim the work is finished if the push did not succeed

### If push fails

1. Stop
2. Explain exactly why
3. Include the full Git error message
4. Do not claim finished until the push issue is resolved or the user explicitly says not to push

### Exceptions

If the repo is intentionally detached, push is impossible, or the user forbids push, state that clearly **before** ending the task.

## Why

Local-only commits are not backed up, can be lost, hide what is deployed, and make rollback/compare harder. Remote `main` is the single source of truth for War Room launch work.
