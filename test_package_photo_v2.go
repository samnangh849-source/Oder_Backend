package main

import (
	"fmt"
	"log"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

func main() {
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	orderID := "PK-TEST-1775816833" // ប្រើ ID ដែលយើងទើបបង្កើតមុននេះ
	dummyPhoto := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

	fmt.Printf("📸 ចាប់ផ្តើមធ្វើតេស្តថតកញ្ចប់ និងស៊ីងចូល Sheet សម្រាប់ Order: %s\n", orderID)

	// ១. Upload រូបភាពទៅ Drive មុន
	fmt.Println("🚀 ១. កំពុងបង្ហោះរូបភាពទៅ Google Drive...")
	uploadResp, err := backend.CallAppsScriptPOST(backend.AppsScriptRequest{
		Action:   "uploadImage",
		FileData: dummyPhoto,
		FileName: "Final_Package_Test.jpg",
		MimeType: "image/jpeg",
	})
	if err != nil || uploadResp.Status != "success" {
		log.Fatalf("❌ Upload បរាជ័យ: %v", err)
	}
	driveURL := uploadResp.URL
	fmt.Printf("✅ បង្ហោះរួចរាល់! URL: %s\n", driveURL)

	// ២. បង្ខំឱ្យ Update ចូល Sheet ដោយប្រើ Action 'updateSheet' ផ្ទាល់
	// ប្រើ Key ឱ្យត្រូវតាម Header ដែលលោកអ្នកបានផ្តល់ឱ្យ (Package Photo)
	fmt.Println("📝 ២. កំពុងបង្ខំឱ្យ Update ចូល Google Sheet...")
	syncReq := backend.AppsScriptRequest{
		Action:    "updateSheet",
		SheetName: "AllOrders",
		PrimaryKey: map[string]string{
			"Order ID": orderID,
		},
		NewData: map[string]interface{}{
			"Package Photo":     driveURL,
			"Fulfillment Status": "Ready to Ship",
			"Customer Name":     "តេស្តថតរូប (ឃើញរូបភាព ១០០%)",
		},
	}

	syncResp, err := backend.CallAppsScriptPOST(syncReq)
	if err != nil || syncResp.Status != "success" {
		log.Fatalf("❌ ការស៊ីងចូល Sheet បរាជ័យ: %v", err)
	}

	fmt.Println("\n✨ --- លទ្ធផលចុងក្រោយ --- ✨")
	fmt.Printf("✅ ស្ថានភាព: %s\n", syncResp.Status)
	fmt.Printf("📊 បាន Update រួចរាល់ក្នុង Column 'Package Photo'\n")
	fmt.Printf("🔗 តំណភ្ជាប់រូបភាព: %s\n", driveURL)
	fmt.Println("---------------------------")
	fmt.Println("💡 សូមពិនិត្យមើល Sheet 'AllOrders' ម្តងទៀត។ ប្រសិនបើនៅតែមិនឃើញរូបភាពទេ")
	fmt.Println("   មានន័យថា Script នេះកំពុងសរសេរចូល Spreadsheet ID ផ្សេង។")
}
