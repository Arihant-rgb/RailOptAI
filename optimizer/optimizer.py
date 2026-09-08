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
  - All soft-conflict costs (from every block) are summed into one shared
    objective and minimized together.
"""

from collections import defaultdict

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
                model, start, end, block.maintenance_duration, block.deadline, self.horizon
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

        # 4. Objective: minimize total disruption across ALL blocks combined.
        if all_overlap_terms:
            disruption_cost = sum(overlap * train.priority for train, overlap in all_overlap_terms)
            model.Minimize(disruption_cost)

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


if __name__ == "__main__":
    # Minimal demo / smoke test -- not part of the module's public API.
    blocks = [
        MaintenanceBlock(block_id="SEC-1", maintenance_duration=60, deadline=300),
        MaintenanceBlock(block_id="SEC-1", maintenance_duration=45, deadline=300),  # same section, 2nd job
        MaintenanceBlock(block_id="SEC-2", maintenance_duration=90, deadline=400),
    ]

    trains = [
        Train(train_id="EXP-101", block_id="SEC-1", arrival=0, departure=50, priority=10, can_be_affected=False),
        Train(train_id="PASS-202", block_id="SEC-1", arrival=200, departure=260, priority=5),
        Train(train_id="LOCAL-303", block_id="SEC-2", arrival=100, departure=160, priority=2),
    ]

    result = MaintenanceOptimizer(blocks, trains).solve()
    for r in result["blocks"]:
        print(r)
    print("Total disruption cost:", result.get("total_disruption_cost"))