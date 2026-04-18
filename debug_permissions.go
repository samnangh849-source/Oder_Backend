package main

import (
	"fmt"
	"log"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

/**
 * ស្គ្រីបសម្រាប់ឆែកមើលទិន្នន័យក្នុង Sheet (Debug Permissions)
 */
func main() {
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	fmt.Printf("🔍 កំពុងទាញយកទិន្នន័យពី RolePermissions ដើម្បីពិនិត្យ...\n")

	// យើងនឹងសាកល្បងប្រើសកម្មភាពដែលមិនមាន តែ Apps Script នឹងបោះ Error មកវិញជាមួយព័ត៌មានខ្លះ
	// ប៉ុន្តែវិធីដែលល្អបំផុតគឺប្រើ PerformDataMigration ក្នុង Backend ដើម្បីមើល Log
	
	// ក្នុងករណីនេះ ខ្ញុំនឹងសាកល្បង Update ជួរទី ២ (ID=2) ដែលច្បាស់ជាមានក្នុងរូបភាពរបស់អ្នក
	req := backend.AppsScriptRequest{
		Action:    "updateSheet", 
		SheetName: "RolePermissions",
		PrimaryKey: map[string]string{
			"ID": "2", 
		},
		NewData: map[string]interface{}{
			"IsEnabled": "true",
		},
	}

	resp, err := backend.CallAppsScriptPOST(req)
	if err != nil {
		log.Fatalf("❌ Error: %v", err)
	}

	fmt.Printf("📥 ស្ថានភាព: %s, សារ: %s\n", resp.Status, resp.Message)
}
