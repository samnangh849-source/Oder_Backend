package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

func main() {
	backend.AppsScriptURL = "https://script.google.com/macros/s/AKfycbzP9oZwcoDZOm643O_1luZuk_qtMMr-jHDyKaO_q4u0sNR8e8cY_oikbvFe8KLMW3Db/exec"
	backend.AppsScriptSecret = "168333@$Oudom"

	fmt.Printf("🔍 កំពុងចាប់ផ្តើមការវិនិច្ឆ័យ (Diagnosing) ប្រព័ន្ធតភ្ជាប់ Google Sheets...\n")

	// ហៅ API ទៅកាន់ Apps Script
	requestData := backend.AppsScriptRequest{
		Action: "diagnose",
		Secret: backend.AppsScriptSecret,
	}
	jsonData, _ := json.Marshal(requestData)
	respBody, err := http.Post(backend.AppsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("❌ ការហៅ Apps Script បរាជ័យ: %v", err)
	}
	defer respBody.Body.Close()

	body, _ := io.ReadAll(respBody.Body)
	var raw interface{}
	json.Unmarshal(body, &raw)
	prettyJSON, _ := json.MarshalIndent(raw, "", "  ")
	fmt.Printf("📥 លទ្ធផលវិនិច្ឆ័យលម្អិត:\n%s\n", string(prettyJSON))
}
