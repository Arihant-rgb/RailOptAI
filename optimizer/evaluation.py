"""
evaluation.py
-------------
Plan Evaluation for the maintenance optimizer.

This module does NOT change how schedules are produced -- it only looks at
a schedule AFTER the optimizer has produced it (the dict returned by
MaintenanceOptimizer.solve() / replan_schedule()) and reports how good that
schedule actually is: how many jobs got scheduled, how much train
disruption it caused, whether anything looks structurally wrong, and an
overall score you can use to compare two candidate schedules.

Everything here is plain Python -- no OR-Tools, no imports from optimizer.py
or model.py, no new dependencies. Keeping it fully standalone means it can
never destabilize the existing scheduling logic, and it can just as easily
evaluate a schedule that came from somewhere else (a hand-built plan, an
older run saved to disk) as long as it uses the same dictionary shape.

Expected schedule shape (as returned by optimizer.py's solve()):
    {
        "status": str,
        "feasible": bool,
        "blocks": [
            {
                "job_id": str,
                "block_id": str,
                "department": str | None,
                "priority": int,
                "start_minutes": int,
                "end_minutes": int,
                "disrupted_trains": list[str],
                "disruption_cost": int,
                "within_available_window": bool | None,
                ... (other fields are ignored)
            },
            ...
        ],
        "total_disruption_cost": int,   # present when feasible
        "message": str,                 # present when NOT feasible
    }

Passing the original `blocks` (the list of MaintenanceBlock you gave the
optimizer) is OPTIONAL, but unlocks a few extra checks that need
information not present in the schedule output itself: each job's
deadline and dependency list. Without it, evaluation still works using
only what's in the schedule (deadline/dependency checks are simply
skipped, and "total jobs" falls back to "however many jobs got scheduled").
"""

from typing import List, Optional


# ---------------------------------------------------------------------
# Scoring constants -- kept as plain named numbers so the formula in
# _compute_score() is easy to read and easy to retune later. Nothing
# here is tied to the CP-SAT objective in optimizer.py; this is a
# separate, simpler, human-readable scoring pass over the RESULT.
# ---------------------------------------------------------------------
SCORE_START = 100.0

PENALTY_PER_UNSCHEDULED_JOB = 20.0   # a job that never made it into the plan
PENALTY_PER_DISRUPTION_UNIT = 1.0    # per unit of reported train disruption cost
PENALTY_PER_CRITICAL_ISSUE = 25.0    # missed deadline / dependency violation / overlap
BONUS_PER_BUNDLED_JOB = 2.0          # job that landed inside an available window
BONUS_PER_REVERSE_PLANNED_JOB = 1.0  # job that landed inside a Reverse Planning window

MIN_SCORE = 0.0
MAX_SCORE = 100.0


def evaluate_schedule(schedule: dict, blocks: Optional[list] = None, trains: Optional[list] = None) -> dict:
    """
    Evaluate ONE schedule (the dict returned by solve() / replan_schedule()).

    `blocks` (optional): the original list of MaintenanceBlock objects that
    were given to the optimizer for this run. If provided, this unlocks
    deadline-violation and dependency-violation checks, and an accurate
    "unscheduled jobs" count -- none of which the schedule output alone can
    tell you, since it only lists jobs that WERE placed.

    `trains` (optional): not currently needed for any check here (train
    conflicts are already reported per job inside the schedule itself);
    accepted for API symmetry and so a caller can pass the same arguments
    it used for the optimizer without thinking about it.

    Returns a plain dict:
        {
            "feasible": bool,
            "metrics": {...},          # see _compute_metrics
            "issues": [ {...}, ... ],  # see _detect_issues
            "score": float,            # 0-100, higher is better
        }
    """
    feasible = bool(schedule.get("feasible"))
    result_blocks = schedule.get("blocks") or []

    metrics = _compute_metrics(schedule, result_blocks, blocks)
    issues = _detect_issues(schedule, result_blocks, blocks)
    score = _compute_score(feasible, metrics, issues)

    return {
        "feasible": feasible,
        "metrics": metrics,
        "issues": issues,
        "score": score,
    }


def compare_schedules(
    schedule_a: dict,
    schedule_b: dict,
    blocks: Optional[list] = None,
    trains: Optional[list] = None,
) -> dict:
    """
    Evaluate two candidate schedules and report which one is better.

    Both schedules are evaluated against the SAME `blocks`/`trains` context
    -- this only makes sense when they're two candidate plans for the SAME
    maintenance jobs (e.g. before/after a replan, or two different runs of
    the optimizer with different settings).

    Returns:
        {
            "evaluation_a": <result of evaluate_schedule(schedule_a)>,
            "evaluation_b": <result of evaluate_schedule(schedule_b)>,
            "better": "a" | "b" | "tie",
            "score_difference": float,   # score_a - score_b
        }
    """
    evaluation_a = evaluate_schedule(schedule_a, blocks=blocks, trains=trains)
    evaluation_b = evaluate_schedule(schedule_b, blocks=blocks, trains=trains)

    score_difference = round(evaluation_a["score"] - evaluation_b["score"], 2)

    if score_difference > 0:
        better = "a"
    elif score_difference < 0:
        better = "b"
    else:
        better = "tie"

    return {
        "evaluation_a": evaluation_a,
        "evaluation_b": evaluation_b,
        "better": better,
        "score_difference": score_difference,
    }


def format_evaluation_report(evaluation: dict, label: str = "Schedule") -> str:
    """
    Turn an evaluate_schedule() result into a short, human-readable report
    string. Purely a convenience for printing in a demo/CLI -- not used
    internally, and entirely optional.
    """
    lines = [f"--- {label} ---", f"Feasible: {evaluation['feasible']}", f"Score: {evaluation['score']} / 100"]

    lines.append("Metrics:")
    for key, value in evaluation["metrics"].items():
        lines.append(f"  {key}: {value}")

    if evaluation["issues"]:
        lines.append("Issues:")
        for issue in evaluation["issues"]:
            lines.append(f"  [{issue['severity']}] {issue['type']}: {issue['message']}")
    else:
        lines.append("Issues: none")

    return "\n".join(lines)


# ---------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------

def _compute_metrics(schedule: dict, result_blocks: list, blocks: Optional[list]) -> dict:
    total_jobs = len(blocks) if blocks is not None else len(result_blocks)
    scheduled_jobs = len(result_blocks)
    unscheduled_jobs = max(total_jobs - scheduled_jobs, 0)

    total_disruption_cost = schedule.get("total_disruption_cost")
    if total_disruption_cost is None:
        # Fall back to summing per-job disruption costs directly, in case
        # "total_disruption_cost" wasn't present (e.g. an infeasible
        # schedule, or a hand-built one used for testing/comparison).
        total_disruption_cost = sum(b.get("disruption_cost", 0) for b in result_blocks)

    priorities = [b.get("priority", 0) for b in result_blocks]
    average_priority = (sum(priorities) / len(priorities)) if priorities else 0.0

    window_eligible = [b for b in result_blocks if b.get("within_available_window") is not None]
    window_used = [b for b in window_eligible if b.get("within_available_window") is True]
    window_eligible_count = len(window_eligible)
    window_used_count = len(window_used)
    window_utilization = (window_used_count / window_eligible_count) if window_eligible_count else None

    # Reverse Planning metrics -- mirrors the available-window metrics
    # above exactly, just reading "within_reverse_planning_window"
    # instead. Both fields are optional in the schedule (absent/None is
    # treated the same as "not eligible"), so this stays backward
    # compatible with schedules produced before Reverse Planning existed.
    rp_eligible = [b for b in result_blocks if b.get("within_reverse_planning_window") is not None]
    rp_used = [b for b in rp_eligible if b.get("within_reverse_planning_window") is True]
    rp_eligible_count = len(rp_eligible)
    rp_used_count = len(rp_used)
    rp_utilization = (rp_used_count / rp_eligible_count) if rp_eligible_count else None

    disrupted_train_ids = set()
    for b in result_blocks:
        disrupted_train_ids.update(b.get("disrupted_trains", []))

    return {
        "total_jobs": total_jobs,
        "scheduled_jobs": scheduled_jobs,
        "unscheduled_jobs": unscheduled_jobs,
        "total_disruption_cost": total_disruption_cost,
        "distinct_disrupted_trains": len(disrupted_train_ids),
        "average_priority": round(average_priority, 2),
        "jobs_within_available_window": window_used_count,
        "window_eligible_jobs": window_eligible_count,
        "window_utilization": round(window_utilization, 2) if window_utilization is not None else None,
        "jobs_within_reverse_planning_window": rp_used_count,
        "reverse_planning_eligible_jobs": rp_eligible_count,
        "reverse_planning_utilization": round(rp_utilization, 2) if rp_utilization is not None else None,
    }


def _detect_issues(schedule: dict, result_blocks: list, blocks: Optional[list]) -> list:
    """
    Defensive, read-only sanity checks over the RESULT.

    Under normal operation, the optimizer's own CP-SAT constraints make
    every one of these impossible -- this function exists to CATCH
    mistakes (a schedule that was hand-edited, produced by a different
    tool, or produced by a future code change that accidentally weakens a
    constraint), not to second-guess a schedule the optimizer just
    produced correctly. Each issue has a "severity":
      - "info"     : worth knowing, already reflected in the score via a
                     dedicated metric (currently just train disruption).
      - "critical" : should never happen; each one costs a flat penalty
                     in the score (see _compute_score).
    """
    issues = []

    if not schedule.get("feasible", False):
        issues.append(
            {
                "type": "infeasible",
                "severity": "critical",
                "message": "Schedule is not feasible: " + str(schedule.get("message", "no message provided")),
            }
        )
        return issues  # nothing else meaningful to check on an empty schedule

    blocks_by_job_id = {b.job_id: b for b in blocks} if blocks else {}
    results_by_job_id = {b["job_id"]: b for b in result_blocks if "job_id" in b}

    # 1. Train disruption -- informational. Already penalized via the
    #    dedicated "total_disruption_cost" term in _compute_score, so this
    #    is tagged "info" (not "critical") to avoid double-penalizing it.
    for b in result_blocks:
        if b.get("disruption_cost", 0) > 0:
            issues.append(
                {
                    "type": "train_disruption",
                    "severity": "info",
                    "message": (
                        f"Job '{b.get('job_id')}' disrupts train(s) {b.get('disrupted_trains')} "
                        f"(cost {b.get('disruption_cost')})."
                    ),
                }
            )

    # 2. Missed deadlines (needs original blocks for the deadline value).
    if blocks_by_job_id:
        for job_id, result in results_by_job_id.items():
            original = blocks_by_job_id.get(job_id)
            if original and result.get("end_minutes", 0) > original.deadline:
                issues.append(
                    {
                        "type": "missed_deadline",
                        "severity": "critical",
                        "message": (
                            f"Job '{job_id}' finishes at {result.get('end_minutes')}, "
                            f"after its deadline of {original.deadline}."
                        ),
                    }
                )

        # 3. Dependency violations (needs original blocks for the
        #    dependency list -- dependencies refer to job_id, same as
        #    everywhere else in this codebase).
        for job_id, result in results_by_job_id.items():
            original = blocks_by_job_id.get(job_id)
            if not original or not original.dependencies:
                continue
            for dep_job_id in original.dependencies:
                dep_result = results_by_job_id.get(dep_job_id)
                if dep_result is None:
                    issues.append(
                        {
                            "type": "dependency_violation",
                            "severity": "critical",
                            "message": f"Job '{job_id}' depends on '{dep_job_id}', which was not scheduled.",
                        }
                    )
                elif result.get("start_minutes", 0) < dep_result.get("end_minutes", 0):
                    issues.append(
                        {
                            "type": "dependency_violation",
                            "severity": "critical",
                            "message": (
                                f"Job '{job_id}' starts at {result.get('start_minutes')} before its "
                                f"dependency '{dep_job_id}' finishes at {dep_result.get('end_minutes')}."
                            ),
                        }
                    )

    # 4. Overlapping maintenance jobs on the same railway section
    #    (block_id). Works even without the original `blocks` list, since
    #    block_id/start/end are already in the schedule output.
    by_block_id = {}
    for b in result_blocks:
        by_block_id.setdefault(b.get("block_id"), []).append(b)

    for block_id, jobs_on_section in by_block_id.items():
        jobs_sorted = sorted(jobs_on_section, key=lambda b: b.get("start_minutes", 0))
        for first, second in zip(jobs_sorted, jobs_sorted[1:]):
            if first.get("end_minutes", 0) > second.get("start_minutes", 0):
                issues.append(
                    {
                        "type": "overlap",
                        "severity": "critical",
                        "message": (
                            f"Jobs '{first.get('job_id')}' and '{second.get('job_id')}' overlap "
                            f"on section '{block_id}'."
                        ),
                    }
                )

    return issues


def _compute_score(feasible: bool, metrics: dict, issues: list) -> float:
    """
    Simple, deterministic 0-100 score. Higher is better.

    The formula is intentionally simple and transparent (see the named
    constants at the top of this file) rather than a tuned/learned model --
    it's meant to give a quick, explainable comparison between candidate
    schedules, not to replace the CP-SAT objective in optimizer.py (which
    is what actually decides HOW a schedule gets built).
    """
    if not feasible:
        return MIN_SCORE

    critical_issue_count = sum(1 for issue in issues if issue.get("severity") == "critical")

    score = SCORE_START
    score -= metrics["unscheduled_jobs"] * PENALTY_PER_UNSCHEDULED_JOB
    score -= metrics["total_disruption_cost"] * PENALTY_PER_DISRUPTION_UNIT
    score -= critical_issue_count * PENALTY_PER_CRITICAL_ISSUE
    score += metrics["jobs_within_available_window"] * BONUS_PER_BUNDLED_JOB
    score += metrics["jobs_within_reverse_planning_window"] * BONUS_PER_REVERSE_PLANNED_JOB

    return max(MIN_SCORE, min(MAX_SCORE, round(score, 2)))


if __name__ == "__main__":
    # -----------------------------------------------------------------
    # Small demo -- not part of the module's public API. Shows:
    #   1. Evaluating one real, optimizer-generated schedule.
    #   2. Evaluating a deliberately broken schedule (hand-built here, to
    #      simulate "a worse candidate plan") that has a dependency
    #      violation AND an overlap.
    #   3. Comparing the two.
    # -----------------------------------------------------------------
    from .model import MaintenanceBlock, Train
    from .optimizer import replan_schedule

    blocks = [
        MaintenanceBlock(job_id="TMS001", block_id="SEC-1", maintenance_duration=60, deadline=300, priority=5),
        MaintenanceBlock(
            job_id="TD001", block_id="SEC-1", maintenance_duration=45, deadline=300, priority=7,
            dependencies=["TMS001"],
        ),
    ]
    trains = [
        Train(train_id="EXP-1", block_id="SEC-1", arrival=200, departure=260, priority=10, can_be_affected=False),
    ]

    good_schedule = replan_schedule(blocks, trains)
    good_evaluation = evaluate_schedule(good_schedule, blocks=blocks, trains=trains)
    print(format_evaluation_report(good_evaluation, label="Good schedule (from the optimizer)"))

    # A deliberately broken "candidate" schedule for the SAME two jobs:
    # TD001 starts at 30, before its dependency TMS001 finishes at 60
    # (dependency violation) AND while TMS001 is still running
    # (overlap on the same section, SEC-1).
    bad_schedule = {
        "status": "FEASIBLE",
        "feasible": True,
        "blocks": [
            {
                "job_id": "TMS001", "block_id": "SEC-1", "department": None, "priority": 5,
                "start_minutes": 0, "end_minutes": 60, "start_time": "00:00", "end_time": "01:00",
                "disrupted_trains": [], "disruption_cost": 0, "within_available_window": None,
            },
            {
                "job_id": "TD001", "block_id": "SEC-1", "department": None, "priority": 7,
                "start_minutes": 30, "end_minutes": 75, "start_time": "00:30", "end_time": "01:15",
                "disrupted_trains": [], "disruption_cost": 0, "within_available_window": None,
            },
        ],
        "total_disruption_cost": 0,
    }
    bad_evaluation = evaluate_schedule(bad_schedule, blocks=blocks, trains=trains)
    print()
    print(format_evaluation_report(bad_evaluation, label="Bad schedule (hand-built, deliberately broken)"))

    comparison = compare_schedules(good_schedule, bad_schedule, blocks=blocks, trains=trains)
    print(f"\n=== Comparison ===")
    print(f"Better schedule: {comparison['better']}")
    print(f"Score difference (good - bad): {comparison['score_difference']}")