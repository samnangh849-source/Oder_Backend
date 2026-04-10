package main

import (
	"fmt"
	"log"
	"time"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

func main() {
	// ១. កំណត់ការភ្ជាប់ទៅកាន់ Apps Script
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	orderID := fmt.Sprintf("PK-TEST-%d", time.Now().Unix())
	packerName := "Oudom Packer"
	packedTime := time.Now().Format("02/01/2006 15:04:05")

	fmt.Printf("📦 [Step 1] កំពុងបង្កើតការកម្មង់ថ្មីសម្រាប់តេស្តវេចខ្ចប់: %s\n", orderID)
	
	createOrderData := map[string]interface{}{
		"orderid":           orderID,
		"timestamp":         packedTime,
		"customername":      "អតិថិជន តេស្តថតរូប",
		"customerphone":     "099-888-777",
		"fulfillmentstatus": "Pending",
		"team":              "TestTeam",
	}

	_, err := backend.CallAppsScriptPOST(backend.AppsScriptRequest{
		Action: "addRow", SheetName: "AllOrders", NewData: createOrderData,
	})
	if err != nil {
		log.Fatalf("❌ បង្កើតការកម្មង់បរាជ័យ: %v", err)
	}
	fmt.Println("✅ បង្កើតការកម្មង់ជោគជ័យ។")

	// ២. ធ្វើត្រាប់តាមការថតរូបកញ្ចប់ (Packaging Photo Capture)
	fmt.Printf("📸 [Step 2] កំពុងថតរូប និងបញ្ជូនទិន្នន័យវេចខ្ចប់សម្រាប់: %s\n", orderID)
	
	// រូបភាពតំណាង (Dummy Base64)
	dummyPhotoBase64 := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
	
	// ទិន្នន័យបន្ថែមដែល Frontend ផ្ញើទៅពេល Pack រួច
	packagingMetadata := map[string]interface{}{
		"Fulfillment Status": "Ready to Ship",
		"Packed By":          packerName,
		"Packed Time":        packedTime,
	}

	uploadReq := backend.AppsScriptRequest{
		Action:       "uploadImage",
		FileData:     dummyPhotoBase64,
		FileName:     fmt.Sprintf("Package_%s.jpg", orderID),
		MimeType:     "image/jpeg",
		OrderID:      orderID,
		TargetColumn: "Package Photo", // ដាក់រូបក្នុង Column នេះ
		NewData:      packagingMetadata, // Update Status និងអ្នកវេចខ្ចប់ក្នុងពេលតែមួយ
	}

	fmt.Println("🚀 កំពុងបញ្ជូនរូបភាព និង Metadata ទៅកាន់ System...")
	resp, err := backend.CallAppsScriptPOST(uploadReq)
	if err != nil {
		log.Fatalf("❌ ដំណើរការវេចខ្ចប់បរាជ័យ: %v", err)
	}

	// ៣. បង្ហាញលទ្ធផល
	if resp.Status == "success" {
		fmt.Println("\n✨ --- លទ្ធផលនៃការតេស្តថតកញ្ចប់ --- ✨")
		fmt.Printf("✅ ស្ថានភាព: ជោគជ័យ (Success)\n")
		fmt.Printf("🔗 រូបភាពក្នុង Drive: %s\n", resp.URL)
		fmt.Printf("📝 បច្ចុប្បន្នភាពក្នុង Sheet: \n")
		fmt.Printf("   - ស្ថានភាពថ្មី: Ready to Ship\n")
		fmt.Printf("   - អ្នកវេចខ្ចប់: %s\n", packerName)
		fmt.Printf("   - ពេលវេលា: %s\n", packedTime)
		fmt.Println("---------------------------------------")
		fmt.Printf("📊 សូមពិនិត្យមើល Sheet 'AllOrders' ត្រង់ Order ID: %s\n", orderID)
	} else {
		fmt.Printf("❌ បរាជ័យ: %s\n", resp.Message)
	}
}
