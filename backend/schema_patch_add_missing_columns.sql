-- Patch legacy schema to match current Django models used by API endpoints.
-- Safe to run multiple times.

BEGIN;

-- devices.device_type enum additions (legacy DBs may only include core values)
ALTER TYPE device_type_enum ADD VALUE IF NOT EXISTS 'blood_pressure';
ALTER TYPE device_type_enum ADD VALUE IF NOT EXISTS 'sleep';
ALTER TYPE device_type_enum ADD VALUE IF NOT EXISTS 'smart_watch';

-- devices table additions
ALTER TABLE devices ADD COLUMN IF NOT EXISTS label VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS brand VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'offline';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_synced TIMESTAMPTZ NULL;

-- readings_draft table additions
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS heart_ecg JSONB NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS heart_afib BOOLEAN NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS heart_hrv_ms NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS heart_rr_interval_ms NUMERIC(10,2) NULL;

ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_device_id INTEGER NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_systolic NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_diastolic NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_mean NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_pulse_pressure NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_irregular BOOLEAN NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS bp_body_position VARCHAR(50) NULL;

ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS glucose_trend VARCHAR(50) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS glucose_hba1c NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS glucose_fasting BOOLEAN NULL;

ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS basal_calories NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS total_calories NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS metabolic_equivalent NUMERIC(10,2) NULL;

ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS daily_steps NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS step_distance_km NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS walking_pace NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS cadence NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS floors_climbed NUMERIC(10,2) NULL;

ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS vo2_max NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS respiration_rate NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS oxygen_variability NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS sleep_stage VARCHAR(50) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS sleep_duration_minutes NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS sleep_score NUMERIC(10,2) NULL;

ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS body_temperature NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS skin_temperature NUMERIC(10,2) NULL;
ALTER TABLE readings_draft ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMIT;
