#!/bin/bash
# Ethicare API Admin/Doctor Test Suite

BASE_URL="http://127.0.0.1:8000"
PASS=0
FAIL=0

echo "=========================================="
echo "   Ethicare Admin/Doctor Test Suite"
echo "=========================================="
echo ""

# 1. Admin Login
echo "--- Admin Login ---"
ADMIN_LOGIN=$(curl -s -X POST $BASE_URL/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"access":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ]; then
    echo "✅ PASS: Admin login successful"
    ((PASS++))
else
    echo "❌ FAIL: Admin login"
    echo "   Response: $ADMIN_LOGIN"
    ((FAIL++))
fi

# 2. Doctor Login
echo ""
echo "--- Doctor Login ---"
DOCTOR_LOGIN=$(curl -s -X POST $BASE_URL/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"doctor1","password":"Doctor123!"}')

DOCTOR_TOKEN=$(echo $DOCTOR_LOGIN | grep -o '"access":"[^"]*"' | cut -d'"' -f4)

if [ -n "$DOCTOR_TOKEN" ]; then
    echo "✅ PASS: Doctor login successful"
    ((PASS++))
else
    echo "❌ FAIL: Doctor login"
    echo "   Response: $DOCTOR_LOGIN"
    ((FAIL++))
fi

# 3. Admin: List Staff
echo ""
echo "--- Admin: Staff Management ---"
STAFF_LIST=$(curl -s $BASE_URL/api/staff/ \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$STAFF_LIST" | grep -q "username\|first_name"; then
    echo "✅ PASS: Admin can list staff"
    ((PASS++))
else
    echo "❌ FAIL: Admin list staff"
    echo "   Response: $STAFF_LIST"
    ((FAIL++))
fi

# 4. Admin: Create New Staff
TIMESTAMP=$(date +%s)
NEW_STAFF=$(curl -s -X POST $BASE_URL/api/staff/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"first_name\":\"New\",\"last_name\":\"Doctor\",\"email\":\"newdoc${TIMESTAMP}@ethicare.com\",\"username\":\"newdoctor${TIMESTAMP}\",\"password\":\"NewDoc123!\",\"role\":\"doctor\"}")

NEW_STAFF_ID=$(echo $NEW_STAFF | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$NEW_STAFF_ID" ]; then
    echo "✅ PASS: Admin created new staff (ID: $NEW_STAFF_ID)"
    ((PASS++))
else
    echo "❌ FAIL: Admin create staff"
    echo "   Response: $NEW_STAFF"
    ((FAIL++))
fi

# 5. Admin: Get Staff Detail
if [ -n "$NEW_STAFF_ID" ]; then
    STAFF_DETAIL=$(curl -s $BASE_URL/api/staff/$NEW_STAFF_ID/ \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$STAFF_DETAIL" | grep -q "first_name"; then
        echo "✅ PASS: Admin can get staff detail"
        ((PASS++))
    else
        echo "❌ FAIL: Admin get staff detail"
        echo "   Response: $STAFF_DETAIL"
        ((FAIL++))
    fi
fi

# 6. Admin: Update Staff
if [ -n "$NEW_STAFF_ID" ]; then
    UPDATE_STAFF=$(curl -s -X PUT $BASE_URL/api/staff/$NEW_STAFF_ID/ \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"first_name":"Updated"}')
    
    if echo "$UPDATE_STAFF" | grep -q "Updated"; then
        echo "✅ PASS: Admin can update staff"
        ((PASS++))
    else
        echo "❌ FAIL: Admin update staff"
        echo "   Response: $UPDATE_STAFF"
        ((FAIL++))
    fi
fi

# 7. Admin: Deactivate Staff
if [ -n "$NEW_STAFF_ID" ]; then
    DELETE_STAFF=$(curl -s -X DELETE $BASE_URL/api/staff/$NEW_STAFF_ID/ \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$DELETE_STAFF" | grep -q "deactivated"; then
        echo "✅ PASS: Admin can deactivate staff"
        ((PASS++))
    else
        echo "❌ FAIL: Admin deactivate staff"
        echo "   Response: $DELETE_STAFF"
        ((FAIL++))
    fi
fi

# 8. Admin: List All Patients
echo ""
echo "--- Admin: Patient Management ---"
PATIENTS_LIST=$(curl -s $BASE_URL/api/patients/ \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$PATIENTS_LIST" | grep -q "\["; then
    PATIENT_COUNT=$(echo "$PATIENTS_LIST" | grep -o '"id"' | wc -l)
    echo "✅ PASS: Admin can list all patients ($PATIENT_COUNT found)"
    ((PASS++))
else
    echo "❌ FAIL: Admin list patients"
    echo "   Response: $PATIENTS_LIST"
    ((FAIL++))
fi

# 9. Admin: Create Patient
NEW_PATIENT=$(curl -s -X POST $BASE_URL/api/patients/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"first_name\":\"Admin\",\"last_name\":\"Created\",\"email\":\"admincreated${TIMESTAMP}@test.com\",\"username\":\"admincreated${TIMESTAMP}\",\"password\":\"Test123!\",\"gender\":\"female\",\"height\":160,\"weight\":55}")

NEW_PATIENT_ID=$(echo $NEW_PATIENT | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$NEW_PATIENT_ID" ]; then
    echo "✅ PASS: Admin created patient (ID: $NEW_PATIENT_ID)"
    ((PASS++))
else
    echo "❌ FAIL: Admin create patient"
    echo "   Response: $NEW_PATIENT"
    ((FAIL++))
fi

# 10. Admin: Get Patient Detail
if [ -n "$NEW_PATIENT_ID" ]; then
    PATIENT_DETAIL=$(curl -s $BASE_URL/api/patients/$NEW_PATIENT_ID/ \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$PATIENT_DETAIL" | grep -q "first_name"; then
        echo "✅ PASS: Admin can get patient detail"
        ((PASS++))
    else
        echo "❌ FAIL: Admin get patient detail"
        echo "   Response: $PATIENT_DETAIL"
        ((FAIL++))
    fi
fi

# 11. Doctor: List Own Patients
echo ""
echo "--- Doctor: Patient Access ---"

# First assign a patient to doctor1 (staff_id = 2)
PGPASSWORD='StrongPass123' psql -h 127.0.0.1 -U health_admin -d health_app -c "UPDATE patients SET doctor_id = 2 WHERE id = $NEW_PATIENT_ID;" > /dev/null 2>&1

DOCTOR_PATIENTS=$(curl -s $BASE_URL/api/doctor/patients/ \
  -H "Authorization: Bearer $DOCTOR_TOKEN")

if echo "$DOCTOR_PATIENTS" | grep -q "\["; then
    echo "✅ PASS: Doctor can list assigned patients"
    ((PASS++))
else
    echo "❌ FAIL: Doctor list patients"
    echo "   Response: $DOCTOR_PATIENTS"
    ((FAIL++))
fi

# 12. Doctor: Access Assigned Patient Detail
if [ -n "$NEW_PATIENT_ID" ]; then
    DOC_PATIENT_DETAIL=$(curl -s $BASE_URL/api/patients/$NEW_PATIENT_ID/ \
      -H "Authorization: Bearer $DOCTOR_TOKEN")
    
    if echo "$DOC_PATIENT_DETAIL" | grep -q "first_name"; then
        echo "✅ PASS: Doctor can access assigned patient detail"
        ((PASS++))
    else
        echo "❌ FAIL: Doctor access assigned patient"
        echo "   Response: $DOC_PATIENT_DETAIL"
        ((FAIL++))
    fi
fi

# 13. Doctor: View Patient Devices
echo ""
echo "--- Doctor: View Patient Data ---"
DOC_DEVICES=$(curl -s $BASE_URL/api/devices/ \
  -H "Authorization: Bearer $DOCTOR_TOKEN")

if echo "$DOC_DEVICES" | grep -q "\["; then
    echo "✅ PASS: Doctor can view patient devices"
    ((PASS++))
else
    echo "❌ FAIL: Doctor view devices"
    echo "   Response: $DOC_DEVICES"
    ((FAIL++))
fi

# 14. Doctor: View Patient Readings
DOC_READINGS=$(curl -s $BASE_URL/api/readings/ \
  -H "Authorization: Bearer $DOCTOR_TOKEN")

if echo "$DOC_READINGS" | grep -q "\["; then
    echo "✅ PASS: Doctor can view patient readings"
    ((PASS++))
else
    echo "❌ FAIL: Doctor view readings"
    echo "   Response: $DOC_READINGS"
    ((FAIL++))
fi

# 15. Doctor: View Patient Alerts
DOC_ALERTS=$(curl -s $BASE_URL/api/alerts/ \
  -H "Authorization: Bearer $DOCTOR_TOKEN")

if echo "$DOC_ALERTS" | grep -q "\["; then
    echo "✅ PASS: Doctor can view patient alerts"
    ((PASS++))
else
    echo "❌ FAIL: Doctor view alerts"
    echo "   Response: $DOC_ALERTS"
    ((FAIL++))
fi

# 16. Doctor: Generate Report for Patient
echo ""
echo "--- Doctor: Reports ---"
if [ -n "$NEW_PATIENT_ID" ]; then
    DOC_REPORT=$(curl -s -X POST $BASE_URL/api/reports/ \
      -H "Authorization: Bearer $DOCTOR_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"patient\":$NEW_PATIENT_ID,\"report_type\":\"monthly\",\"title\":\"Doctor Monthly Report\",\"start_date\":\"2025-11-21\",\"end_date\":\"2025-12-21\"}")
    
    REPORT_ID=$(echo $DOC_REPORT | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    
    if [ -n "$REPORT_ID" ]; then
        echo "✅ PASS: Doctor can create report for patient"
        ((PASS++))
    else
        echo "❌ FAIL: Doctor create report"
        echo "   Response: $DOC_REPORT"
        ((FAIL++))
    fi
fi

# 17. Authorization: Doctor Cannot Access Admin Endpoints
echo ""
echo "--- Authorization Checks ---"
DOC_STAFF_ACCESS=$(curl -s $BASE_URL/api/staff/ \
  -H "Authorization: Bearer $DOCTOR_TOKEN")

if echo "$DOC_STAFF_ACCESS" | grep -q "permission\|forbidden\|not authorized" || [ "$(echo $DOC_STAFF_ACCESS | grep -c '"id"')" -eq 0 ]; then
    echo "✅ PASS: Doctor cannot access staff management"
    ((PASS++))
else
    echo "❌ FAIL: Doctor should not access staff management"
    echo "   Response: $DOC_STAFF_ACCESS"
    ((FAIL++))
fi

# 18. Authorization: Doctor Cannot Create Staff
DOC_CREATE_STAFF=$(curl -s -X POST $BASE_URL/api/staff/ \
  -H "Authorization: Bearer $DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Hack","last_name":"Attempt","email":"hack@test.com","username":"hacker","password":"Hack123!","role":"admin"}')

if echo "$DOC_CREATE_STAFF" | grep -q "permission\|forbidden\|not authorized"; then
    echo "✅ PASS: Doctor cannot create staff"
    ((PASS++))
else
    echo "❌ FAIL: Doctor should not create staff"
    echo "   Response: $DOC_CREATE_STAFF"
    ((FAIL++))
fi

# Summary
echo ""
echo "=========================================="
echo "   Admin/Doctor Test Results"
echo "=========================================="
echo "   ✅ Passed: $PASS"
echo "   ❌ Failed: $FAIL"
echo "   Total: $((PASS + FAIL))"
echo "=========================================="
