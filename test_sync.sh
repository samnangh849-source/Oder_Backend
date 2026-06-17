#!/bash
# Test script for Order Sync (Backend -> DB -> Google Sheets)

API_URL="http://localhost:8080/api/admin/add-row"
# Note: In real scenarios, you might need an Auth Token if middleware is enabled.
# This script assumes the server is running locally.

ORDER_ID="TEST-$(date +%s)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🚀 ចាប់ផ្តើមធ្វើតេស្តការបង្កើត Order: $ORDER_ID"

# Payload matching the structure in handleAdminAddRow
PAYLOAD=$(cat <<EOF
{
  "sheetName": "AllOrders",
  "newData": {
    "Order ID": "$ORDER_ID",
    "Timestamp": "$TIMESTAMP",
    "User": "Tester",
    "Customer Name": "តេស្ត Read/Write",
    "Customer Phone": "012345678",
    "Grand Total": 99.99,
    "Fulfillment Status": "Pending",
    "Team": "TestTeam"
  }
}
EOF
)

start_time=$(date +%s%N)

# Send request to Go Backend
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
     -H "Content-Type: application/json" \
     -d "$PAYLOAD")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n1)

end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

if [ "$http_code" -eq 200 ]; then
    echo "✅ ជោគជ័យ: Backend បានទទួល និងរក្សាទុកក្នុង DB (ចំណាយពេល: ${duration}ms)"
    echo "ℹ️  ព័ត៌មានបន្ថែម: ទិន្នន័យកំពុងផ្ញើទៅ Google Sheets ជាលក្ខណៈ Asynchronous (Background)"
    echo "📊 សូមពិនិត្យមើល Sheet 'AllOrders' ដើម្បីផ្ទៀងផ្ទាត់ការ Sync ចុងក្រោយ។"
else
    echo "❌ បរាជ័យ: ម៉ាស៊ីនមេឆ្លើយតបមកវិញនូវកូដ $http_code"
    echo "📝 Body: $body"
fi



