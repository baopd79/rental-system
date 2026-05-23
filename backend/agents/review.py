# /// script
# dependencies = ["anthropic>=0.40.0"]
# ///
"""
Multi-agent code reviewer for rental-system.

Usage:
    uv run agents/review.py backend/app/services/billing_service.py

Architecture:
    Orchestrator reads the file, spawns 3 subagents in parallel:
    - Security Agent   : auth, data exposure, injection risks
    - Architecture Agent: Router→Service→Repo compliance, DI rules
    - Logic Agent      : billing rules, business logic correctness

    Orchestrator synthesizes all findings into a final report.
"""

import asyncio
import sys
from pathlib import Path
import anthropic

client = anthropic.AsyncAnthropic()
MODEL = "claude-sonnet-4-6"

ARCHITECTURE_RULES = """
Project rules (from CLAUDE.md):
- Layer hierarchy: Router → Service → Repository → Model (strict, no skipping)
- Services: own all business logic + transaction (call session.commit). Raise AppException subclasses, NEVER HTTPException.
- Repositories: DB ops only, no commits, call session.flush() after writes.
- DI: Depends() only in core/dependencies.py, never in service constructors.
- Auth: all endpoints require CurrentUserDep; clerk_user_id passed explicitly to every service method.
- Exceptions: NotFoundException, ForbiddenException, ConflictException, BadRequestException from core/exceptions.py.
- NEVER use async with session.begin() in services.
"""

BILLING_RULES = """
Billing domain rules (from CLAUDE.md):
- UtilityReading.period = "YYYY-MM" = invoice month (not reading-taken month).
- elec_prev is auto-filled from elec_curr of previous month, only if same contract_id.
- Move-in reading: elec_prev = elec_curr = initial_value (curr == prev → 0 consumption, valid).
- Proration applies to rent and fixed surcharges only; meter-based utilities are never prorated.
- Invoice status flow: draft → sent → paid. Only draft can be deleted or edited.
- Cannot end a contract with unpaid (draft/sent) invoices.
- water_calc_type: per_meter, per_person, per_room.
- Previous tenant's utility_reading must NEVER be used as elec_prev for a new tenant.
"""


async def run_subagent(name: str, system_prompt: str, code: str, filepath: str) -> dict:
    """Single subagent: focused review from one perspective."""
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Review this file: {filepath}\n\n```python\n{code}\n```",
            }
        ],
    )
    return {"agent": name, "findings": response.content[0].text}


async def security_agent(code: str, filepath: str) -> dict:
    system = """You are a security-focused code reviewer.
Review for:
- Missing or incorrect auth checks (CurrentUserDep, clerk_user_id isolation)
- Data exposure (PII, CCCD, SĐT on public endpoints)
- SQL injection in raw sqlalchemy.text() queries
- Unauthenticated access outside /invoices/public/*
- Row-level isolation: every query must filter by clerk_user_id via property FK chain

Report only real issues. Be concise. Format: bullet points with severity [HIGH/MED/LOW]."""
    return await run_subagent("Security", system, code, filepath)


async def architecture_agent(code: str, filepath: str) -> dict:
    system = f"""You are an architecture-focused code reviewer for a FastAPI project.
{ARCHITECTURE_RULES}

Review for violations of the above rules.
Report only real issues. Be concise. Format: bullet points with severity [HIGH/MED/LOW]."""
    return await run_subagent("Architecture", system, code, filepath)


async def logic_agent(code: str, filepath: str) -> dict:
    system = f"""You are a business logic reviewer for a Vietnamese rental management system.
{BILLING_RULES}

Review for violations of the above billing/domain rules.
If the file is not billing-related, say "Not applicable" and stop.
Report only real issues. Be concise. Format: bullet points with severity [HIGH/MED/LOW]."""
    return await run_subagent("Logic", system, code, filepath)


async def orchestrator(filepath: str) -> None:
    path = Path(filepath)
    if not path.exists():
        print(f"File not found: {filepath}")
        sys.exit(1)

    code = path.read_text()
    print(f"Reviewing: {filepath} ({len(code.splitlines())} lines)\n")
    print("Spawning 3 subagents in parallel...\n")

    # Spawn all 3 subagents simultaneously
    results = await asyncio.gather(
        security_agent(code, filepath),
        architecture_agent(code, filepath),
        logic_agent(code, filepath),
    )

    # Print each subagent's findings
    for result in results:
        print(f"{'=' * 60}")
        print(f"[{result['agent']} Agent]")
        print(f"{'=' * 60}")
        print(result["findings"])
        print()

    # Orchestrator synthesizes
    print(f"{'=' * 60}")
    print("[Orchestrator — Synthesis]")
    print(f"{'=' * 60}")

    findings_text = "\n\n".join(
        f"## {r['agent']} Agent\n{r['findings']}" for r in results
    )

    synthesis = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        system="You are a lead engineer synthesizing code review findings. Be brief and actionable.",
        messages=[
            {
                "role": "user",
                "content": (
                    f"These are parallel subagent reviews of {filepath}.\n\n"
                    f"{findings_text}\n\n"
                    "Synthesize into: 1) Top 3 issues to fix now, 2) One-line overall verdict."
                ),
            }
        ],
    )
    print(synthesis.content[0].text)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: uv run agents/review.py <path-to-python-file>")
        print(
            "Example: uv run agents/review.py backend/app/services/billing_service.py"
        )
        sys.exit(1)

    asyncio.run(orchestrator(sys.argv[1]))
