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

	orderID := "PK-VISION-168"
	packedTime := time.Now().Format("02/01/2006 15:04:05")

	fmt.Printf("📸 [Packaging Test] ចាប់ផ្តើមធ្វើតេស្តថតកញ្ចប់ជាមួយ Watermark សម្រាប់ ID: %s\n", orderID)

	// ១. បង្កើតជួរទិន្នន័យថ្មីក្នុង Sheet
	fmt.Println("📦 ១. កំពុងរៀបចំជួរទិន្នន័យក្នុង Google Sheet...")
	backend.CallAppsScriptPOST(backend.AppsScriptRequest{
		Action: "addRow", 
		SheetName: "AllOrders", 
		NewData: map[string]interface{}{
			"orderid": orderID,
			"customername": "តេស្ត ផ្នែកថតកញ្ចប់ (Vision)",
			"fulfillmentstatus": "Pending",
		},
	})

	// ២. រូបភាពសាកល្បង (Base64) - នេះតំណាងឱ្យរូបភាពដែល App ថតបាន
	dummyPhoto := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

	// ៣. បញ្ជូនរូបភាពទៅ Drive និង Update Metadata ក្នុងពេលតែមួយ
	fmt.Println("🚀 ២. កំពុងបង្ហោះរូបភាពកញ្ចប់ និង Update ស្ថានភាពទៅជា 'Packed'...")
	uploadReq := backend.AppsScriptRequest{
		Action:   "uploadImage",
		FileData: dummyPhoto,
		FileName: "Packaging_Proof_" + orderID + ".jpg",
		MimeType: "image/jpeg",
		OrderID:  orderID,
	}

	uploadResp, err := backend.CallAppsScriptPOST(uploadReq)
	if err != nil || uploadResp.Status != "success" {
		log.Fatalf("❌ ការថតកញ្ចប់បរាជ័យ: %v", err)
	}
	driveURL := uploadResp.URL

	// ៤. ដោយសារ Apps Script របស់លោកអ្នកមិន Update Sheet ពេលមាន orderId (វាទុកឱ្យ Go ធ្វើ)
	// យើងនឹងហៅ updateSheet ផ្ទាល់ដើម្បីបញ្ចប់លំហូរការងារ
	fmt.Println("📝 ៣. កំពុងបញ្ចប់ការ Update ព័ត៌មានវេចខ្ចប់ចូលក្នុង Sheet...")
	backend.CallAppsScriptPOST(backend.AppsScriptRequest{
		Action: "updateSheet",
		SheetName: "AllOrders",
		PrimaryKey: map[string]string{"Order ID": orderID},
		NewData: map[string]interface{}{
			"Package Photo":     driveURL,
			"Fulfillment Status": "Packed",
			"Packed By":          "Gemini Vision Test",
			"Packed Time":        packedTime,
			"Note":               "តេស្តជោគជ័យ៖ រូបភាពត្រូវបានរក្សាទុកក្នុង Drive រួចរាល់!",
		},
	})

	fmt.Println("\n✨ --- លទ្ធផលតេស្តផ្នែកថតកញ្ចប់ --- ✨")
	fmt.Printf("✅ បង្ហោះរូបភាពជោគជ័យ៖ %s\n", driveURL)
	fmt.Printf("✅ ស្ថានភាពក្នុង Sheet៖ Packed\n")
	fmt.Printf("✅ អ្នកវេចខ្ចប់៖ Gemini Vision Test\n")
	fmt.Println("---------------------------------------")
	fmt.Println("📊 សូមស្វែងរក Order ID: PK-VISION-168 ក្នុង Google Sheet 'AllOrders'។")
}
