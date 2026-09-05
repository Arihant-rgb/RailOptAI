-- RailOptAI Seed Data

INSERT INTO stations (station_id, station_code, station_name, latitude, longitude) VALUES
('ST01', 'A01', 'Station A', 12.9716, 77.5946),
('ST02', 'B01', 'Station B', 13.0200, 77.6000),
('ST03', 'C01', 'Station C', 13.0700, 77.6100),
('ST04', 'D01', 'Station D', 13.1200, 77.6300),
('ST05', 'E01', 'Station E', 13.1800, 77.6500)
ON CONFLICT (station_id) DO NOTHING;

INSERT INTO sections (section_id, from_station, to_station, distance_km, electrified) VALUES
('S01', 'ST01', 'ST02', 8.5, true),
('S02', 'ST02', 'ST03', 12.2, true),
('S03', 'ST03', 'ST04', 9.8, true),
('S04', 'ST04', 'ST05', 15.0, false)
ON CONFLICT (section_id) DO NOTHING;

INSERT INTO trains (train_id, train_name, train_type) VALUES
('T001', 'Express A', 'Express'),
('T002', 'Passenger B', 'Passenger'),
('T003', 'Superfast C', 'Superfast'),
('T004', 'Freight D', 'Freight')
ON CONFLICT (train_id) DO NOTHING;

INSERT INTO train_movements (movement_id, train_id, section_id, date, arrival_time, departure_time, direction) VALUES
('M001', 'T001', 'S01', '2026-09-05', '09:10', '09:12', 'UP'),
('M002', 'T001', 'S02', '2026-09-05', '09:30', '09:32', 'UP'),
('M003', 'T002', 'S01', '2026-09-05', '10:00', '10:02', 'DOWN'),
('M004', 'T003', 'S03', '2026-09-05', '11:15', '11:18', 'UP')
ON CONFLICT (movement_id) DO NOTHING;

INSERT INTO maintenance_jobs (job_id, department, section_id, asset_id, asset_type, defect_type, maintenance_type, severity, overdue_days, estimated_duration, power_block_required, asset_impact, delay_risk, priority_score, priority, status) VALUES
('TMS001', 'TMS', 'S01', 'TRK101', 'Track', 'Rail Crack', 'Corrective', 5, 7, 2, false, 90, 85, 91, 'Critical', 'Pending'),
('TMS002', 'TMS', 'S03', 'TRK203', 'Track', 'Sleeper Damage', 'Preventive', 3, 2, 3, false, 50, 40, 58, 'Medium', 'Pending'),
('SM001', 'SMMS', 'S01', 'SIG101', 'Signal', 'Signal Failure', 'Corrective', 5, 4, 1, false, 90, 85, 82, 'Critical', 'Pending'),
('SM002', 'SMMS', 'S04', 'SIG204', 'Point Machine', 'Motor Issue', 'Corrective', 4, 3, 2, false, 75, 70, 76, 'High', 'Pending'),
('TD001', 'TDMS', 'S01', 'OHE101', 'OHE', 'Wire Defect', 'Corrective', 5, 6, 2, true, 90, 85, 87, 'Critical', 'Pending'),
('TD002', 'TDMS', 'S03', 'OHE203', 'OHE', 'Insulator Issue', 'Preventive', 3, 2, 1, true, 50, 45, 52, 'Medium', 'Pending')
ON CONFLICT (job_id) DO NOTHING;

INSERT INTO blocks (block_id, section_id, date, start_time, end_time, duration_minutes, status) VALUES
('B001', 'S01', '2026-09-05', '02:00', '04:00', 120, 'Available'),
('B002', 'S02', '2026-09-05', '01:20', '03:00', 100, 'Available'),
('B003', 'S03', '2026-09-05', '03:30', '06:00', 150, 'Available')
ON CONFLICT (block_id) DO NOTHING;

INSERT INTO planned_jobs (job_id, block_id, section_id, start_time, end_time, priority, department) VALUES
('TMS001', 'B001', 'S01', '02:00', '04:00', 'Critical', 'TMS'),
('SM001', 'B001', 'S01', '02:00', '03:00', 'Critical', 'SMMS'),
('TD001', 'B001', 'S01', '02:00', '04:00', 'Critical', 'TDMS');

INSERT INTO kpis (total_jobs, critical_jobs, scheduled_jobs, available_blocks, schedule_conflicts, block_utilization, cross_department_bundles) VALUES
(30, 8, 22, 15, 0, 78, 4);
