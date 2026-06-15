package backend

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
)

// getR2Client initializes and returns an S3 client for Cloudflare R2
func getR2Client() (*s3.Client, string, error) {
	accountID := os.Getenv("R2_ACCOUNT_ID")
	if accountID == "" {
		accountID = "8f4611ace3d8278c742730a7fe8e4c30" // User provided default
	}
	accessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
	accessKeySecret := os.Getenv("R2_SECRET_ACCESS_KEY")
	bucketName := strings.TrimSpace(os.Getenv("R2_BUCKET_NAME"))
	if bucketName == "" {
		bucketName = "maff-media"
	}

	if accessKeyID == "" || accessKeySecret == "" {
		return nil, bucketName, fmt.Errorf("R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY not set")
	}

	r2Resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:           fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID),
			SigningRegion: "auto",
		}, nil
	})

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithEndpointResolverWithOptions(r2Resolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, accessKeySecret, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		return nil, bucketName, fmt.Errorf("failed to load R2 config: %v", err)
	}

	return s3.NewFromConfig(cfg), bucketName, nil
}

// UploadToR2 uploads data to Cloudflare R2 and returns a special r2:// URL.
func UploadToR2(data []byte, fileName string, mimeType string) (string, error) {
	client, bucketName, err := getR2Client()
	if err != nil {
		return "", err
	}

	// 3. Generate FileName if missing
	if fileName == "" {
		fileName = fmt.Sprintf("%d", time.Now().UnixNano())
	} else {
		// Clean filename for R2/S3 compatibility
		fileName = strings.ReplaceAll(fileName, " ", "_")
	}

	// Organize in a folder
	key := "promotions/" + fileName

	// 4. Perform Upload
	log.Printf("📤 [R2 Upload] Starting upload: bucket=%s key=%s mime=%s", bucketName, key, mimeType)
	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(mimeType),
	})
	if err != nil {
		log.Printf("❌ [R2 Upload] Failed: %v", err)
		return "", fmt.Errorf("failed to upload to R2: %v", err)
	}

	// Return a custom r2 prefix so the frontend can route it to our proxy
	return fmt.Sprintf("r2://%s", key), nil
}

// HandleR2Proxy fetches an image from R2 using internal credentials and returns it to the client.
// GET /api/r2-proxy?key=<encoded-r2-key>
func HandleR2Proxy(c *gin.Context) {
	key := c.Query("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "key parameter required"})
		return
	}

	client, bucketName, err := getR2Client()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "R2 not configured"})
		return
	}

	out, err := client.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		log.Printf("❌ [R2 Proxy] GetObject failed for key %s: %v", key, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	defer out.Body.Close()

	// Determine content type
	contentType := "application/octet-stream"
	if out.ContentType != nil {
		contentType = *out.ContentType
	}

	// If content type is generic, infer from extension
	if contentType == "application/octet-stream" || contentType == "binary/octet-stream" {
		ext := strings.ToLower(filepath.Ext(key))
		switch ext {
		case ".jpg", ".jpeg":
			contentType = "image/jpeg"
		case ".png":
			contentType = "image/png"
		case ".webp":
			contentType = "image/webp"
		case ".gif":
			contentType = "image/gif"
		}
	}

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=3600")
	if out.ContentLength != nil {
		c.Header("Content-Length", fmt.Sprintf("%d", *out.ContentLength))
	}

	// Stream the body directly to the client
	io.Copy(c.Writer, out.Body)
}
