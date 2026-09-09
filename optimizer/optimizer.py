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
  - The objective has two parts, combined so disruption always matters more
    than maintenance priority (see _build_objective for details):
      1. Train disruption cost (unchanged from before) -- this is still the
         main thing we minimize.
      2. A small tie-breaking term that prefers finishing higher-priority
         maintenance blocks earlier, but ONLY when it doesn't cost any
         extra train disruption to do so.
"""

from collections import defaultdict
from dataclasses import replace

from ortools.sat.python import cp_model

from .model import MaintenanceBlock, Train
from .constraints import (
    add_time_bounds,
    add_hard_no_overlap_constraints,
    add_soft_overlap_vars,
    add_no_overlap_between_maintenance_blocks,
)


def minutes_to_hhmm(total_minutes: int) -> str:
    """Convert minutes-from-start-of-day into a human-readable HH:MM string."""
    hours = (total_minutes // 60) % 24
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


class MaintenanceOptimizer:
    def __init__(self, blocks: list[MaintenanceBlock], trains: list[Train], horizon: int = None):
        self.blocks = blocks
        self.trains = trains

        # Horizon = latest point in time we ever need to reason about.
        if horizon is None:
            latest_deadline = max((b.deadline for b in blocks), default=0)
            latest_departure = max((t.departure for t in trains), default=0)
            horizon = max(latest_deadline, latest_departure)
        self.horizon = horizon

        self.model = cp_model.CpModel()

        # Per-block decision variables, kept in lists indexed by position
        # (NOT by block_id, since several blocks can share the same
        # block_id when they're queued on the same railway section).
        self.block_starts = []
        self.block_ends = []
        self.block_intervals = []

        # overlap_info[i] = list of (Train, overlap_boolvar) for blocks[i]
        self.overlap_info = []

    def build(self):
        model = self.model

        # 1. Create variables + basic timing constraints for every block.
        for i, block in enumerate(self.blocks):
            start = model.NewIntVar(0, self.horizon, f"start_{i}_{block.block_id}")
            end = model.NewIntVar(0, self.horizon, f"end_{i}_{block.block_id}")
            interval = model.NewIntervalVar(
                start, block.maintenance_duration, end, f"interval_{i}_{block.block_id}"
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

        # 4. Objective (see _build_objective for the full explanation).
        self._build_objective(all_overlap_terms)

    def _build_objective(self, all_overlap_terms):
        """
        Build a single objective expression that:
          (a) minimizes train disruption FIRST, and
          (b) among schedules that disrupt trains equally, prefers finishing
              higher-priority maintenance blocks earlier.

        How (a) always wins over (b):
        We multiply the disruption cost by a number (`priority_weight`) that
        is guaranteed to be bigger than the biggest possible value of the
        scheduling term (b) could ever reach. That way, the solver can never
        "trade" one extra unit of train disruption for a better maintenance
        schedule -- it will only use the scheduling term to choose between
        schedules that already have the same, lowest possible disruption.
        This is a standard trick called lexicographic weighting.
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

        model.Minimize(disruption_cost * priority_weight + scheduling_cost)

    def solve(self, max_time_in_seconds: float = 10.0) -> dict:
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

            block_results.append(
                {
                    "block_index": i,
                    "block_id": block.block_id,
                    "priority": block.priority,
                    "start_minutes": start_min,
                    "end_minutes": end_min,
                    "start_time": minutes_to_hhmm(start_min),
                    "end_time": minutes_to_hhmm(end_min),
                    "disrupted_trains": disrupted_trains,
                    "disruption_cost": block_cost,
                }
            )

        return {
            "status": solver.StatusName(status),
            "feasible": True,
            "blocks": block_results,
            "total_disruption_cost": total_disruption_cost,
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


def replan_schedule(blocks, trains, horizon=None, max_time_in_seconds=10.0):
    """
    Dynamic replanning, MVP version.

    The idea behind "dynamic replanning" is simple: something in the real
    world changed (a train got delayed, added, or cancelled), so we take the
    LATEST maintenance jobs and the LATEST train information and run the
    optimizer again, from scratch, to get an up-to-date schedule.

    This function does NOT add any new optimization logic of its own -- it
    just builds a normal MaintenanceOptimizer with whatever `blocks` and
    `trains` it's given, and solves it. Every existing rule (priority,
    time windows, hard/soft train constraints, same-section non-overlap,
    deadlines) is still fully enforced, because underneath it's the exact
    same model being built and solved as before.

    Think of it as: "run the planner again, but with today's information."
    """
    optimizer = MaintenanceOptimizer(blocks, trains, horizon=horizon)
    return optimizer.solve(max_time_in_seconds=max_time_in_seconds)



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
        MaintenanceBlock(block_id="SEC-1", maintenance_duration=60, deadline=300, priority=1),
        # This job must start at 100 or later, and is high priority (9) --
        # watch it move to an earlier slot once the train's delay opens one up.
        MaintenanceBlock(block_id="SEC-1", maintenance_duration=45, deadline=300, priority=9, earliest_start=100),
        # Independent section -- included to show it is unaffected by what
        # happens on SEC-1 below.
        MaintenanceBlock(
            block_id="SEC-2", maintenance_duration=90, deadline=400, priority=5,
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