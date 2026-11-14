# How changes reach main

**Branches**: `feat/<short-name>`, `fix/<short-name>`, `ops/<short-name>`. Branch from `main`, keep it under a day of work.

**Pull requests**
- Small: one change, ideally under 300 lines.
- The template checklist is filled in honestly.
- CI must be green (`API tests and lint`, `Web build`, `Secrets, Dockerfiles and shell scripts`, `Build and scan images`).
- One approval from a CODEOWNER. Working alone: wait at least an hour, re-read the diff on GitHub (not in your editor), and tick the checklist before merging.
- Squash-merge, with a [Conventional Commit](https://www.conventionalcommits.org) title: `feat: search employees by title`.

**main is protected** (Settings > Branches > Add rule for `main`):
- Require a pull request before merging, 1 approval
- Require status checks to pass (the four above), require branches to be up to date
- Do not allow bypassing, block force pushes and deletions

If your GitHub plan doesn't allow protection on a private repository, the rules above still apply and you enforce them yourself. Show it in your report by pointing at the pull request history: every commit on `main` came from a pull request.

**Releases**: tag `vMAJOR.MINOR.PATCH` on `main` (`git tag v1.0.0 && git push --tags`). Phases are tagged `phase-1` to `phase-4`. Production only ever runs a tagged version or a `sha-` tag, never `latest`.
