-- Create password_reset_otp table for forgot password functionality
CREATE TABLE password_reset_otp (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('patient', 'staff')),
    email VARCHAR(254) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_password_reset_otp_email ON password_reset_otp(email);
CREATE INDEX idx_password_reset_otp_created_at ON password_reset_otp(created_at);
