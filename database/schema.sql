-- RailOptAI schema (blueprint section 11), aligned to the generated dataset

CREATE TABLE stations (
    station_id      TEXT PRIMARY KEY,
    station_code    TEXT NOT NULL,
    station_name    TEXT NOT NULL,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    zone            TEXT
);

CREATE TABLE sections (
    section_id                  TEXT PRIMARY KEY,
    from_station                TEXT REFERENCES stations(station_id),
    to_station                  TEXT REFERENCES stations(station_id),
    distance_km                 NUMERIC,
    electrified                 BOOLEAN,
    observed_train_traversals   INTEGER
);

CREATE TABLE trains (
    train_id      TEXT PRIMARY KEY,
    train_name    TEXT,
    train_type    TEXT,
    zone          TEXT,
    from_station  TEXT,
    to_station    TEXT
);

CREATE TABLE train_movements (
    movement_id     TEXT PRIMARY KEY,
    train_id        TEXT REFERENCES trains(train_id),
    section_id      TEXT REFERENCES sections(section_id),
    date            DATE,
    arrival_time    TIME,
    departure_time  TIME,
    direction       TEXT
);

CREATE TABLE maintenance_jobs (
    id                     SERIAL PRIMARY KEY,
    job_id                 TEXT UNIQUE NOT NULL,
    department             TEXT NOT NULL,       -- TMS | SMMS | TDMS
    section_id             TEXT REFERENCES sections(section_id),
    asset_id               TEXT,
    asset_type             TEXT,
    defect_type            TEXT,
    inspection_date        DATE,
    failure_date           DATE,
    severity               INTEGER,
    overdue_days           INTEGER,
    maintenance_type       TEXT,
    estimated_duration     INTEGER,             -- hours
    power_block_required   BOOLEAN DEFAULT FALSE,
    asset_impact           NUMERIC,
    delay_risk             NUMERIC,
    priority_score         NUMERIC,
    priority               TEXT,
    status                 TEXT DEFAULT 'Pending'
);

CREATE TABLE freight_demand (
    id                       SERIAL PRIMARY KEY,
    date                     DATE,
    section_id               TEXT REFERENCES sections(section_id),
    freight_demand           NUMERIC,
    expected_freight_trains  INTEGER,
    priority                 TEXT
);

CREATE TABLE compatibility_rules (
    id               SERIAL PRIMARY KEY,
    activity_type_1  TEXT,
    activity_type_2  TEXT,
    compatible       BOOLEAN,
    shared_resource  BOOLEAN
);

CREATE TABLE blocks (
    block_id           TEXT PRIMARY KEY,
    section_id         TEXT REFERENCES sections(section_id),
    date               DATE,
    start_time         TIME,
    end_time           TIME,
    duration_minutes   INTEGER,
    status             TEXT DEFAULT 'Available'
);

CREATE TABLE plans (
    plan_id      SERIAL PRIMARY KEY,
    generated_at TIMESTAMP DEFAULT now(),
    start_date   DATE,
    end_date     DATE
);

CREATE TABLE plan_jobs (
    id           SERIAL PRIMARY KEY,
    plan_id      INTEGER REFERENCES plans(plan_id),
    job_id       TEXT REFERENCES maintenance_jobs(job_id),
    block_id     TEXT REFERENCES blocks(block_id)
);
