"""
optimizer.py
------------
CP-SAT based scheduler for a single maintenance block against a list of
trains. Kept intentionally small: it just wires together the variables
and the constraint helpers from constraints.py.

Design choice for the MVP: one MaintenanceBlock per solve() call. This
keeps the model easy to reason about for now; scheduling many blocks
together (with block-vs-block conflicts) is a natural next step once this
is working, and can be added without changing this file's overall shape.
"""

from ortools.sat.python import cp_model

from .model import MaintenanceBlock, Train
from .constraints import (
    add_time_bounds,
    add_hard_no_overlap_constraints,
    add_soft_overlap_vars,
)

def format_time(minutes):
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"

class MaintenanceOptimizer:
    def __init__(self, block: MaintenanceBlock, trains: list[Train], horizon: int = None):
        self.block = block
        self.trains = trains

        # Horizon = latest point in time we ever need to reason about.
        # Defaults to the later of the block's deadline and the last train's
        # departure, so we never truncate the feasible search space.
        if horizon is None:
            latest_departure = max((t.departure for t in trains), default=0)
            horizon = max(block.deadline, latest_departure)
        self.horizon = horizon

        self.model = cp_model.CpModel()
        self.block_start = None
        self.block_end = None
        self.overlap_info = []  # list of (Train, overlap_boolvar)

    def build(self):
        model = self.model
        block = self.block

        self.block_start = model.NewIntVar(0, self.horizon, "block_start")
        self.block_end = model.NewIntVar(0, self.horizon, "block_end")

        add_time_bounds(
            model,
            self.block_start,
            self.block_end,
            block.maintenance_duration,
            block.deadline,
            self.horizon,
        )
        add_hard_no_overlap_constraints(
            model,
            self.block_start,
            self.block_end,
            self.trains,
            block.block_id,
)
        self.overlap_info =add_soft_overlap_vars(
            model,
            self.block_start,
            self.block_end,
            self.trains,
            block.block_id,
)

        # Objective: minimize total "disruption" = sum of (overlap * priority)
        # over all trains that are allowed to be affected. Higher-priority
        # trains cost more to disrupt, so the solver prefers to avoid them.
        if self.overlap_info:
            disruption_cost = sum(overlap * train.priority for train, overlap in self.overlap_info)
            model.Minimize(disruption_cost)

    def solve(self, max_time_in_seconds: float = 10.0) -> dict:
        self.build()

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_in_seconds
        status = solver.Solve(self.model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {
                "status": solver.StatusName(status),
                "block_id": self.block.block_id,
                "feasible": False,
                "message": "No feasible maintenance window found for the given constraints.",
            }

        disrupted_trains = [
            train.train_id for train, overlap in self.overlap_info if solver.Value(overlap) == 1
        ]

        return {
            "status": solver.StatusName(status),
            "block_id": self.block.block_id,
            "feasible": True,
            "start": format_time(solver.Value(self.block_start)),
            "end": format_time(solver.Value(self.block_end)),
            "disrupted_trains": disrupted_trains,
            "disruption_cost": sum(
                train.priority for train, overlap in self.overlap_info if solver.Value(overlap) == 1
            ),
        }


if __name__ == "__main__":
    # Minimal demo / smoke test — not part of the module's public API.
    demo_block = MaintenanceBlock(block_id="BLK-1", maintenance_duration=60, deadline=300)
    demo_trains = [
       Train(train_id="EXP-101", block_id="BLK-1", arrival=0, departure=50, priority=10, can_be_affected=False),
       Train(train_id="PASS-202", block_id="BLK-1", arrival=80, departure=140, priority=5),
       Train(train_id="LOCAL-303", block_id="BLK-1", arrival=200, departure=260, priority=2),
    ]
    result = MaintenanceOptimizer(demo_block, demo_trains).solve()
    print(result)