"""
optimizer.py
------------
CP-SAT based scheduler for MULTIPLE maintenance blocks against a list of
trains, solved together in a single model run.

Key ideas:
  - Every MaintenanceBlock gets its own start/end decision variables.
  - A maintenance block only "sees" trains whose train.block_id matches
    the maintenance block's block_id (same railway section) -- see
    constraints.py.
  - Maintenance blocks that share a block_id (same railway section) cannot
    overlap each other in time, since only one maintenance activity can
    occupy a track section at once.
  - Dependencies (block.dependencies) refer to other jobs by job_id and
    force start_of_this_job >= end_of_that_job.
  - The objective has up to FOUR parts, combined so each one only ever
    breaks TIES left by the one before it (see _build_objective):
      1. Train disruption cost -- always the main thing we minimize.
      2. Prefer finishing higher-priority maintenance blocks earlier,
         but ONLY when it doesn't cost any extra train disruption.
      3. Prefer bundling jobs into a shared AvailableBlockWindow when
         given one, but ONLY when it doesn't change (1) or (2) at all.
      4. Reverse Planning: prefer jobs landing entirely inside a
         sufficiently long train-free gap ("Reverse Planning window"),
         but ONLY when it doesn't change (1), (2), or (3) at all. This
         is a SOFT preference only -- a job that doesn't fit any Reverse
         Planning window is still fully schedulable anywhere else that's
         otherwise feasible (see ReversePlanningWindow /
         compute_reverse_planning_windows below).
"""

from collections import defaultdict
from dataclasses import dataclass, replace

from ortools.sat.python import cp_model

from .model import MaintenanceBlock, Train, AvailableBlockWindow
from .constraints import (
    add_time_bounds,
    add_hard_no_overlap_constraints,
    add_soft_overlap_vars,
    add_no_overlap_between_maintenance_blocks,
    validate_dependencies,
    add_dependency_constraints,
    add_bundle_window_indicator,
)


def minutes_to_hhmm(total_minutes: int) -> str:
    """Convert minutes-from-start-of-day into a human-readable HH:MM string."""
    hours = (total_minutes // 60) % 24
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


# ---------------------------------------------------------------------
# Reverse Planning
# ---------------------------------------------------------------------
#
# "Reverse Planning" (MVP version) means: look at where the trains
# already are on a railway section, find the train-free gaps between
# them, and -- if a gap is long enough to be practically useful for
# maintenance -- offer it to the optimizer as a place it should PREFER
# to put maintenance jobs. It is deliberately NOT based on "few trains"
# or traffic density/intensity -- only on the raw train-free gap length,
# per the MVP scope for this feature.
#
# This is intentionally just plain data + plain Python, with no CP-SAT
# involved -- exactly like AvailableBlockWindow. The optimizer decides
# what to DO with these windows (see MaintenanceOptimizer.build()).

@dataclass(frozen=True)
class ReversePlanningWindow:
    """
    One Reverse Planning window: a train-free gap on a single railway
    section/block (`block_id`) that is at least as long as the
    configured minimum gap duration, expressed as [window_start,
    window_end) in minutes-from-start-of-day.
    """
    block_id: str
    window_start: int
    window_end: int


def _merge_train_intervals(trains_for_block):
    """
    Sort a section's train movements by arrival time and merge any that
    overlap (or touch), so that gap-finding below never mistakes two
    overlapping/adjacent train movements for a train-free gap between
    them. Zero-duration entries (arrival == departure) are ignored.

    Returns a list of (start, end) tuples, sorted and non-overlapping.
    """
    intervals = sorted(
        ((t.arrival, t.departure) for t in trains_for_block if t.departure > t.arrival),
        key=lambda pair: pair[0],
    )

    merged = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def compute_reverse_planning_windows(trains, block_ids, horizon, min_gap_minutes=60):
    """
    Find Reverse Planning windows: train-free gaps that are at least
    `min_gap_minutes` long, for every block_id in `block_ids`.

    For each block_id:
      - Collect that section's train movements and merge overlaps.
      - Walk the merged movements in time order, tracking the gap
        before each one (starting from minute 0).
      - Keep a gap only if it's >= min_gap_minutes long.
      - Also check the trailing gap after the last train movement, up
        to `horizon`.
      - A section with NO trains at all is simply one big gap from 0 to
        `horizon` -- handled for free by the same logic (no special
        case needed), which satisfies "handles sections with no
        trains".

    This function does NOT look at traffic density or "few trains" --
    only at raw train-free gap length, per the MVP scope.

    Returns a list[ReversePlanningWindow], in no particular guaranteed
    order beyond being grouped by block_id in the order block_ids was
    given, and chronological within each block_id.
    """
    if min_gap_minutes <= 0:
        return []

    trains_by_block = defaultdict(list)
    for train in trains:
        trains_by_block[train.block_id].append(train)

    windows = []
    for block_id in block_ids:
        merged = _merge_train_intervals(trains_by_block.get(block_id, []))

        cursor = 0
        for start, end in merged:
            if start - cursor >= min_gap_minutes:
                windows.append(ReversePlanningWindow(block_id, cursor, start))
            cursor = max(cursor, end)

        # Trailing gap after the last train movement (or the ENTIRE
        # horizon, if this section has no trains at all -- cursor is
        # still 0 in that case).
        if horizon - cursor >= min_gap_minutes:
            windows.append(ReversePlanningWindow(block_id, cursor, horizon))

    return windows


class MaintenanceOptimizer:
    def __init__(
        self,
        blocks: list[MaintenanceBlock],
        trains: list[Train],
        horizon: int = None,
        available_windows: list[AvailableBlockWindow] = None,
        enable_reverse_planning: bool = True,
        reverse_planning_min_gap: int = 60,
        reverse_planning_windows: list[ReversePlanningWindow] = None,
    ):
        self.blocks = blocks
        self.trains = trains
        # OPTIONAL: available block windows for cross-department bundling.
        # Defaults to none, which reproduces the exact previous behavior.
        self.available_windows = available_windows or []

        # Horizon = latest point in time we ever need to reason about.
        if horizon is None:
            latest_deadline = max((b.deadline for b in blocks), default=0)
            latest_departure = max((t.departure for t in trains), default=0)
            horizon = max(latest_deadline, latest_departure)
        self.horizon = horizon

        # Reverse Planning is a SOFT PREFERENCE, enabled by default. It
        # never adds a hard constraint -- see build()/`_build_objective`.
        # `min_gap` is the configurable minimum train-free gap length
        # (in minutes) for a gap to count as a Reverse Planning window.
        self.enable_reverse_planning = enable_reverse_planning
        self.reverse_planning_min_gap = reverse_planning_min_gap

        if reverse_planning_windows is not None:
            # Caller supplied their own windows explicitly (e.g. tests,
            # or a caller that wants to compute them differently) -- use
            # those as-is, regardless of enable_reverse_planning's value
            # for auto-computation (enable_reverse_planning still gates
            # whether they're actually used in build()).
            self.reverse_planning_windows = reverse_planning_windows
        elif enable_reverse_planning:
            block_ids = {block.block_id for block in blocks}
            self.reverse_planning_windows = compute_reverse_planning_windows(
                trains, block_ids, self.horizon, min_gap_minutes=reverse_planning_min_gap,
            )
        else:
            self.reverse_planning_windows = []

        self.model = cp_model.CpModel()

        # Per-block decision variables, kept in lists indexed by position
        # (NOT by block_id, since several blocks can share the same
        # block_id when they're queued on the same railway section).
        self.block_starts = []
        self.block_ends = []
        self.block_intervals = []

        # overlap_info[i] = list of (Train, overlap_boolvar) for blocks[i]
        self.overlap_info = []

        # bundle_info[i] = list of (AvailableBlockWindow, fits_boolvar) for
        # blocks[i] -- filled in during build(), used to report whether a
        # block ended up inside one of its candidate windows.
        self.bundle_info = []

        # reverse_planning_info[i] = list of (ReversePlanningWindow,
        # fits_boolvar) for blocks[i] -- filled in during build(), used to
        # report whether a block ended up inside one of its candidate
        # Reverse Planning windows.
        self.reverse_planning_info = []

    def build(self):
        model = self.model

        # 1. Create variables + basic timing constraints for every block.
        for i, block in enumerate(self.blocks):
            start = model.NewIntVar(0, self.horizon, f"start_{i}_{block.job_id}")
            end = model.NewIntVar(0, self.horizon, f"end_{i}_{block.job_id}")
            interval = model.NewIntervalVar(
                start, block.maintenance_duration, end, f"interval_{i}_{block.job_id}"
            )

            add_time_bounds(
                model,
                start,
                end,
                block.maintenance_duration,
                block.deadline,
                self.horizon,
                earliest_start=block.earliest_start,
                latest_end=block.latest_end,
            )

            self.block_starts.append(start)
            self.block_ends.append(end)
            self.block_intervals.append(interval)

        # 2. Train-vs-block constraints (hard + soft), scoped to each
        #    block's own block_id so it only ever conflicts with trains
        #    on the same railway section.
        all_overlap_terms = []
        for i, block in enumerate(self.blocks):
            start = self.block_starts[i]
            end = self.block_ends[i]

            add_hard_no_overlap_constraints(model, start, end, block.block_id, self.trains)
            overlap_info = add_soft_overlap_vars(model, start, end, block.block_id, self.trains)

            self.overlap_info.append(overlap_info)
            all_overlap_terms.extend(overlap_info)

        # 3. Maintenance blocks on the SAME railway block must not overlap
        #    each other -- group their intervals by block_id first.
        intervals_by_railway_block = defaultdict(list)
        for i, block in enumerate(self.blocks):
            intervals_by_railway_block[block.block_id].append(self.block_intervals[i])

        for interval_vars in intervals_by_railway_block.values():
            add_no_overlap_between_maintenance_blocks(model, interval_vars)

        # 4. Dependency constraints: a job can only start once every job it
        #    depends on has finished. Dependencies refer to `job_id`, NOT
        #    `block_id` (block_id is the railway section, which several
        #    jobs can share). validate_dependencies has already run (see
        #    solve()), so every job_id is guaranteed unique -- safe to look
        #    up directly.
        job_id_to_index = {block.job_id: i for i, block in enumerate(self.blocks)}

        for i, block in enumerate(self.blocks):
            for dep_job_id in (block.dependencies or []):
                dependency_index = job_id_to_index[dep_job_id]
                add_dependency_constraints(
                    model, self.block_starts[i], self.block_ends[dependency_index]
                )

        # 5. Bundling bonus (soft, optional): for every available block
        #    window that shares a block_id with this job, create a boolean
        #    that's TRUE if the job fits entirely inside that window. These
        #    are only ever used as a small tie-breaking bonus in the
        #    objective below -- never a hard constraint, so a job that
        #    doesn't fit is simply not rewarded, not made infeasible.
        all_bundle_terms = []
        self.bundle_info = [[] for _ in self.blocks]

        for w_index, window in enumerate(self.available_windows):
            for i, block in enumerate(self.blocks):
                if block.block_id != window.block_id:
                    continue
                fits = add_bundle_window_indicator(
                    model,
                    self.block_starts[i],
                    self.block_ends[i],
                    window.window_start,
                    window.window_end,
                    name_suffix=f"{i}_{block.job_id}_w{w_index}",
                )
                self.bundle_info[i].append((window, fits))
                all_bundle_terms.append(fits)

        # 6. Reverse Planning bonus (soft, optional, weakest preference of
        #    all): for every Reverse Planning window that shares a
        #    block_id with this job, create a boolean that's TRUE if the
        #    job fits entirely inside that window. Exactly the same
        #    mechanism as bundling above (reuses the same helper) -- just
        #    a different source of candidate windows. NEVER a hard
        #    constraint: a job that fits no Reverse Planning window is
        #    simply not rewarded, not made infeasible, and remains fully
        #    schedulable in any other otherwise-feasible slot.
        all_reverse_planning_terms = []
        self.reverse_planning_info = [[] for _ in self.blocks]

        if self.enable_reverse_planning:
            for w_index, window in enumerate(self.reverse_planning_windows):
                for i, block in enumerate(self.blocks):
                    if block.block_id != window.block_id:
                        continue
                    fits = add_bundle_window_indicator(
                        model,
                        self.block_starts[i],
                        self.block_ends[i],
                        window.window_start,
                        window.window_end,
                        name_suffix=f"rp_{i}_{block.job_id}_w{w_index}",
                    )
                    self.reverse_planning_info[i].append((window, fits))
                    all_reverse_planning_terms.append(fits)

        # 7. Objective (see _build_objective for the full explanation).
        self._build_objective(all_overlap_terms, all_bundle_terms, all_reverse_planning_terms)

    def _build_objective(self, all_overlap_terms, all_bundle_terms, all_reverse_planning_terms):
        """
        Build a single objective expression with up to FOUR tiers, each one
        only ever breaking ties left by the tier before it:
          (a) minimize train disruption FIRST,
          (b) among schedules that disrupt trains equally, prefer finishing
              higher-priority maintenance blocks earlier,
          (c) among schedules that are equally good on (a) and (b), prefer
              ones that bundle jobs into a shared AvailableBlockWindow.
          (d) among schedules that are equally good on (a), (b), and (c),
              prefer ones where jobs land entirely inside a Reverse
              Planning window (a sufficiently long train-free gap).

        How each tier is kept strictly subordinate to the one before it:
        We multiply the "more important" tiers by a number guaranteed to be
        bigger than the biggest possible value the "less important" tiers
        could ever reach. That way the solver can never trade a real unit
        of a higher tier for a better score on a lower one -- lower tiers
        only ever choose between solutions the higher tiers already
        consider equally good. This is the same lexicographic-weighting
        trick used for (a) vs (b); (c) and (d) are just more layers on top
        of it, in decreasing order of importance. Tiers with no terms at
        all are skipped, so behavior is EXACTLY unchanged whenever bundling
        and/or Reverse Planning aren't in play.
        """
        model = self.model

        # (a) Train disruption cost -- exactly as before.
        if all_overlap_terms:
            disruption_cost = sum(overlap * train.priority for train, overlap in all_overlap_terms)
        else:
            disruption_cost = 0

        # (b) Scheduling term: for each block, priority * end_time.
        # Minimizing this pushes HIGH-priority blocks towards a SMALL end
        # time, i.e. finishing earlier. Low-priority blocks barely matter.
        scheduling_cost = sum(
            block.priority * self.block_ends[i] for i, block in enumerate(self.blocks)
        )

        # The scheduling term can never exceed horizon * (sum of all block
        # priorities). Using a weight one bigger than that guarantees (a)
        # always dominates (b).
        total_block_priority = sum(block.priority for block in self.blocks)
        priority_weight = self.horizon * total_block_priority + 1

        cost = disruption_cost * priority_weight + scheduling_cost

        # (c) Bundling bonus: reward (via a lower cost) every job that fits
        # entirely inside one of its candidate AvailableBlockWindows.
        if all_bundle_terms:
            bundle_bonus_sum = sum(all_bundle_terms)
            # The bonus can never exceed the number of (job, window) pairs
            # we created. Scaling cost up by one more than that guarantees
            # (a) and (b) together always dominate (c).
            max_possible_bundle_bonus = len(all_bundle_terms)
            cost = cost * (max_possible_bundle_bonus + 1) - bundle_bonus_sum

        # (d) Reverse Planning bonus: same idea, one tier weaker than (c),
        # using candidate Reverse Planning windows instead.
        if all_reverse_planning_terms:
            reverse_planning_bonus_sum = sum(all_reverse_planning_terms)
            max_possible_rp_bonus = len(all_reverse_planning_terms)
            cost = cost * (max_possible_rp_bonus + 1) - reverse_planning_bonus_sum

        model.Minimize(cost)

    def solve(self, max_time_in_seconds: float = 10.0) -> dict:
        # Check dependencies BEFORE building any CP-SAT variables, so bad
        # dependency data (unknown block_id, ambiguous block_id, or a
        # circular dependency) never reaches the solver -- it's reported
        # as a clear error instead.
        dependency_error = validate_dependencies(self.blocks)
        if dependency_error:
            return {
                "status": "INVALID_DEPENDENCIES",
                "feasible": False,
                "message": dependency_error,
                "blocks": [],
            }

        self.build()

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_in_seconds
        status = solver.Solve(self.model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {
                "status": solver.StatusName(status),
                "feasible": False,
                "message": "No feasible schedule found for the given maintenance blocks and trains.",
                "blocks": [],
            }

        block_results = []
        total_disruption_cost = 0

        for i, block in enumerate(self.blocks):
            start_min = solver.Value(self.block_starts[i])
            end_min = solver.Value(self.block_ends[i])

            disrupted_trains = [
                train.train_id
                for train, overlap in self.overlap_info[i]
                if solver.Value(overlap) == 1
            ]
            block_cost = sum(
                train.priority
                for train, overlap in self.overlap_info[i]
                if solver.Value(overlap) == 1
            )
            total_disruption_cost += block_cost

            # True if this job landed entirely inside ANY of its candidate
            # available windows; None if it had no candidate window at all.
            within_available_window = None
            if self.bundle_info[i]:
                within_available_window = any(
                    solver.Value(fits) == 1 for _window, fits in self.bundle_info[i]
                )

            # True if this job landed entirely inside ANY of its candidate
            # Reverse Planning windows; None if it had no candidate
            # Reverse Planning window at all (e.g. feature disabled, or no
            # train-free gap on its section was long enough).
            within_reverse_planning_window = None
            if self.reverse_planning_info[i]:
                within_reverse_planning_window = any(
                    solver.Value(fits) == 1 for _window, fits in self.reverse_planning_info[i]
                )

            block_results.append(
                {
                    "block_index": i,
                    "job_id": block.job_id,
                    "block_id": block.block_id,
                    "department": block.department,
                    "priority": block.priority,
                    "start_minutes": start_min,
                    "end_minutes": end_min,
                    "start_time": minutes_to_hhmm(start_min),
                    "end_time": minutes_to_hhmm(end_min),
                    "disrupted_trains": disrupted_trains,
                    "disruption_cost": block_cost,
                    "within_available_window": within_available_window,
                    "within_reverse_planning_window": within_reverse_planning_window,
                }
            )

        return {
            "status": solver.StatusName(status),
            "feasible": True,
            "blocks": block_results,
            "total_disruption_cost": total_disruption_cost,
            # Informational only -- the actual windows considered for
            # Reverse Planning this run (empty if the feature was
            # disabled, or if no section had a qualifying train-free gap).
            "reverse_planning_windows": [
                {
                    "block_id": w.block_id,
                    "window_start": w.window_start,
                    "window_end": w.window_end,
                    "start_time": minutes_to_hhmm(w.window_start),
                    "end_time": minutes_to_hhmm(w.window_end),
                }
                for w in self.reverse_planning_windows
            ],
        }


def update_train_schedule(trains, train_id, new_arrival=None, new_departure=None):
    """
    Return a NEW list of trains where the train matching `train_id` has an
    updated arrival and/or departure time (e.g. because it got delayed).

    The original `trains` list is NOT modified -- this makes it easy to
    keep the "before" version around for comparison, exactly like the demo
    below does. Pass only the values that actually changed; leave the other
    one as None to keep that train's existing time.
    """
    updated_trains = []

    for train in trains:
        if train.train_id == train_id:
            changes = {}
            if new_arrival is not None:
                changes["arrival"] = new_arrival
            if new_departure is not None:
                changes["departure"] = new_departure
            train = replace(train, **changes)  # makes a modified copy, doesn't mutate the original
        updated_trains.append(train)

    return updated_trains


def replan_schedule(
    blocks,
    trains,
    horizon=None,
    max_time_in_seconds=10.0,
    available_windows=None,
    enable_reverse_planning=True,
    reverse_planning_min_gap=60,
    reverse_planning_windows=None,
):
    """
    Dynamic replanning, MVP version.

    The idea behind "dynamic replanning" is simple: something in the real
    world changed (a train got delayed, added, or cancelled), so we take the
    LATEST maintenance jobs and the LATEST train information and run the
    optimizer again, from scratch, to get an up-to-date schedule.

    `enable_reverse_planning` / `reverse_planning_min_gap` /
    `reverse_planning_windows` are OPTIONAL and simply forwarded to
    MaintenanceOptimizer -- Reverse Planning is enabled by default (see
    MaintenanceOptimizer for the full explanation), can be disabled with
    `enable_reverse_planning=False`, and never changes any existing
    behavior since it's purely a soft preference in the objective.

    This function does NOT add any new optimization logic of its own -- it
    just builds a normal MaintenanceOptimizer with whatever `blocks` and
    `trains` it's given, and solves it. Every existing rule (priority,
    time windows, hard/soft train constraints, same-section non-overlap,
    dependencies, deadlines) is still fully enforced, because underneath
    it's the exact same model being built and solved as before.

    `available_windows` is OPTIONAL (defaults to None, meaning no bundling
    bonus at all -- behavior is then identical to before this feature).

    Think of it as: "run the planner again, but with today's information."
    """
    optimizer = MaintenanceOptimizer(
        blocks,
        trains,
        horizon=horizon,
        available_windows=available_windows,
        enable_reverse_planning=enable_reverse_planning,
        reverse_planning_min_gap=reverse_planning_min_gap,
        reverse_planning_windows=reverse_planning_windows,
    )
    return optimizer.solve(max_time_in_seconds=max_time_in_seconds)


def solve_and_evaluate(
    blocks,
    trains,
    horizon=None,
    max_time_in_seconds=10.0,
    available_windows=None,
    enable_reverse_planning=True,
    reverse_planning_min_gap=60,
    reverse_planning_windows=None,
):
    """
    Convenience wrapper: run the optimizer via replan_schedule(), then
    immediately score the result with evaluation.py's evaluate_schedule().

    This is EXACTLY equivalent to calling:
        schedule = replan_schedule(blocks, trains, ...)
        evaluation = evaluate_schedule(schedule, blocks=blocks, trains=trains)
    yourself -- it exists purely so callers who want an evaluated result
    don't have to know about the evaluation module at all. It does not
    change how scheduling works, and evaluation.py is imported here (not
    at the top of this file) so that evaluation stays a fully optional,
    independent module -- nothing about the core scheduling logic depends
    on it existing.

    Returns a (schedule, evaluation) tuple.
    """
    from .evaluation import evaluate_schedule  # local import: keeps evaluation fully optional

    schedule = replan_schedule(
        blocks, trains, horizon=horizon, max_time_in_seconds=max_time_in_seconds,
        available_windows=available_windows,
        enable_reverse_planning=enable_reverse_planning,
        reverse_planning_min_gap=reverse_planning_min_gap,
        reverse_planning_windows=reverse_planning_windows,
    )
    evaluation = evaluate_schedule(schedule, blocks=blocks, trains=trains)
    return schedule, evaluation



if __name__ == "__main__":
    # -----------------------------------------------------------------
    # Small helper just for printing -- not part of the module's API.
    # -----------------------------------------------------------------
    def print_schedule(label, result):
        print(f"\n--- {label} ---")
        if not result["feasible"]:
            print(result["message"])
            return
        for b in result["blocks"]:
            print(b)
        print("Total disruption cost:", result["total_disruption_cost"])

    # -----------------------------------------------------------------
    # 1. Set up the maintenance jobs. These don't change during this demo --
    #    only the train information will change, to simulate a real delay.
    # -----------------------------------------------------------------
    blocks = [
        MaintenanceBlock(job_id="MJ-SEC1-A", block_id="SEC-1", maintenance_duration=60, deadline=300, priority=1),
        # This job must start at 100 or later, and is high priority (9) --
        # watch it move to an earlier slot once the train's delay opens one up.
        MaintenanceBlock(
            job_id="MJ-SEC1-B", block_id="SEC-1", maintenance_duration=45, deadline=300,
            priority=9, earliest_start=100,
        ),
        # Independent section -- included to show it is unaffected by what
        # happens on SEC-1 below.
        MaintenanceBlock(
            job_id="MJ-SEC2-A", block_id="SEC-2", maintenance_duration=90, deadline=400, priority=5,
            earliest_start=120, latest_end=360,
        ),
    ]

    # -----------------------------------------------------------------
    # 2. Set up the ORIGINAL train information and get the ORIGINAL schedule.
    # -----------------------------------------------------------------
    trains = [
        Train(train_id="EXP-101", block_id="SEC-1", arrival=120, departure=150, priority=10, can_be_affected=False),
        Train(train_id="PASS-202", block_id="SEC-1", arrival=200, departure=260, priority=5),
        Train(train_id="LOCAL-303", block_id="SEC-2", arrival=100, departure=160, priority=2),
    ]

    initial_result = replan_schedule(blocks, trains)
    print_schedule("Initial schedule (EXP-101 on time: 120-150)", initial_result)

    # -----------------------------------------------------------------
    # 3. The railway situation changes: EXP-101 gets delayed.
    #    Everything else (maintenance jobs, other trains) stays the same --
    #    we only update EXP-101's arrival/departure.
    # -----------------------------------------------------------------
    delayed_trains = update_train_schedule(
        trains, train_id="EXP-101", new_arrival=160, new_departure=190
    )

    # -----------------------------------------------------------------
    # 4. Replan: run the SAME optimizer again with the UPDATED train data.
    # -----------------------------------------------------------------
    new_result = replan_schedule(blocks, delayed_trains)
    print_schedule("New schedule after EXP-101 is delayed to 160-190", new_result)

    # -----------------------------------------------------------------
    # 5. Maintenance DEPENDENCIES demo: some jobs must happen in a strict
    #    order. TD001 can only start after TMS001 finishes, and SM001 can
    #    only start after TD001 finishes. All three are DIFFERENT jobs
    #    (different job_id) on the SAME railway section (same block_id) --
    #    this is exactly the case job_id was introduced to handle correctly.
    # -----------------------------------------------------------------
    dependency_blocks = [
        MaintenanceBlock(job_id="TMS001", block_id="SEC-1", maintenance_duration=60, deadline=500, priority=5),
        MaintenanceBlock(
            job_id="TD001", block_id="SEC-1", maintenance_duration=45, deadline=500, priority=7,
            dependencies=["TMS001"],
        ),
        MaintenanceBlock(
            job_id="SM001", block_id="SEC-1", maintenance_duration=30, deadline=500, priority=6,
            dependencies=["TD001"],
        ),
    ]

    dependency_result = replan_schedule(dependency_blocks, [])
    print_schedule("Dependency chain: TMS001 -> TD001 -> SM001 (all on SEC-1)", dependency_result)

    # -----------------------------------------------------------------
    # 6. Cross-department BUNDLING demo. Three jobs from different
    #    departments (TMS, TD, SM), all on SEC-1, all only allowed to
    #    start at 02:00 (minute 120) or later, forming the same
    #    TMS001 -> TD001 -> SM001 order as before. There's an available
    #    possession window for SEC-1 that they *might* all fit into.
    # -----------------------------------------------------------------
    bundling_blocks = [
        MaintenanceBlock(
            job_id="TMS001", block_id="SEC-1", maintenance_duration=60, deadline=500,
            priority=5, earliest_start=120, department="TMS",
        ),
        MaintenanceBlock(
            job_id="TD001", block_id="SEC-1", maintenance_duration=45, deadline=500,
            priority=7, earliest_start=120, dependencies=["TMS001"], department="TD",
        ),
        MaintenanceBlock(
            job_id="SM001", block_id="SEC-1", maintenance_duration=30, deadline=500,
            priority=6, earliest_start=120, dependencies=["TD001"], department="SM",
        ),
    ]
    # Combined duration: 60 + 45 + 30 = 135 minutes.

    # Case A: a GENEROUS window (02:00-04:40, 160 minutes) -- easily wide
    # enough for all 135 minutes of work. Expect every job's
    # 'within_available_window' to come back True.
    wide_window = [AvailableBlockWindow(block_id="SEC-1", window_start=120, window_end=280)]
    bundled_result = replan_schedule(bundling_blocks, [], available_windows=wide_window)
    print_schedule("Bundling case A: window 02:00-04:40 (fits all 3 jobs)", bundled_result)

    # Case B: the TIGHT window from the original ask (02:00-04:00, only
    # 120 minutes) -- NOT quite enough for 135 minutes of work. Expect the
    # optimizer to still produce a FEASIBLE schedule (using the same
    # dependency order as always), just with at least one job reporting
    # 'within_available_window': False instead of the model failing.
    tight_window = [AvailableBlockWindow(block_id="SEC-1", window_start=120, window_end=240)]
    partial_result = replan_schedule(bundling_blocks, [], available_windows=tight_window)
    print_schedule(
        "Bundling case B: window 02:00-04:00 (too tight for all 3 -- must NOT fail)",
        partial_result,
    )

    # -----------------------------------------------------------------
    # 7. REVERSE PLANNING demo.
    #
    # Section "SEC-RP" has three train movements:
    #   T1: 00:00-00:30   T2: 01:10-01:40   T3: 04:10-04:40
    #
    # That creates two train-free gaps BEFORE the trailing horizon gap:
    #   Gap 1: 00:30-01:10 (40 min) -- too short for a 60-min minimum gap,
    #          so it must NOT become a Reverse Planning window.
    #   Gap 2: 01:40-04:10 (150 min) -- long enough, so it DOES become a
    #          Reverse Planning window.
    #   Trailing gap: 04:40 to the end of the horizon -- also long
    #          enough, so it's a second Reverse Planning window.
    #
    # The maintenance job is only 20 minutes long (so it fits inside
    # gap 1 just as easily as inside a Reverse Planning window) and its
    # priority is 0 (so tier (b) of the objective -- "finish
    # higher-priority jobs earlier" -- has literally nothing to say
    # about it, and can't override tier (d)). All trains are hard
    # (can_be_affected=False), so ANY overlap with a train is simply
    # infeasible, and tier (a) is 0 no matter where the job lands.
    # That isolates the Reverse Planning preference: with everything
    # else tied, the optimizer should place the job inside a Reverse
    # Planning window rather than in the short, non-qualifying gap.
    # -----------------------------------------------------------------
    rp_trains = [
        Train(train_id="RP-T1", block_id="SEC-RP", arrival=0, departure=30, priority=5, can_be_affected=False),
        Train(train_id="RP-T2", block_id="SEC-RP", arrival=70, departure=100, priority=5, can_be_affected=False),
        Train(train_id="RP-T3", block_id="SEC-RP", arrival=250, departure=280, priority=5, can_be_affected=False),
    ]
    rp_blocks = [
        MaintenanceBlock(
            job_id="RP-JOB-1", block_id="SEC-RP", maintenance_duration=20, deadline=400, priority=0,
        ),
    ]

    rp_horizon = 400
    rp_windows = compute_reverse_planning_windows(
        rp_trains, block_ids={"SEC-RP"}, horizon=rp_horizon, min_gap_minutes=60,
    )
    print("\n--- Reverse Planning windows found on SEC-RP (min gap = 60 min) ---")
    for w in rp_windows:
        print(f"  {w.block_id}: {minutes_to_hhmm(w.window_start)} - {minutes_to_hhmm(w.window_end)}")
    print("  (the 00:30-01:10 gap is only 40 min, so it correctly does NOT appear above)")

    rp_result = replan_schedule(rp_blocks, rp_trains, horizon=rp_horizon)
    print_schedule("Reverse Planning: job preferentially placed inside a qualifying gap", rp_result)
    placed_job = rp_result["blocks"][0]
    print(
        f"  RP-JOB-1 scheduled {placed_job['start_time']}-{placed_job['end_time']}, "
        f"within_reverse_planning_window={placed_job['within_reverse_planning_window']}"
    )

    # Sanity check: with Reverse Planning disabled, the feature has zero
    # effect on feasibility -- the job is still scheduled somewhere valid.
    rp_disabled_result = replan_schedule(
        rp_blocks, rp_trains, horizon=rp_horizon, enable_reverse_planning=False,
    )
    print_schedule("Same scenario with Reverse Planning DISABLED (still feasible)", rp_disabled_result)