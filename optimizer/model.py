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
    """A maintenance activity that needs to be scheduled on a track/section."""
 
    block_id: str
    maintenance_duration: int  # duration in minutes 
    deadline: int              # deadline in minutes from start of day
 
 
@dataclass
class Train:
    """A train that occupies a railway block during [arrival, departure)."""

    train_id: str
    block_id: str
    arrival: int       # minutes from start of day
    departure: int     # minutes from start of day
    priority: int      # higher number = more important             # higher number = more important / less tolerant of disruption
 
    # False  -> HARD constraint: maintenance must NEVER overlap this train
    #           (e.g. a scheduled express, a train already in the section)
    # True   -> SOFT constraint: overlap is allowed but penalized by `priority`
    #           in the objective (default, since most trains can in principle
    #           be delayed/rerouted if there's no other option)
    can_be_affected: bool = True
 