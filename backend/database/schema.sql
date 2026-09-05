-- RailOptAI PostgreSQL Schema

DROP TABLE IF EXISTS planned_jobs CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS maintenance_jobs CASCADE;
DROP TABLE IF EXISTS train_movements CASCADE;
DROP TABLE IF EXISTS trains CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS kpis CASCADE;

CREATE TABLE stations (
    station_id VARCHAR(50) PRIMARY KEY,
    station_code VARCHAR(20) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6)
);

CREATE TABLE sections (
    section_id VARCHAR(50) PRIMARY KEY,
    from_station VARCHAR(50) REFERENCES stations(station_id),
    to_station VARCHAR(50) REFERENCES stations(station_id),
    distance_km NUMERIC(5,2) NOT NULL,
    electrified BOOLEAN DEFAULT TRUE
);

CREATE TABLE trains (
    train_id VARCHAR(50) PRIMARY KEY,
    train_name VARCHAR(100) NOT NULL,
    train_type VARCHAR(50) NOT NULL
);

CREATE TABLE train_movements (
    movement_id VARCHAR(50) PRIMARY KEY,
    train_id VARCHAR(50) REFERENCES trains(train_id),
    section_id VARCHAR(50) REFERENCES sections(section_id),
    date DATE NOT NULL,
    arrival_time VARCHAR(10) NOT NULL,
    departure_time VARCHAR(10) NOT NULL,
    direction VARCHAR(10) NOT NULL
);

CREATE TABLE maintenance_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    department VARCHAR(20) NOT NULL, -- TMS, SMMS, TDMS
    section_id VARCHAR(50) REFERENCES sections(section_id),
    asset_id VARCHAR(50) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    defect_type VARCHAR(100) NOT NULL,
    maintenance_type VARCHAR(50) NOT NULL,
    severity INT NOT NULL,
    overdue_days INT NOT NULL,
    estimated_duration NUMERIC(4,2) NOT NULL,
    power_block_required BOOLEAN DEFAULT FALSE,
    asset_impact NUMERIC(5,2) DEFAULT 50,
    delay_risk NUMERIC(5,2) DEFAULT 50,
    priority_score NUMERIC(5,2) DEFAULT 0,
    priority VARCHAR(20) NOT NULL, -- Critical, High, Medium, Low
    status VARCHAR(30) DEFAULT 'Pending'
);

CREATE TABLE blocks (
    block_id VARCHAR(50) PRIMARY KEY,
    section_id VARCHAR(50) REFERENCES sections(section_id),
    date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    duration_minutes INT NOT NULL,
    status VARCHAR(30) DEFAULT 'Available'
);

CREATE TABLE planned_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(50) REFERENCES maintenance_jobs(job_id),
    block_id VARCHAR(50) REFERENCES blocks(block_id),
    section_id VARCHAR(50) REFERENCES sections(section_id),
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    department VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kpis (
    id SERIAL PRIMARY KEY,
    total_jobs INT NOT NULL,
    critical_jobs INT NOT NULL,
    scheduled_jobs INT NOT NULL,
    available_blocks INT NOT NULL,
    schedule_conflicts INT NOT NULL,
    block_utilization INT NOT NULL,
    cross_department_bundles INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
