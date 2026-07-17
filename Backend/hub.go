package backend

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var HubGlobal *Hub

var Upgrader = websocket.Upgrader{
	CheckOrigin: isOriginAllowed,
}

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

func isOriginAllowed(r *http.Request) bool {
	allowedOrigins := os.Getenv("ALLOWED_WS_ORIGINS")
	if allowedOrigins == "" {
		return true
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parts := strings.Split(allowedOrigins, ",")
	for _, p := range parts {
		if strings.TrimSpace(p) == origin {
			return true
		}
	}
	return false
}

// Client represents a single WebSocket connection with an identified user.
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	Username string // The authenticated username for this connection
}

type ActiveCall struct {
	Caller    string          `json:"caller"`
	Receiver  string          `json:"receiver"`
	CallType  string          `json:"callType"`
	SDPOffer  json.RawMessage `json:"sdpOffer"`
	Timestamp time.Time       `json:"timestamp"`
}

// Hub maintains a set of active clients and broadcasts messages.
type Hub struct {
	Clients     map[*Client]bool
	UserClients map[string]*Client // username → active Client (for unicast signaling)
	ActiveCalls map[string]*ActiveCall // receiverUsername -> ActiveCall
	mu          sync.RWMutex       // protects UserClients and ActiveCalls
	Broadcast   chan []byte
	Register    chan *Client
	Unregister  chan *Client
	quit        chan struct{}
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:   make(chan []byte, 4096), // Buffered to prevent blocking
		Register:    make(chan *Client, 128),
		Unregister:  make(chan *Client, 128),
		Clients:     make(map[*Client]bool),
		UserClients: make(map[string]*Client),
		ActiveCalls: make(map[string]*ActiveCall),
		quit:        make(chan struct{}),
	}
}

func (h *Hub) Run() {
	log.Println("🚀 WebSocket Hub is running...")
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
			if client.Username != "" {
				h.mu.Lock()
				h.UserClients[client.Username] = client

				// Check for pending active calls
				var pendingCall *ActiveCall
				if call, ok := h.ActiveCalls[client.Username]; ok {
					// Clean up if older than 60 seconds
					if time.Since(call.Timestamp) > 60*time.Second {
						delete(h.ActiveCalls, client.Username)
					} else {
						pendingCall = call
					}
				}
				h.mu.Unlock()

				log.Printf("🔌 Client connected: %s. Total: %d", client.Username, len(h.Clients))

				// Send the pending call offer if receiver connects
				if pendingCall != nil {
					log.Printf("📞 Found pending call for %s from %s. Re-sending offer...", client.Username, pendingCall.Caller)
					stamped, err := json.Marshal(map[string]interface{}{
						"type":    "call_offer",
						"from":    pendingCall.Caller,
						"to":      client.Username,
						"payload": pendingCall.SDPOffer,
					})
					if err == nil {
						select {
						case client.Send <- stamped:
						default:
						}
					}
				}
			} else {
				log.Printf("🔌 Anonymous client connected. Total: %d", len(h.Clients))
			}
		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				if client.Username != "" {
					h.mu.Lock()
					// Only remove if this client is still the registered one
					if h.UserClients[client.Username] == client {
						delete(h.UserClients, client.Username)
					}
					h.mu.Unlock()
					log.Printf("🔌 Client disconnected: %s. Total: %d", client.Username, len(h.Clients))
				} else {
					log.Printf("🔌 Anonymous client disconnected. Total: %d", len(h.Clients))
				}
			}
		case message := <-h.Broadcast:
			for client := range h.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client)
				}
			}
		case <-h.quit:
			log.Println("🛑 Stopping WebSocket Hub...")
			for client := range h.Clients {
				close(client.Send)
				delete(h.Clients, client)
			}
			return
		}
	}
}

func (h *Hub) Stop() {
	close(h.quit)
}

// BroadcastJSON is a helper to broadcast structured data to ALL connected clients.
func (h *Hub) BroadcastJSON(v interface{}) {
	if h == nil {
		return
	}
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("❌ Hub: Failed to marshal JSON for broadcast: %v", err)
		return
	}
	h.Broadcast <- data
}

func SafeBroadcastJSON(v interface{}) {
	if HubGlobal != nil {
		HubGlobal.BroadcastJSON(v)
	}
}

// SendToUser sends a message to a specific user by username.
// Returns true if the user was found and the message was queued.
func (h *Hub) SendToUser(username string, msg []byte) bool {
	if h == nil || username == "" {
		return false
	}
	h.mu.RLock()
	client, ok := h.UserClients[username]
	h.mu.RUnlock()
	if !ok {
		return false
	}
	select {
	case client.Send <- msg:
		return true
	default:
		// Channel full — client is too slow, disconnect it
		h.mu.Lock()
		if h.UserClients[username] == client {
			delete(h.UserClients, username)
		}
		h.mu.Unlock()
		close(client.Send)
		delete(h.Clients, client)
		return false
	}
}

// ClearActiveCall removes any active call involving the user.
func (h *Hub) ClearActiveCall(username string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.ActiveCalls, username)
	for k, v := range h.ActiveCalls {
		if v.Caller == username {
			delete(h.ActiveCalls, k)
		}
	}
}

// signalingMessage represents a WebRTC signaling payload sent between clients.
type signalingMessage struct {
	Type    string          `json:"type"`
	To      string          `json:"to"`
	From    string          `json:"from"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// signalingTypes lists all call-related message types that should be unicasted.
var signalingTypes = map[string]bool{
	"call_offer":     true,
	"call_answer":    true,
	"call_ice":       true,
	"call_reject":    true,
	"call_end":       true,
	"call_busy":      true,
	"call_cancelled": true,
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(1024 * 1024)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, rawMsg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		// Attempt to parse as a signaling message and route it
		var sig signalingMessage
		if jsonErr := json.Unmarshal(rawMsg, &sig); jsonErr == nil && signalingTypes[sig.Type] {
			// Always stamp the real sender to prevent spoofing
			sig.From = c.Username
			stamped, marshalErr := json.Marshal(sig)
			if marshalErr == nil && sig.To != "" {
				recipientOnline := c.Hub.SendToUser(sig.To, stamped)

				// Track Active Calls & Trigger Web Push Notifications
				if sig.Type == "call_offer" {
					c.Hub.mu.Lock()
					c.Hub.ActiveCalls[sig.To] = &ActiveCall{
						Caller:    sig.From,
						Receiver:  sig.To,
						SDPOffer:  sig.Payload,
						Timestamp: time.Now(),
					}
					c.Hub.mu.Unlock()

					// Send push notification to target
					go triggerWebPushCallNotification(sig.From, sig.To, sig.Type, sig.Payload)
				} else if sig.Type == "call_cancelled" || sig.Type == "call_end" || sig.Type == "call_reject" || sig.Type == "call_busy" {
					c.Hub.ClearActiveCall(sig.From)
					c.Hub.ClearActiveCall(sig.To)

					// If cancelled or ended by caller, send push to overwrite ringing banner with missed call
					if sig.Type == "call_cancelled" || sig.Type == "call_end" {
						go triggerWebPushCallNotification(sig.From, sig.To, sig.Type, sig.Payload)
					}
				}

				if !recipientOnline {
					// Target user is offline — send a "not_available" response back to caller
					notAvail, _ := json.Marshal(map[string]interface{}{
						"type":    "call_not_available",
						"from":    sig.To,
						"payload": map[string]string{"reason": "User is offline"},
					})
					select {
					case c.Send <- notAvail:
					default:
					}
				}
			}
		}
		// Non-signaling messages (regular chat) are NOT re-broadcast from here;
		// the REST API handles chat message persistence and broadcasting.
	}
}

// ServeWs upgrades the HTTP connection to WebSocket and registers the client.
// It expects the gin context to already contain "userName" (set by AuthMiddleware).
func ServeWs(c *gin.Context) {
	if HubGlobal == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "message": "WebSocket service unavailable"})
		return
	}
	conn, err := Upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		c.Error(err)
		return
	}

	// Extract the authenticated username set by AuthMiddleware
	username, _ := c.Get("userName")
	usernameStr, _ := username.(string)

	client := &Client{
		Hub:      HubGlobal,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Username: usernameStr,
	}
	client.Hub.Register <- client
	go client.WritePump()
	go client.ReadPump()

	// Send current system version immediately upon connection to check for updates
	version := os.Getenv("SYSTEM_VERSION")
	if version == "" {
		version = "1.1.0"
	}
	sysInfo, _ := json.Marshal(map[string]interface{}{
		"type":    "system_info",
		"version": version,
	})
	client.Send <- sysInfo
}
