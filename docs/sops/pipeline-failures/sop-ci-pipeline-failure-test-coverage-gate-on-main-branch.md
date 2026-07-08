# SOP: CI Pipeline Failure — Test Coverage Gate on Main Branch

---

## Summary

The CI pipeline for the `ai-devops-platform` repository failed on the `main` branch at commit `e8e4339` during the **Quality Gate** job, specifically at the **"Test with coverage"** step. The exact error details are not captured in the automated log, requiring direct inspection of the GitHub Actions run. This failure blocks the pipeline from completing, which may prevent deployments or downstream automation from proceeding.

---

## Root Cause

The root cause cannot be fully determined without reviewing the live GitHub Actions logs, as the error output was unavailable at the time of this report. However, common root causes for a failed **"Test with coverage"** step include:

- **Insufficient code coverage:** Coverage percentage fell below the configured threshold (e.g., 80%), causing the coverage tool (Istanbul/nyc, Jest, pytest-cov, etc.) to exit with a non-zero status.
- **Failing unit or integration tests:** One or more tests in the suite are failing, causing the test runner to terminate with an error.
- **Missing or misconfigured dependencies:** Test dependencies are not installed or are incompatible with the current runtime or Node/Python version.
- **Coverage configuration drift:** A recent change to `package.json`, `jest.config.js`, `.nycrc`, `pyproject.toml`, or equivalent config files altered coverage thresholds or test file globs.
- **Environment or secret misconfiguration:** Required environment variables or secrets are missing in the Actions runtime, causing test setup to fail.

> ⚠️ **Action required:** The exact cause must be confirmed by inspecting the raw logs (see Step 1 in the fix section below).

---

## Impact

If this failure is not resolved:

- **Deployments are blocked:** Any CD stages gated behind this CI job will not trigger, preventing releases to staging or production.
- **Code quality regresses silently:** Merges that bypass the quality gate may introduce untested or low-coverage code into `main`.
- **Team velocity is reduced:** Other contributors may be blocked from merging their PRs if branch protection rules require a passing CI status on `main`.
- **Audit and compliance risk:** If coverage reporting feeds into compliance dashboards or SonarQube-style tools, missing reports may flag the project as non-compliant.

---

## Step-by-Step Fix

### Phase 1 — Diagnose the Failure

1. **Open the failed GitHub Actions run directly:**
   ```
   https://github.com/sohorabil/ai-devops-platform/actions
   ```
   Locate the failed **CI / Quality Gate** run for commit `e8e4339` and click into the **"Test with coverage"** step to read the full log output.

2. **Identify the failure type from the log:**
   - Look for lines containing `FAIL`, `ERROR`, `Coverage threshold not met`, `AssertionError`, or similar keywords.
   - Note the exact file(s), test name(s), or threshold value(s) mentioned.

3. **Reproduce the failure locally:**
   ```bash
   # Clone and switch to the exact failing commit
   git clone https://github.com/sohorabil/ai-devops-platform.git
   cd ai-devops-platform
   git checkout e8e4339bae456d9b7c7f6975998644b4b80a2134

   # Install dependencies (adjust for your stack)
   npm ci          # Node.js
   # OR
   pip install -r requirements.txt   # Python
   ```

4. **Run the test suite with coverage locally:**
   ```bash
   # Node.js / Jest
   npm run test -- --coverage

   # Node.js / nyc + mocha
   npx nyc npm test

   # Python / pytest
   pytest --cov=. --cov-report=term-missing

   # Python with threshold enforcement
   pytest --cov=. --cov-fail-under=80
   ```

---

### Phase 2 — Fix Based on Confirmed Cause

#### Scenario A: Tests Are Failing

5. **Identify failing tests from the local output**, then fix the failing test or the implementation code:
   ```bash
   # Run only the failing test file to iterate quickly
   npx jest path/to/failing.test.js --verbose
   # OR
   pytest tests/test_failing_module.py -v
   ```

6. **Commit the fix:**
   ```bash
   git add .
   git commit -m "fix: resolve failing tests in Quality Gate [ci fix]"
   git push origin main
   ```

---

#### Scenario B: Coverage Threshold Not Met

5. **Check the current coverage threshold in your config:**
   ```bash
   # For Jest — check jest.config.js or package.json
   cat jest.config.js | grep -A 10 "coverageThreshold"

   # For pytest — check pyproject.toml or setup.cfg
   cat pyproject.toml | grep "fail_under"
   ```

6. **Option 1 — Write missing tests to raise coverage:**
   ```bash
   # Identify uncovered lines
   npx jest --coverage --coverageReporters=text
   # OR
   pytest --cov=. --cov-report=term-missing

   # Add tests for uncovered code paths, then verify
   npm run test -- --coverage
   ```

7. **Option 2 — Temporarily adjust the threshold (use with caution, requires team approval):**
   ```js
   // jest.config.js — reduce threshold temporarily
   coverageThreshold: {
     global: {
       lines: 70,   // lowered from 80 — track issue #XXX
     }
   }
   ```
   ```bash
   git add jest.config.js
   git commit -m "chore: temporarily lower coverage threshold — track in issue #XXX"
   git push origin main
   ```

---

#### Scenario C: Missing Dependencies or Environment Variables

5. **Check that all required secrets are configured in the repository:**
   ```
   GitHub → Repository → Settings → Secrets and variables → Actions
   ```
   Verify that all secrets referenced in the workflow YAML are present.

6. **Check the workflow YAML for missing `env` blocks or `run` steps:**
   ```bash
   cat .github/workflows/ci.yml
   ```
   Ensure dependency installation steps (`npm ci`, `pip install`, etc.) are present before the test step.

7. **If a lockfile is outdated or missing:**
   ```bash
   # Regenerate the lockfile
   npm install       # regenerates package-lock.json
   # OR
   pip-compile requirements.in   # regenerates requirements.txt

   git add package-lock.json
   git commit -m "chore: regenerate lockfile to fix CI dependency resolution"
   git push origin main
   ```

---

### Phase 3 — Verify the Fix

8. **Monitor the new CI run triggered by your push:**
   ```
   https://github.com/sohorabil/ai-devops-platform/actions
   ```

9. **Confirm the Quality Gate job passes** and all steps, including "Test with coverage," show a green checkmark.

10. **Notify the team** via your communication channel (Slack, Teams, etc.) that the `main` branch CI is restored.

---

## Prevention

| Action | Details |
|---|---|
| **Run tests locally before pushing to `main`** | Enforce a pre-push Git hook using `husky` or `pre-commit` to run the test suite automatically. |
| **Enforce branch protection rules** | Require all PRs to pass the Quality Gate CI check before merging. Never allow direct force-pushes to `main`. |
| **Set incremental coverage enforcement** | Use tools like `diff-cover` or `jest --changedSince` to enforce coverage only on changed lines, preventing regressions without blocking development. |
| **Pin dependency versions** | Always commit `package-lock.json` or `requirements.txt` to avoid non-deterministic installs. |
| **Add a local coverage script** | Add a `Makefile` or `npm script` that mirrors the CI coverage command exactly, so developers can verify locally. |
| **Integrate Codecov or Coveralls** | Track coverage trends over time with PR-level comments showing coverage changes before merge. |
| **Alert on CI failures immediately** | Configure GitHub Actions to post failure notifications to a Slack channel or email distribution list. |

---

## Related SOPs

| Document | Path |
|---|---|
| Dependency Management & Lockfile Policy | `docs/sops/dependency-management.md` |
| Branch Protection and Merge