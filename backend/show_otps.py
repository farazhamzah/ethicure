#!/usr/bin/env python3
import psycopg2
import sys

try:
    conn = psycopg2.connect(
        host="127.0.0.1",
        database="health_app",
        user="health_admin",
        password="StrongPass123"
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT email, otp_code, expires_at, is_used 
        FROM password_reset_otp 
        ORDER BY created_at DESC 
        LIMIT 5
    """)
    results = cur.fetchall()
    
    print("\n" + "="*70)
    print("  RECENT OTP CODES FOR TESTING")
    print("="*70)
    
    if not results:
        print("\nNo OTP codes found in database.")
    else:
        for i, row in enumerate(results, 1):
            print(f"\n[{i}]")
            print(f"  Email:      {row[0]}")
            print(f"  OTP Code:   {row[1]}")
            print(f"  Expires:    {row[2]}")
            print(f"  Used:       {'Yes' if row[3] else 'No'}")
    
    print("\n" + "="*70 + "\n")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
