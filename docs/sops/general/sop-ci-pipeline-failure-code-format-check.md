# SOP: CI Pipeline Failure — Code Format Check

---

## Summary

The CI pipeline for the `main` branch failed at the **Quality Gate** job during the **Format check** step on commit `691a842c7fd85be423f6a32ef54485a62f783131` authored by Tukrim Sohorabil. The format check enforces consistent code style across the repository, and one or more files committed did not meet the required formatting standards. This failure blocks the pipeline from proceeding, preventing any downstream steps such as testing or deployment from running.

---

## Root Cause

The format check step runs a code formatter (e.g., `prettier`, `black`, `gofmt`, `eslint --fix`, or equivalent) in **validation mode**, meaning it checks whether files are formatted correctly without modifying them. The job fails when it detects a diff between the committed code and the expected formatted output. This typically occurs because:

- The author did not run the formatter locally before committing.
- A pre-commit hook was not installed or was bypassed (e.g., via `git commit --no-verify`).
- The local formatter version differs from the version enforced in CI.

> ⚠️ **Note:** The exact error log was unavailable at the time of writing. The specific files and formatting violations must be confirmed by reviewing the GitHub Actions logs directly at:
> [`https://github.com/sohorabil/ai-devops-platform/actions`](https://github.com/sohorabil/ai-devops-platform/actions)

---

## Impact

If this failure is not resolved:

- **The CI pipeline is blocked** — no tests, security scans, or deployments will run.
- **Merges to `main` are gated** — if branch protection rules are enforced, PRs cannot be merged.
- **Code quality degrades** — if bypassed without fixing, inconsistent formatting accumulates as technical debt.
- **Team velocity is reduced** — other contributors depending on a green `main` branch may be blocked.

---

## Step-by-Step Fix

> Run all commands from the root of the repository unless otherwise noted.

### 1. Identify the Failing Files

Check the GitHub Actions logs to find which files failed the format check:

```
https://github.com/sohorabil/ai-devops-platform/actions
```

Look for output similar to:

```
[error] src/example.py is not formatted correctly.
Reformatting...
Check failed — 3 file(s) need reformatting.
```

---

### 2. Pull the Latest State of `main`

```bash
git checkout main
git pull origin main
```

---

### 3. Identify the Formatter in Use

Check the CI workflow file to confirm which formatter is being used:

```bash
cat .github/workflows/ci.yml
```

Look for the **Format check** step. Common formatters include:

| Language       | Formatter        | Check Command                        |
|----------------|------------------|--------------------------------------|
| Python         | `black`          | `black --check .`                    |
| JavaScript/TS  | `prettier`       | `prettier --check .`                 |
| Go             | `gofmt`          | `gofmt -l .`                         |
| Rust           | `rustfmt`        | `cargo fmt -- --check`               |
| General        | `eslint`         | `eslint . --max-warnings=0`          |

---

### 4. Install the Correct Formatter Version

Install the **same version** used in CI (check `package.json`, `pyproject.toml`, `requirements-dev.txt`, or the workflow file):

```bash
# Example: Python / black
pip install black==<version-from-ci>

# Example: JavaScript / prettier
npm install --save-dev prettier@<version-from-ci>
```

---

### 5. Run the Formatter Locally

Auto-format all affected files:

```bash
# Python
black .

# JavaScript / TypeScript
npx prettier --write .

# Go
gofmt -w .

# Rust
cargo fmt
```

---

### 6. Verify the Fix Locally

Re-run the formatter in **check mode** to confirm it now passes (mirroring what CI does):

```bash
# Python
black --check .

# JavaScript / TypeScript
npx prettier --check .

# Go
gofmt -l .   # Should return no output

# Rust
cargo fmt -- --check
```

Expected output: no errors, exit code `0`.

---

### 7. Stage, Commit, and Push the Fix

```bash
git add -A
git commit -m "fix: apply code formatter to resolve CI format check failure

Reformatted files to comply with project style standards.
Fixes format check failure on commit 691a842c7fd85be423f6a32ef54485a62f783131."

git push origin main
```

---

### 8. Verify the Pipeline Passes

Navigate to GitHub Actions and confirm the **Quality Gate / Format check** step is green:

```
https://github.com/sohorabil/ai-devops-platform/actions
```

---

## Prevention

Implement the following measures to prevent format check failures from reaching CI:

### 1. Install Pre-commit Hooks

Use [`pre-commit`](https://pre-commit.com/) to enforce formatting before every commit:

```bash
pip install pre-commit
pre-commit install
```

Add a `.pre-commit-config.yaml` to the repository root:

```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.x.x  # pin to CI version
    hooks:
      - id: black
```

---

### 2. Pin Formatter Versions

Ensure the formatter version in CI matches the version used locally. Document this in `README.md` or a `CONTRIBUTING.md` file:

```
# Required tooling versions
black==23.x.x
prettier==3.x.x
```

---

### 3. Add a Format Check to Pull Request Template

Remind contributors to verify formatting in `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Checklist
- [ ] I have run the code formatter locally (`black .` / `npx prettier --write .`)
- [ ] The CI format check passes
```

---

### 4. Enable Editor Auto-formatting

Provide a `.editorconfig` or workspace settings file (e.g., `.vscode/settings.json`) so editors format on save automatically:

```json
{
  "editor.formatOnSave": true,
  "python.formatting.provider": "black"
}
```

---

### 5. Document the Workflow in CONTRIBUTING.md

Ensure `CONTRIBUTING.md` includes setup instructions for the formatter, including version requirements and how to install pre-commit hooks.

---

## Related SOPs

| Document | Path |
|---|---|
| CI/CD Pipeline Overview | `/docs/sops/cicd-pipeline-overview.md` |
| Pre-commit Hook Setup Guide | `/docs/sops/pre-commit-hook-setup.md` |
| Branch Protection Rules | `/docs/sops/branch-protection-rules.md` |
| Linting Failure SOP | `/docs/sops/ci-failure-lint-check.md` |
| Developer Environment Setup | `/docs/sops/developer-environment-setup.md` |
| Hotfix Procedure for `main` | `/docs/sops/hotfix-procedure-main-branch.md` |

---

*Document Owner: DevOps Team*
*Last Updated: 2025*
*Applies To: Repository — `sohorabil/ai-devops-platform`*