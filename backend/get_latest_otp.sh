#!/bin/bash
# Script to view the latest OTP for testing forgot password feature
# Usage: ./get_latest_otp.sh [email]

EMAIL=${1:-}

if [ -z "$EMAIL" ]; then
    echo "Getting latest OTP for any email:"
    PGPASSWORD=StrongPass123 psql -h 127.0.0.1 -U health_admin -d health_app -c \
        "SELECT email, otp_code, expires_at, is_used FROM password_reset_otp ORDER BY created_at DESC LIMIT 1;" 2>&1 | head -20
else
    echo "Getting latest OTP for $EMAIL:"
    PGPASSWORD=StrongPass123 psql -h 127.0.0.1 -U health_admin -d health_app -c \
        "SELECT email, otp_code, expires_at, is_used FROM password_reset_otp WHERE email='$EMAIL' ORDER BY created_at DESC LIMIT 1;" 2>&1 | head -20
fi
