"""
model.py
--------
Plain data classes describing the inputs to the optimizer.

These are intentionally simple (no OR-Tools code here) so the same
MaintenanceBlock / Train objects can later be reused by a simulator,
an API layer, or a database loader without any changes.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class MaintenanceBlock:
    """
    A maintenance activity that needs to be scheduled on a railway block
    (track section).

    `job_id` is the UNIQUE identifier of this specific maintenance job
    (e.g. "TMS001"). It must not be reused by any other MaintenanceBlock.
    This is what dependencies point at.

    `block_id` identifies WHICH railway section this maintenance happens on
    (e.g. "SEC-1"). Unlike `job_id`, it does NOT need to be unique --
    several different maintenance jobs can all happen on the same section
    (see add_no_overlap_between_maintenance_blocks in constraints.py, which
    makes sure jobs on the same section never overlap in time). `block_id`
    is also what trains are matched against: a train only ever conflicts
    with maintenance that shares its `block_id`.

    `priority` says how URGENT this maintenance job is. A higher number
    means the optimizer will try harder to schedule it earlier -- but only
    as a tie-breaker: avoiding train disruption always comes first (see
    optimizer.py for exactly how the two are combined).

    `earliest_start` / `latest_end` are an OPTIONAL allowed time window for
    this specific maintenance job (e.g. "only allowed to happen overnight,
    between 22:00 and 05:00"). Leave them as None if the job has no such
    restriction -- the block will then only be limited by its duration and
    deadline, exactly as before this feature was added.

    `dependencies` is an OPTIONAL list of other jobs' `job_id`s that must be
    FINISHED before this job is allowed to start (e.g. a track inspection
    must finish before track maintenance can begin). Leave it as None (or
    an empty list) if this job has no ordering requirement. Dependencies
    always refer to `job_id`, never `block_id` -- `block_id` can be shared
    by several jobs, so it can't be used to point at one specific job.
    """

    job_id: str                # unique identifier of THIS maintenance job
    block_id: str               # railway section this job happens on (can repeat)
    maintenance_duration: int  # in minutes
    deadline: int              # maintenance must be FINISHED by this time (minutes from start of day)
    priority: int = 1          # higher = more urgent to schedule early (default = neutral priority)
    earliest_start: Optional[int] = None  # maintenance cannot START before this time, if set
    latest_end: Optional[int] = None      # maintenance cannot FINISH after this time, if set
    dependencies: Optional[List[str]] = None  # job_ids that must finish before this one can start


@dataclass
class Train:
    """A train that occupies a railway block during [arrival, departure)."""

    train_id: str
    block_id: str              # which railway section this train occupies
    arrival: int
    departure: int
    priority: int              # higher number = more important / less tolerant of disruption

    # False  -> HARD constraint: maintenance on the SAME block_id must NEVER
    #           overlap this train (e.g. a scheduled express).
    # True   -> SOFT constraint: overlap is allowed but penalized by
    #           `priority` in the objective (default).
    can_be_affected: bool = True