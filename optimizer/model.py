"""
model.py
--------
Plain data classes describing the inputs to the optimizer.

These are intentionally simple (no OR-Tools code here) so the same
MaintenanceBlock / Train objects can later be reused by a simulator,
an API layer, or a database loader without any changes.
"""

from dataclasses import dataclass


@dataclass
class MaintenanceBlock:
    """
    A maintenance activity that needs to be scheduled on a railway block
    (track section).

    `block_id` identifies WHICH railway section this maintenance happens on.
    It does not need to be unique across MaintenanceBlock instances -- several
    maintenance jobs can be queued for the same section (see
    add_no_overlap_between_maintenance_blocks in constraints.py, which makes
    sure jobs on the same section never overlap in time).
    """

    block_id: str
    maintenance_duration: int  # in minutes
    deadline: int              # maintenance must be FINISHED by this time (minutes from start of day)


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