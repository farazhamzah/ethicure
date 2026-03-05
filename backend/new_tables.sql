-- New tables for Ethicare
-- Run this SQL to create the additional tables needed

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    metric_type VARCHAR(20) NOT NULL,
    target_value DECIMAL(10, 2) NOT NULL,
    current_value DECIMAL(10, 2),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Thresholds table
CREATE TABLE IF NOT EXISTS thresholds (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    metric_type VARCHAR(20) NOT NULL,
    condition VARCHAR(10) NOT NULL,  -- 'above', 'below', 'equal'
    value DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    threshold_id INTEGER REFERENCES thresholds(id) ON DELETE SET NULL,
    reading_id INTEGER REFERENCES readings(id) ON DELETE SET NULL,
    metric_type VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(10) DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
    is_read BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    notification_type VARCHAR(20) NOT NULL,  -- 'alert', 'reminder', 'info', 'report'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    generated_by_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    report_type VARCHAR(20) NOT NULL,  -- 'daily', 'weekly', 'monthly', 'custom'
    title VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_goals_patient ON goals(patient_id);
CREATE INDEX IF NOT EXISTS idx_thresholds_patient ON thresholds(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_staff ON notifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
