"""
constraints.py
---------------
Small, composable functions that add constraints to a CP-SAT model.

Each function takes the `model` plus the relevant variables and does ONE
job. Keeping them separate (rather than one big function in optimizer.py)
is what makes it easy to add more railway rules later (e.g. minimum gap
between maintenance blocks, crew availability, platform occupancy) without
touching existing code.
"""

from ortools.sat.python import cp_model


def add_time_bounds(model, block_start, block_end, duration, deadline, horizon):
    """
    Basic timing rules for a single maintenance block:
      - it starts no earlier than time 0 and no later than the horizon
      - its end is exactly start + duration
      - it must finish by its deadline
    """
    model.Add(block_start >= 0)
    model.Add(block_start <= horizon)
    model.Add(block_end == block_start + duration)
    model.Add(block_end <= deadline)
    model.Add(block_end <= horizon)


def add_hard_no_overlap_constraints(
    model,
    block_start,
    block_end,
    trains,
    maintenance_block_id,
):
    """
    For every train that CANNOT be affected (train.can_be_affected == False),
    force the maintenance block to be entirely before or entirely after that
    train's occupation window [arrival, departure).

    This is a hard constraint: the solver is not allowed to violate it under
    any circumstances. If it's impossible to satisfy for every such train,
    the model will simply be infeasible.
    """
    for train in trains:
        if train.can_be_affected or train.block_id != maintenance_block_id:
            continue

        before = model.NewBoolVar(f"hard_before_{train.train_id}")
        after = model.NewBoolVar(f"hard_after_{train.train_id}")

        model.Add(block_end <= train.arrival).OnlyEnforceIf(before)
        model.Add(block_start >= train.departure).OnlyEnforceIf(after)

        # Exactly one of "finishes before this train arrives" /
        # "starts after this train departs" must hold.
        model.AddBoolOr([before, after])


def add_soft_overlap_vars(
    model,
    block_start,
    block_end,
    trains,
    maintenance_block_id,
):
    """
    For every train that CAN be affected, create a boolean variable that is
    TRUE exactly when the maintenance block overlaps that train's window.

    Returns a list of (train, overlap_var) pairs so the caller can build a
    priority-weighted objective and/or report which trains got disrupted.
    """
    overlap_info = []

    for train in trains:
        if not train.can_be_affected or train.block_id != maintenance_block_id:
            continue

        before = model.NewBoolVar(f"soft_before_{train.train_id}")
        after = model.NewBoolVar(f"soft_after_{train.train_id}")

        # Fully reify "before"/"after" in both directions so they can be
        # trusted inside an objective expression, not just as a one-way hint.
        model.Add(block_end <= train.arrival).OnlyEnforceIf(before)
        model.Add(block_end > train.arrival).OnlyEnforceIf(before.Not())

        model.Add(block_start >= train.departure).OnlyEnforceIf(after)
        model.Add(block_start < train.departure).OnlyEnforceIf(after.Not())

        no_overlap = model.NewBoolVar(f"no_overlap_{train.train_id}")
        # no_overlap == OR(before, after), fully reified.
        model.AddMaxEquality(no_overlap, [before, after])

        overlap = model.NewBoolVar(f"overlap_{train.train_id}")
        model.Add(overlap == 1 - no_overlap)

        overlap_info.append((train, overlap))

    return overlap_info