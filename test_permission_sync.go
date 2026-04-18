package main

import (
	"fmt"
	"log"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

/**
 * ស្គ្រីបសម្រាប់តេស្តការ Update សិទ្ធិ (Permission Sync Test)
 * ប្រើដើម្បីផ្ទៀងផ្ទាត់ថា Backend អាច Update ជួរដេកក្នុង Google Sheet បានត្រឹមត្រូវ
 */
func main() {
	// កំណត់ការកំណត់ចាំបាច់ (យកតាមអ្វីដែលមានស្រាប់ក្នុងប្រព័ន្ធរបស់អ្នក)
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	fmt.Printf("🛡️ ចាប់ផ្តើមធ្វើតេស្តការ Update សិទ្ធិក្នុង RolePermissions Sheet...\n")

	// សាកល្បង Update ជួរដែលមានស្រាប់
	testID := "5" 
	newStatus := "false" 
	
	fmt.Printf("🔄 កំពុងសាកល្បង Update ទៅលើ ID ដែលមានស្រាប់: ID=%s, IsEnabled=%s\n", testID, newStatus)

	req := backend.AppsScriptRequest{
		Action:    "updateSheet", 
		SheetName: "RolePermissions",
		PrimaryKey: map[string]string{
			"ID": testID, 
		},
		NewData: map[string]interface{}{
			"IsEnabled": newStatus,
		},
	}

	// ហៅ API ទៅកាន់ Apps Script
	resp, err := backend.CallAppsScriptPOST(req)
	if err != nil {
		log.Fatalf("❌ មានបញ្ហាក្នុងការតភ្ជាប់: %v", err)
	}

	fmt.Printf("📥 លទ្ធផលពី Server: %s\n", resp.Status)
	
	if resp.Status == "success" {
		fmt.Println("✅ ជោគជ័យ: សិទ្ធិត្រូវបាន Update ក្នុង Google Sheets រួចរាល់!")
		fmt.Printf("📊 លទ្ធផល: បានកែប្រែ %d ជួរដេក។\n", 1)
		fmt.Println("💡 សូមពិនិត្យមើល Sheet 'RolePermissions' ជួរដែលមាន ID " + testID + " ឥឡូវនេះ។")
	} else {
		fmt.Printf("❌ បរាជ័យ: %s\n", resp.Message)
		fmt.Println("💡 យោបល់: ត្រូវប្រាកដថា ID ត្រូវគ្នានឹងជួរឈរ 'ID' ក្នុង Sheet របស់អ្នក។")
	}
}
