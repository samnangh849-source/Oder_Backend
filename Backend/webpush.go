package backend

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	webpush "github.com/SherClockHolmes/webpush-go"
)

var (
	VapidPublicKey  string
	VapidPrivateKey string
	VapidEmail      = "mailto:admin@acc-order-system.com"
)

// InitVAPID initializes the VAPID keys.
// It checks the database "settings" table. If keys do not exist, it generates them.
func InitVAPID() {
	var pubSetting, privSetting Setting

	// Find Public Key
	errPub := DB.Where("config_key = ?", "VapidPublicKey").First(&pubSetting).Error
	errPriv := DB.Where("config_key = ?", "VapidPrivateKey").First(&privSetting).Error

	if errPub != nil || errPriv != nil {
		log.Println("🔑 VAPID keys not found in database settings. Generating new VAPID keys...")
		priv, pub, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			log.Fatalf("❌ Failed to generate VAPID keys: %v", err)
		}

		// Save/Update in DB
		pubSetting = Setting{
			ConfigKey:   "VapidPublicKey",
			ConfigValue: pub,
			Description: "PWA Web Push VAPID Public Key",
		}
		privSetting = Setting{
			ConfigKey:   "VapidPrivateKey",
			ConfigValue: priv,
			Description: "PWA Web Push VAPID Private Key",
		}

		DB.Save(&pubSetting)
		DB.Save(&privSetting)
		log.Println("✅ VAPID keys generated and saved to settings table.")
	}

	VapidPublicKey = pubSetting.ConfigValue
	VapidPrivateKey = privSetting.ConfigValue
}

// SendWebPush sends a notification payload to all subscriptions of a specific user.
func SendWebPush(username string, payload interface{}) {
	var subs []PushSubscription
	if err := DB.Where("user_name = ?", username).Find(&subs).Error; err != nil {
		log.Printf("❌ Failed to fetch push subscriptions for %s: %v", username, err)
		return
	}

	if len(subs) == 0 {
		return
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("❌ Failed to marshal push payload: %v", err)
		return
	}

	for _, sub := range subs {
		go func(s PushSubscription) {
			subscription := webpush.Subscription{
				Endpoint: s.Endpoint,
				Keys: webpush.Keys{
					P256dh: s.P256dh,
					Auth:   s.Auth,
				},
			}

			resp, err := webpush.SendNotification(payloadBytes, &subscription, &webpush.Options{
				Subscriber:      VapidEmail,
				VAPIDPublicKey:  VapidPublicKey,
				VAPIDPrivateKey: VapidPrivateKey,
				TTL:             30, // TTL in seconds
			})
			if err != nil {
				log.Printf("❌ Failed to send web push to endpoint %s: %v", s.Endpoint, err)
				return
			}
			defer resp.Body.Close()

			// If subscription is expired or invalid, remove it
			if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
				log.Printf("🗑️ Push subscription expired (Status %d). Deleting from DB...", resp.StatusCode)
				DB.Delete(&s)
			}
		}(sub)
	}
}

// HandleGetVapidPublicKey returns the public key
func HandleGetVapidPublicKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"publicKey": VapidPublicKey,
	})
}

// HandleSubscribePush registers or updates a user's subscription
func HandleSubscribePush(c *gin.Context) {
	username, _ := c.Get("userName")
	usernameStr, _ := username.(string)

	if usernameStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Unauthorized"})
		return
	}

	var req struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	if req.Endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Missing endpoint"})
		return
	}

	var sub PushSubscription
	// Check if already exists
	err := DB.Where("endpoint = ?", req.Endpoint).First(&sub).Error
	if err == nil {
		// Update
		sub.UserName = usernameStr
		sub.P256dh = req.Keys.P256dh
		sub.Auth = req.Keys.Auth
		DB.Save(&sub)
	} else {
		// Create new
		sub = PushSubscription{
			UserName:  usernameStr,
			Endpoint:  req.Endpoint,
			P256dh:    req.Keys.P256dh,
			Auth:      req.Keys.Auth,
			CreatedAt: time.Now(),
		}
		if err := DB.Create(&sub).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to create subscription"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Subscribed successfully"})
}

// HandleUnsubscribePush removes a user's subscription
func HandleUnsubscribePush(c *gin.Context) {
	var req struct {
		Endpoint string `json:"endpoint"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	if err := DB.Where("endpoint = ?", req.Endpoint).Delete(&PushSubscription{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to unsubscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Unsubscribed successfully"})
}

// HandleRejectCallPush allows rejecting an active call via Web Push Decline button click.
func HandleRejectCallPush(c *gin.Context) {
	caller := c.Query("caller")
	receiver := c.Query("receiver")

	if caller == "" || receiver == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Missing caller or receiver"})
		return
	}

	if HubGlobal == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "message": "Hub unavailable"})
		return
	}

	// Check if an active call exists matching caller and receiver
	HubGlobal.mu.Lock()
	call, exists := HubGlobal.ActiveCalls[receiver]
	if exists && call.Caller == caller {
		// Remove the active call
		delete(HubGlobal.ActiveCalls, receiver)
		HubGlobal.mu.Unlock()

		// Notify the caller that the call was rejected
		rejectMsg, _ := json.Marshal(map[string]interface{}{
			"type": "call_reject",
			"from": receiver,
			"to":   caller,
		})
		HubGlobal.SendToUser(caller, rejectMsg)

		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Call rejected"})
	} else {
		HubGlobal.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Active call not found"})
	}
}

// triggerWebPushCallNotification queries user info and triggers SendWebPush.
func triggerWebPushCallNotification(from, to, sigType string, payload json.RawMessage) {
	// Query caller user info
	var caller User
	if err := DB.Where("user_name = ?", from).First(&caller).Error; err != nil {
		log.Printf("❌ Failed to find caller user info for web push: %v", err)
		return
	}

	// Parse callType from payload if present
	callType := "audio"
	var pl struct {
		CallType string `json:"callType"`
	}
	if err := json.Unmarshal(payload, &pl); err == nil && pl.CallType != "" {
		callType = pl.CallType
	}

	var pushPayload map[string]interface{}

	if sigType == "call_offer" || sigType == "group_call_invite" {
		isGroup := sigType == "group_call_invite"
		title := "Incoming Call"
		body := "Incoming " + callType + " call from " + caller.FullName
		if isGroup {
			title = "Incoming Group Call"
			body = "Incoming group " + callType + " call from " + caller.FullName
		}
		pushPayload = map[string]interface{}{
			"title": title,
			"body":  body,
			"icon":  caller.ProfilePictureURL,
			"badge": "/Order_System/logo-192.png",
			"tag":   "incoming_call_" + from,
			"requireInteraction": true,
			"vibrate": []int{1000, 500, 1000, 500, 1000, 500, 1000},
			"data": map[string]interface{}{
				"url":            "/Order_System/",
				"type":           "incoming_call",
				"callerUsername": from,
				"callerFullName": caller.FullName,
				"callerAvatar":   caller.ProfilePictureURL,
				"callType":       callType,
				"isGroup":        isGroup,
				"declineUrl":     "https://oder-backend-2.onrender.com/api/call/reject-push?caller=" + from + "&receiver=" + to,
			},
			"actions": []map[string]interface{}{
				{"action": "answer", "title": "Answer"},
				{"action": "decline", "title": "Decline"},
			},
		}
	} else if sigType == "call_cancelled" || sigType == "call_end" {
		pushPayload = map[string]interface{}{
			"title": "Missed Call",
			"body":  "Missed " + callType + " call from " + caller.FullName,
			"icon":  caller.ProfilePictureURL,
			"badge": "/Order_System/logo-192.png",
			"tag":   "incoming_call_" + from, // overwrite the ringing notification
			"requireInteraction": false,
			"data": map[string]interface{}{
				"url":  "/Order_System/",
				"type": "missed_call",
			},
		}
	}

	if pushPayload != nil {
		SendWebPush(to, pushPayload)
	}
}
