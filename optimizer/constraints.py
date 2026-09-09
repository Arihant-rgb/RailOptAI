"""
constraints.py
---------------
Small, composable functions that add constraints to a CP-SAT model.

Each function takes the `model` plus the relevant variables and does ONE
job. Keeping them separate makes it easy to add more railway rules later
(e.g. crew availability, platform occupancy) without touching existing code.
"""

from ortools.sat.python import cp_model


def add_time_bounds(
    model,
    block_start,
    block_end,
    duration,
    deadline,
    horizon,
    earliest_start=None,
    latest_end=None,
):
    """
    Basic timing rules for a single maintenance block:
      - it starts no earlier than time 0 and no later than the horizon
      - its end is exactly start + duration
      - it must finish by its deadline

    Plus an OPTIONAL allowed time window:
      - if `earliest_start` is given, the block cannot start before it
      - if `latest_end` is given, the block cannot finish after it

    Leaving earliest_start / latest_end as None (the default) skips those
    two constraints entirely, so behavior is unchanged for blocks that
    don't use a time window.
    """
    model.Add(block_start >= 0)
    model.Add(block_start <= horizon)
    model.Add(block_end == block_start + duration)
    model.Add(block_end <= deadline)
    model.Add(block_end <= horizon)

    if earliest_start is not None:
        model.Add(block_start >= earliest_start)

    if latest_end is not None:
        model.Add(block_end <= latest_end)


def add_hard_no_overlap_constraints(model, block_start, block_end, block_id, trains):
    """
    For every train that is on the SAME railway block (train.block_id ==
    block_id) and CANNOT be affected, force the maintenance block to be
    entirely before or entirely after that train's occupation window
    [arrival, departure).

    Trains on a different railway block are ignored -- maintenance on one
    section of track cannot conflict with a train running on another.

    This is a hard constraint: if it's impossible to satisfy for every such
    train, the model will simply be infeasible.
    """
    relevant_trains = [
        t for t in trains if t.block_id == block_id and not t.can_be_affected
    ]

    for train in relevant_trains:
        before = model.NewBoolVar(f"hard_before_{block_id}_{train.train_id}")
        after = model.NewBoolVar(f"hard_after_{block_id}_{train.train_id}")

        model.Add(block_end <= train.arrival).OnlyEnforceIf(before)
        model.Add(block_start >= train.departure).OnlyEnforceIf(after)

        # Exactly one of "finishes before this train arrives" /
        # "starts after this train departs" must hold.
        model.AddBoolOr([before, after])


def add_soft_overlap_vars(model, block_start, block_end, block_id, trains):
    """
    For every train that is on the SAME railway block and CAN be affected,
    create a boolean variable that is TRUE exactly when the maintenance
    block overlaps that train's window.

    Trains on a different railway block are ignored, same as above.

    Returns a list of (train, overlap_var) pairs so the caller can build a
    priority-weighted objective and/or report which trains got disrupted.
    """
    relevant_trains = [
        t for t in trains if t.block_id == block_id and t.can_be_affected
    ]

    overlap_info = []

    for train in relevant_trains:
        before = model.NewBoolVar(f"soft_before_{block_id}_{train.train_id}")
        after = model.NewBoolVar(f"soft_after_{block_id}_{train.train_id}")

        # Fully reify "before"/"after" in both directions so they can be
        # trusted inside an objective expression, not just as a one-way hint.
        model.Add(block_end <= train.arrival).OnlyEnforceIf(before)
        model.Add(block_end > train.arrival).OnlyEnforceIf(before.Not())

        model.Add(block_start >= train.departure).OnlyEnforceIf(after)
        model.Add(block_start < train.departure).OnlyEnforceIf(after.Not())

        no_overlap = model.NewBoolVar(f"no_overlap_{block_id}_{train.train_id}")
        # no_overlap == OR(before, after), fully reified.
        model.AddMaxEquality(no_overlap, [before, after])

        overlap = model.NewBoolVar(f"overlap_{block_id}_{train.train_id}")
        model.Add(overlap == 1 - no_overlap)

        overlap_info.append((train, overlap))

    return overlap_info


def add_no_overlap_between_maintenance_blocks(model, interval_vars):
    """
    Prevent maintenance blocks that share the same railway block (section)
    from overlapping each other in time -- only one maintenance activity can
    occupy a given section at a time.

    `interval_vars` should be the list of CP-SAT IntervalVar objects for
    every maintenance block that sits on the same railway block. Blocks on
    different railway blocks are independent and should be passed in
    separate calls (or not at all, if there's only one per section).
    """
    if len(interval_vars) > 1:
        model.AddNoOverlap(interval_vars)