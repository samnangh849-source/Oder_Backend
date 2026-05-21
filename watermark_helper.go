package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/textproto"

	"github.com/fogleman/gg"
	backend "github.com/samnangh849-source/Oder_Backend-2-/Backend"
)

// AddWatermarkAndEditTelegramMedia modifies the message by adding a watermark to the photo
func AddWatermarkAndEditTelegramMedia(order Order, newStatus string) {
	if order.DeliveryTelegramMessageID == "" {
		return
	}

	if order.FulfillmentStore == "" {
		return
	}

	var store Store
	if err := backend.DB.Where("store_name = ?", order.FulfillmentStore).First(&store).Error; err != nil {
		return
	}

	if store.TelegramBotToken == "" || store.DeliveryTelegramGroupID == "" {
		return
	}

	if order.PackagePhotoURL == "" {
		return
	}

	var statusIndicator string
	var watermarkText string
	var watermarkColor color.RGBA

	if newStatus == "Cancelled" {
		statusIndicator = "❌ *ការកម្មង់ត្រូវបានលុបចោល (CANCELLED)* ❌"
		watermarkText = "CANCELLED"
		watermarkColor = color.RGBA{255, 0, 0, 150} // Red with alpha
	} else if newStatus == "Returned" {
		statusIndicator = "🔄 *ការកម្មង់ត្រូវបានបញ្ជូនត្រលប់ (RETURNED)* 🔄"
		watermarkText = "RETURNED"
		watermarkColor = color.RGBA{128, 0, 128, 150} // Purple with alpha
	} else {
		return
	}

	// 1. Download the original photo
	photoURL := convertDriveURLToDirect(order.PackagePhotoURL)
	resp, err := http.Get(photoURL)
	if err != nil {
		log.Printf("❌ Failed to download package photo for watermarking: %v", err)
		return
	}
	defer resp.Body.Close()

	img, _, err := image.Decode(resp.Body)
	if err != nil {
		log.Printf("❌ Failed to decode package photo: %v", err)
		return
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// 2. Draw the watermark
	dc := gg.NewContext(width, height)
	dc.DrawImage(img, 0, 0)

	// Set font size based on image width (e.g. width / 5)
	fontSize := float64(width) / 5.0
	if fontSize < 20 {
		fontSize = 20
	}
	
	// Load a basic font (we'll just use a basic internal font if no TTF is loaded)
	// We can use the default font provided by gg, which might be basic but works
	// Wait, fogleman/gg's default font doesn't scale. Let's draw it using basic shapes or try to load a font.
	// We have a "Font/DOMEG.ttf" in the workspace. Let's use it!
	err = dc.LoadFontFace("../Font/DOMEG.ttf", fontSize)
	if err != nil {
		// Fallback if font fails, but hopefully it works from the execution directory (Backend/)
		// Let's try absolute or relative paths
		err = dc.LoadFontFace("Font/DOMEG.ttf", fontSize)
		if err != nil {
			err = dc.LoadFontFace("../Font/DOMEG.ttf", fontSize)
		}
	}

	dc.SetColor(watermarkColor)
	dc.Rotate(gg.Radians(-30))
	dc.DrawStringAnchored(watermarkText, float64(width)/2.0, float64(height)/2.0, 0.5, 0.5)
	dc.Identity() // Reset transformations

	// Draw border / additional strokes for better visibility
	dc.SetColor(color.RGBA{255, 255, 255, 150})
	dc.SetLineWidth(4)
	dc.Rotate(gg.Radians(-30))
	dc.DrawStringAnchored(watermarkText, float64(width)/2.0, float64(height)/2.0, 0.5, 0.5)
	dc.Stroke()
	dc.Identity()

	// Save to buffer
	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, dc.Image(), &jpeg.Options{Quality: 85}); err != nil {
		log.Printf("❌ Failed to encode watermarked image: %v", err)
		return
	}

	// 3. Upload new photo via editMessageMedia
	caption := fmt.Sprintf("%s\n\n📦 *រូបភាពកញ្ចប់បញ្ញើ*\n🏷️ លេខកូដ: `%s`\n🏠 ហាង: *%s*\n🧑‍🔧 អ្នកវេចខ្ចប់: *%s*", statusIndicator, order.OrderID, order.FulfillmentStore, order.PackedBy)
	if order.InternalShippingMethod != "" {
		caption += fmt.Sprintf("\n🚚 ដឹកដោយ: *%s*", order.InternalShippingMethod)
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/editMessageMedia", store.TelegramBotToken)

	var b bytes.Buffer
	w := multipart.NewWriter(&b)

	// Create media part
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="media"`)
	h.Set("Content-Type", "application/json")
	p, err := w.CreatePart(h)
	if err != nil {
		log.Printf("❌ Multipart create media part error: %v", err)
		return
	}

	mediaJSON := map[string]interface{}{
		"type":       "photo",
		"media":      "attach://photo",
		"caption":    caption,
		"parse_mode": "Markdown",
	}
	mediaBytes, _ := json.Marshal(mediaJSON)
	p.Write(mediaBytes)

	// Create photo file part
	photoPart, err := w.CreateFormFile("photo", "watermarked.jpg")
	if err != nil {
		log.Printf("❌ Multipart create photo file error: %v", err)
		return
	}
	io.Copy(photoPart, buf)

	w.WriteField("chat_id", store.DeliveryTelegramGroupID)
	w.WriteField("message_id", order.DeliveryTelegramMessageID)

	w.Close()

	req, err := http.NewRequest("POST", apiURL, &b)
	if err != nil {
		log.Printf("❌ HTTP request creation error: %v", err)
		return
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{}
	apiResp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Failed to update delivery telegram media: %v", err)
		return
	}
	defer apiResp.Body.Close()

	var resData map[string]interface{}
	json.NewDecoder(apiResp.Body).Decode(&resData)
	if ok, _ := resData["ok"].(bool); !ok {
		log.Printf("⚠️ Telegram API error updating delivery media: %v", resData)
	} else {
		log.Printf("✅ Successfully updated delivery telegram photo for %s with %s", order.OrderID, newStatus)
	}
}
