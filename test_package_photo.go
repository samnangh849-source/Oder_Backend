package main

import (
	"fmt"
	"log"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

func main() {
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	// ១. រៀបចំរូបភាពសាកល្បង (Base64 នៃរូបភាពតូចមួយ)
	dummyBase64 := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
	orderID := "TEST-VERIFIED-1775815747" // ប្រើ ID ដែលយើងទើបបង្កើត

	fmt.Printf("📸 ចាប់ផ្តើមធ្វើតេស្តការ Upload និង Sync រូបភាពសម្រាប់ Order: %s\n", orderID)

	// ២. បញ្ជូនរូបភាពទៅ Google Drive
	uploadReq := backend.AppsScriptRequest{
		Action:   "uploadImage",
		FileData: dummyBase64,
		FileName: "Test_Package_Photo.png",
		MimeType: "image/png",
		OrderID:  orderID,
	}

	fmt.Println("🚀 កំពុងបង្ហោះរូបភាពទៅ Google Drive...")
	uploadResp, err := backend.CallAppsScriptPOST(uploadReq)
	if err != nil {
		log.Fatalf("❌ បញ្ហាក្នុងការ Upload: %v", err)
	}

	if uploadResp.Status != "success" {
		log.Fatalf("❌ Upload បរាជ័យ: %s", uploadResp.Message)
	}

	driveURL := uploadResp.URL
	fmt.Printf("✅ បង្ហោះរួចរាល់! តំណភ្ជាប់ Drive: %s\n", driveURL)

	// ៣. ធ្វើបច្ចុប្បន្នភាព Google Sheet (ដាក់ URL ចូលក្នុង Column "Package Photo")
	fmt.Println("📝 កំពុងស៊ីង URL ចូលទៅកាន់ Google Sheets...")
	syncReq := backend.AppsScriptRequest{
		Action:    "updateSheet",
		SheetName: "AllOrders",
		PrimaryKey: map[string]string{
			"Order ID": orderID,
		},
		NewData: map[string]interface{}{
			"Package Photo": driveURL,
		},
	}

	syncResp, err := backend.CallAppsScriptPOST(syncReq)
	if err != nil {
		log.Fatalf("❌ បញ្ហាក្នុងការស៊ីងទៅ Sheet: %v", err)
	}

	if syncResp.Status == "success" {
		fmt.Println("✅ ជោគជ័យ: រូបភាពត្រូវបានស៊ីងចូលទៅកាន់ Google Sheets រួចរាល់ហើយ!")
		fmt.Printf("📊 សូមពិនិត្យមើល Column 'Package Photo' នៃ Order: %s\n", orderID)
	} else {
		fmt.Printf("❌ បរាជ័យក្នុងការស៊ីង: %s\n", syncResp.Message)
		fmt.Println("💡 ប្រហែលជារកមិនឃើញ Order ID ក្នុង Sheet ដើម្បី Update។")
	}
}
