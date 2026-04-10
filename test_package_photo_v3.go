package main

import (
	"fmt"
	"log"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

func main() {
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	// ប្រើ Order ID ដដែលដែលយើងទើបបង្កើត
	orderID := "PK-TEST-1775816833" 
	
	fmt.Printf("🔍 កំពុងធ្វើតេស្តបញ្ជូនរូបភាពទៅជួរដែលមាន ID: %s\n", orderID)

	// ១. Upload រូបភាពថ្មី (យក URL ថ្មី)
	uploadResp, _ := backend.CallAppsScriptPOST(backend.AppsScriptRequest{
		Action:   "uploadImage",
		FileData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
		FileName: "Final_Test_Gemini.jpg",
		MimeType: "image/jpeg",
	})
	
	driveURL := uploadResp.URL

	// ២. Update ទៅ Sheet ជាមួយទិន្នន័យដែលងាយស្រួលរក (Ctrl + F)
	syncReq := backend.AppsScriptRequest{
		Action:    "updateSheet",
		SheetName: "AllOrders",
		PrimaryKey: map[string]string{
			"Order ID": orderID,
		},
		NewData: map[string]interface{}{
			"Customer Name": "!!! រកមើលជួរនេះ (CHECK THIS) !!!",
			"Package Photo": driveURL,
			"Note":          "រូបភាពតេស្តចុងក្រោយ: " + driveURL,
		},
	}

	fmt.Println("📝 កំពុង Update ទៅ Google Sheet...")
	syncResp, err := backend.CallAppsScriptPOST(syncReq)
	if err != nil || syncResp.Status != "success" {
		log.Fatalf("❌ បរាជ័យ: %v", err)
	}

	fmt.Println("\n✅ រួចរាល់! សូមធ្វើតាមជំហានខាងក្រោម៖")
	fmt.Println("១. ចូលទៅកាន់ Google Sheet 'AllOrders'")
	fmt.Println("២. ចុច Ctrl + F (ស្វែងរក) រួចវាយពាក្យ: CHECK THIS")
	fmt.Printf("៣. លោកអ្នកនឹងឃើញជួរនោះ ហើយសូមមើល Column 'Package Photo' នឹងឃើញ URL: %s\n", driveURL)
}
