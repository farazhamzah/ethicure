#!/bin/bash
# Ethicare API Test Suite

BASE_URL="http://127.0.0.1:8000"
PASS=0
FAIL=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    local expected=$5
    local desc=$6
    
    if [ -n "$token" ]; then
        AUTH="-H \"Authorization: Bearer $token\""
    else
        AUTH=""
    fi
    
    if [ -n "$data" ]; then
        CMD="curl -s -X $method $BASE_URL$endpoint -H 'Content-Type: application/json' -d '$data' $AUTH"
    else
        CMD="curl -s -X $method $BASE_URL$endpoint $AUTH"
    fi
    
    RESPONSE=$(eval $CMD 2>&1)
    
    if echo "$RESPONSE" | grep -q "$expected"; then
        echo "✅ PASS: $desc"
        ((PASS++))
    else
        echo "❌ FAIL: $desc"
        echo "   Expected: $expected"
        echo "   Got: ${RESPONSE:0:200}"
        ((FAIL++))
    fi
}

echo "=========================================="
echo "   Ethicare API Test Suite"
echo "=========================================="
echo ""

# 1. General Endpoints
echo "--- General Endpoints ---"
test_endpoint "GET" "/api/" "" "" "Ethicare" "Root endpoint"
test_endpoint "GET" "/api/health/" "" "" "ok" "Health check"

# 2. Patient Registration
echo ""
echo "--- Patient Registration ---"
TIMESTAMP=$(date +%s)
REG_RESPONSE=$(curl -s -X POST $BASE_URL/api/register/ \
  -H "Content-Type: application/json" \
  -d "{\"first_name\":\"Test\",\"last_name\":\"User\",\"email\":\"test${TIMESTAMP}@example.com\",\"username\":\"testuser${TIMESTAMP}\",\"password\":\"SecurePass123!\",\"gender\":\"male\",\"date_of_birth\":\"1990-01-01\",\"height\":180,\"weight\":75}")

if echo "$REG_RESPONSE" | grep -q "id"; then
    echo "✅ PASS: Patient registration"
    ((PASS++))
else
    echo "❌ FAIL: Patient registration"
    echo "   Response: $REG_RESPONSE"
    ((FAIL++))
fi

# 3. Patient Login
echo ""
echo "--- Patient Login ---"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/patient/token/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser${TIMESTAMP}\",\"password\":\"SecurePass123!\"}")

PATIENT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access":"[^"]*"' | cut -d'"' -f4)

if [ -n "$PATIENT_TOKEN" ]; then
    echo "✅ PASS: Patient login - token acquired"
    ((PASS++))
else
    echo "❌ FAIL: Patient login"
    echo "   Response: $LOGIN_RESPONSE"
    ((FAIL++))
fi

# 4. Patient Profile
echo ""
echo "--- Patient Profile ---"
PROFILE_RESPONSE=$(curl -s $BASE_URL/api/profile/ \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$PROFILE_RESPONSE" | grep -q "first_name"; then
    echo "✅ PASS: Get patient profile"
    ((PASS++))
else
    echo "❌ FAIL: Get patient profile"
    echo "   Response: $PROFILE_RESPONSE"
    ((FAIL++))
fi

# 5. Device Registration
echo ""
echo "--- Device Management ---"
DEVICE_RESPONSE=$(curl -s -X POST $BASE_URL/api/devices/ \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_type":"heart","is_active":true}')

DEVICE_ID=$(echo $DEVICE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$DEVICE_ID" ]; then
    echo "✅ PASS: Device registration (ID: $DEVICE_ID)"
    ((PASS++))
else
    echo "❌ FAIL: Device registration"
    echo "   Response: $DEVICE_RESPONSE"
    ((FAIL++))
fi

# 6. List Devices
DEVICES_LIST=$(curl -s $BASE_URL/api/devices/ \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$DEVICES_LIST" | grep -q "device_type"; then
    echo "✅ PASS: List devices"
    ((PASS++))
else
    echo "❌ FAIL: List devices"
    echo "   Response: $DEVICES_LIST"
    ((FAIL++))
fi

# 7. Goals
echo ""
echo "--- Goals ---"
GOAL_RESPONSE=$(curl -s -X POST $BASE_URL/api/goals/ \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metric_type":"steps","target_value":10000,"start_date":"2025-12-21"}')

GOAL_ID=$(echo $GOAL_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$GOAL_ID" ]; then
    echo "✅ PASS: Create goal (ID: $GOAL_ID)"
    ((PASS++))
else
    echo "❌ FAIL: Create goal"
    echo "   Response: $GOAL_RESPONSE"
    ((FAIL++))
fi

GOALS_LIST=$(curl -s $BASE_URL/api/goals/ \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$GOALS_LIST" | grep -q "target_value"; then
    echo "✅ PASS: List goals"
    ((PASS++))
else
    echo "❌ FAIL: List goals"
    ((FAIL++))
fi

# 8. Thresholds
echo ""
echo "--- Thresholds ---"
THRESHOLD_RESPONSE=$(curl -s -X POST $BASE_URL/api/thresholds/ \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metric_type":"heart_rate","condition":"above","value":100}')

THRESHOLD_ID=$(echo $THRESHOLD_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$THRESHOLD_ID" ]; then
    echo "✅ PASS: Create threshold (ID: $THRESHOLD_ID)"
    ((PASS++))
else
    echo "❌ FAIL: Create threshold"
    echo "   Response: $THRESHOLD_RESPONSE"
    ((FAIL++))
fi

# 9. Readings
echo ""
echo "--- Readings ---"
if [ -n "$DEVICE_ID" ]; then
    READING_RESPONSE=$(curl -s -X POST $BASE_URL/api/readings/ \
      -H "Authorization: Bearer $PATIENT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"device\":$DEVICE_ID,\"metric_type\":\"heart_rate\",\"value\":120}")
    
    if echo "$READING_RESPONSE" | grep -q "id"; then
        echo "✅ PASS: Create reading (should trigger alert)"
        ((PASS++))
    else
        echo "❌ FAIL: Create reading"
        echo "   Response: $READING_RESPONSE"
        ((FAIL++))
    fi
fi

READINGS_LIST=$(curl -s "$BASE_URL/api/readings/?limit=10" \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$READINGS_LIST" | grep -q "\["; then
    echo "✅ PASS: List readings"
    ((PASS++))
else
    echo "❌ FAIL: List readings"
    ((FAIL++))
fi

# 10. Reading Stats
STATS_RESPONSE=$(curl -s "$BASE_URL/api/readings/stats/?days=7" \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$STATS_RESPONSE" | grep -q "\["; then
    echo "✅ PASS: Get reading stats"
    ((PASS++))
else
    echo "❌ FAIL: Get reading stats"
    echo "   Response: $STATS_RESPONSE"
    ((FAIL++))
fi

# 11. Alerts
echo ""
echo "--- Alerts ---"
ALERTS_RESPONSE=$(curl -s $BASE_URL/api/alerts/ \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$ALERTS_RESPONSE" | grep -q "\["; then
    echo "✅ PASS: List alerts"
    ((PASS++))
else
    echo "❌ FAIL: List alerts"
    echo "   Response: $ALERTS_RESPONSE"
    ((FAIL++))
fi

# 12. Notifications
echo ""
echo "--- Notifications ---"
NOTIF_RESPONSE=$(curl -s $BASE_URL/api/notifications/ \
  -H "Authorization: Bearer $PATIENT_TOKEN")

if echo "$NOTIF_RESPONSE" | grep -q "\["; then
    echo "✅ PASS: List notifications"
    ((PASS++))
else
    echo "❌ FAIL: List notifications"
    ((FAIL++))
fi

# 13. Reports
echo ""
echo "--- Reports ---"
REPORT_RESPONSE=$(curl -s -X POST $BASE_URL/api/reports/ \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"report_type":"weekly","title":"Weekly Health Report","start_date":"2025-12-14","end_date":"2025-12-21"}')

REPORT_ID=$(echo $REPORT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$REPORT_ID" ]; then
    echo "✅ PASS: Create report (ID: $REPORT_ID)"
    ((PASS++))
else
    echo "❌ FAIL: Create report"
    echo "   Response: $REPORT_RESPONSE"
    ((FAIL++))
fi

# 14. Report PDF
if [ -n "$REPORT_ID" ]; then
    PDF_RESPONSE=$(curl -s $BASE_URL/api/reports/$REPORT_ID/pdf/ \
      -H "Authorization: Bearer $PATIENT_TOKEN")
    
    if echo "$PDF_RESPONSE" | grep -q "patient"; then
        echo "✅ PASS: Generate report PDF data"
        ((PASS++))
    else
        echo "❌ FAIL: Generate report PDF data"
        echo "   Response: $PDF_RESPONSE"
        ((FAIL++))
    fi
fi

# 15. Unauthorized Access Tests
echo ""
echo "--- Authorization Tests ---"
UNAUTH_RESPONSE=$(curl -s $BASE_URL/api/profile/)

if echo "$UNAUTH_RESPONSE" | grep -q "credentials were not provided\|Unauthorized\|Authentication"; then
    echo "✅ PASS: Unauthorized access blocked"
    ((PASS++))
else
    echo "❌ FAIL: Unauthorized access not blocked"
    echo "   Response: $UNAUTH_RESPONSE"
    ((FAIL++))
fi

# Summary
echo ""
echo "=========================================="
echo "   Test Results"
echo "=========================================="
echo "   ✅ Passed: $PASS"
echo "   ❌ Failed: $FAIL"
echo "   Total: $((PASS + FAIL))"
echo "=========================================="
