package backend

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// UploadToR2 uploads data to Cloudflare R2 and returns the public URL.
func UploadToR2(data []byte, fileName string, mimeType string) (string, error) {
	// 1. Resolve Credentials
	accountID := os.Getenv("R2_ACCOUNT_ID")
	if accountID == "" {
		accountID = "8f4611ace3d8278c742730a7fe8e4c30" // User provided default
	}
	accessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
	accessKeySecret := os.Getenv("R2_SECRET_ACCESS_KEY")
	bucketName := os.Getenv("R2_BUCKET_NAME")
	if bucketName == "" {
		bucketName = "maff-media" // User provided default
	}

	if accessKeyID == "" || accessKeySecret == "" {
		return "", fmt.Errorf("R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY not set in environment")
	}

	// 2. Configure R2 Resolver
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
		return "", fmt.Errorf("failed to load R2 config: %v", err)
	}

	client := s3.NewFromConfig(cfg)

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

	// 5. Construct Public URL
	publicURLBase := os.Getenv("R2_PUBLIC_URL")
	if publicURLBase == "" {
		// Default to a structure that often works if public access is enabled via R2 dev URL or similar
		// But note: most R2 buckets require a custom domain for public access.
		return fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s", accountID, bucketName, key), nil
	}

	return fmt.Sprintf("%s/%s", strings.TrimSuffix(publicURLBase, "/"), key), nil
}
