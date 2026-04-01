package main

import (
	"fmt"
	"strings"
	"unicode"
)

func mapToDBColumn(key string) string {
	specialCases := map[string]string{
		"Order ID":                  "order_id",
		"Discount ($)":              "discount_usd",
		"Total Product Cost ($)":    "total_product_cost",
		"Shipping Fee (Customer)":   "shipping_fee_customer",
		"Products":                  "products_json",
		"Products (JSON)":           "products_json",
		"Telegram Message ID 1":     "telegram_message_id1",
		"Telegram Message ID 2":     "telegram_message_id2",
		"Customer Name":             "customer_name",
		"Customer Phone":            "customer_phone",
		"Location":                  "location",
		"Address Details":           "address_details",
		"Fulfillment Status":        "fulfillment_status",
		"Fulfillment Store":         "fulfillment_store",
		"Internal Shipping Method":  "internal_shipping_method",
		"Internal Shipping Details": "internal_shipping_details",
		"Internal Cost":             "internal_cost",
		"Payment Status":            "payment_status",
		"Payment Info":              "payment_info",
		"Scheduled Time":            "scheduled_time",
		"Delivery Unpaid":           "delivery_unpaid",
		"Delivery Paid":             "delivery_paid",
		"Package Photo":             "package_photo_url",
		"Package Photo URL":         "package_photo_url",
		"Delivery Photo":            "delivery_photo_url",
		"Delivery Photo URL":        "delivery_photo_url",
		"Driver Name":               "driver_name",
		"Tracking Number":           "tracking_number",
		"Dispatched Time":           "dispatched_time",
		"Dispatched By":             "dispatched_by",
		"Delivered Time":            "delivered_time",
		"Packed By":                 "packed_by",
		"Packed Time":               "packed_time",
		"IsVerified":                "is_verified",
		"UserName":                  "user_name",
		"FullName":                  "full_name",
		"ProfilePictureURL":         "profile_picture_url",
		"IsSystemAdmin":             "is_system_admin",
		"TelegramUsername":          "telegram_username",
		"ImageURL":                  "image_url",
		"Image URL":                 "image_url",
		"LogosURL":                  "logo_url",
		"Logos URL":                 "logo_url",
		"LogoURL":                   "logo_url",
		"Thumbnail":                 "thumbnail",
		"Thumbnail URL":             "thumbnail",
		"ID":                        "id",
		"Key":                       "config_key",
		"Value":                     "config_value",
		"Description":               "description",
	}

	for k, v := range specialCases {
		if strings.EqualFold(k, key) {
			return v
		}
	}

	var res []rune
	for i, r := range key {
		if i > 0 && (unicode.IsUpper(r) || r == ' ' || r == '(' || r == ')') {
			if len(res) > 0 && res[len(res)-1] != '_' {
				res = append(res, '_')
			}
		}
		if r != ' ' && r != '(' && r != ')' && r != '$' {
			res = append(res, unicode.ToLower(r))
		}
	}
	return string(res)
}

func main() {
	keys := []string{"Fulfillment Status", "Packed By", "Packed Time", "Package Photo URL"}
	for _, k := range keys {
		fmt.Printf("'%s' -> '%s'\n", k, mapToDBColumn(k))
	}
}
