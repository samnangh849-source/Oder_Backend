package backend

import (
	"encoding/json"
	"log"
	"net/http"
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
	// For production on Render, we might want to be more specific,
	// but 1006 errors are often caused by CheckOrigin failing due to proxy headers.
	// Allowing all origins is the most compatible default for a multi-platform app.
	return true
}

type Client struct {
	Hub  *Hub
	Conn *websocket.Conn
	Send chan []byte
}

type Hub struct {
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
	quit       chan struct{}
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan []byte, 4096), // Buffered to prevent blocking
		Register:   make(chan *Client, 128),
		Unregister: make(chan *Client, 128),
		Clients:    make(map[*Client]bool),
		quit:       make(chan struct{}),
	}
}

func (h *Hub) Run() {
	log.Println("🚀 WebSocket Hub is running...")
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
			log.Printf("🔌 Client connected. Total: %d", len(h.Clients))
		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				log.Printf("🔌 Client disconnected. Total: %d", len(h.Clients))
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

// BroadcastJSON is a helper to broadcast structured data
func (h *Hub) BroadcastJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("❌ Hub: Failed to marshal JSON for broadcast: %v", err)
		return
	}
	h.Broadcast <- data
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
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

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
	client := &Client{Hub: HubGlobal, Conn: conn, Send: make(chan []byte, 256)}
	client.Hub.Register <- client
	go client.WritePump()
	go client.ReadPump()
}
