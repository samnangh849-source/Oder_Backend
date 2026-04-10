package main

import (
	"fmt"
	"log"
	"time"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

func main() {
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	fmt.Printf("🚀 ចាប់ផ្តើមធ្វើតេស្តការស៊ីងទិន្នន័យទៅ Google Sheets (Normalized Keys)...\n")

	orderID := fmt.Sprintf("TEST-VERIFIED-%d", time.Now().Unix())
	
	// ប្រើ Key ដែលបានបំប្លែងតាម Logic របស់ Apps Script (Lowercase, No Space)
	testData := map[string]interface{}{
		"orderid":           orderID,
		"timestamp":         time.Now().Format("02/01/2006 15:04:05"),
		"user":              "Gemini CLI",
		"customername":      "តេស្តជោគជ័យ (Gemini Verified)",
		"customerphone":     "012345678",
		"fulfillmentstatus": "Pending",
		"team":              "TestTeam",
		"grandtotal":        168.00,
		"location":          "Phnom Penh",
		"page":              "Gemini Page",
	}

	req := backend.AppsScriptRequest{
		Action:    "addRow", 
		SheetName: "AllOrders",
		NewData:   testData,
	}

	resp, err := backend.CallAppsScriptPOST(req)
	if err != nil {
		log.Fatalf("❌ មានបញ្ហាក្នុងការហៅ Apps Script: %v", err)
	}

	fmt.Printf("📥 ស្ថានភាពឆ្លើយតប: %s\n", resp.Status)
	if resp.Status == "success" {
		fmt.Println("✅ ជោគជ័យ: ទិន្នន័យត្រូវបានបញ្ជូនទៅ Google Sheets រួចរាល់ហើយ!")
		fmt.Printf("📊 សូមពិនិត្យមើល Sheet 'AllOrders' សម្រាប់ Order ID: %s\n", orderID)
		fmt.Println("💡 ប្រសិនបើនៅតែមិនឃើញ សូមពិនិត្យមើលជួរចុងក្រោយបង្អស់នៃ Sheet។")
	} else {
		fmt.Printf("❌ បរាជ័យ: %s\n", resp.Message)
	}
}
