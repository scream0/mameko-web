# Mameko API Contracts Reference

This document maps all Golang REST API endpoints utilized by the Mameko Android application, including request payloads, response structures, and DTO definitions.

---

## 1. Authentication & Profile

### WhatsApp OTP Request
- **Endpoint**: `POST /api/auth/send-whatsapp-otp`
- **Request**:
  ```json
  {
    "phone": "081234567890"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "OTP berhasil dikirim via WhatsApp"
  }
  ```

### WhatsApp OTP Verify
- **Endpoint**: `POST /api/auth/verify-whatsapp-otp`
- **Request**:
  ```json
  {
    "phone": "081234567890",
    "otp": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "access_token": "jwt_token...",
      "refresh_token": "refresh_token...",
      "user": {
        "id": "uuid",
        "phone": "081234567890"
      }
    }
  }
  ```

### Get User Profile
- **Endpoint**: `GET /api/user/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "user-uuid",
      "username": "karim_user",
      "full_name": "Karim User",
      "email": "user@example.com",
      "phone": "081234567890",
      "role": "user",
      "avatar_url": "https://...",
      "bank_name": "BCA",
      "bank_account_number": "1234567890",
      "bank_account_name": "Karim User"
    }
  }
  ```

### Update User Profile & Bank Account
- **Endpoint**: `POST /api/user/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Request**:
  ```json
  {
    "full_name": "Karim User",
    "bank_name": "BCA",
    "bank_account_number": "1234567890",
    "bank_account_name": "Karim User"
  }
  ```

---

## 2. Cart & Orders

### Get Cart
- **Endpoint**: `GET /api/user/cart`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "cart-item-1",
          "product_id": "prod-1",
          "title": "Mameko Oversized Tee",
          "variant_id": "var-1",
          "variant_name": "L / Black",
          "price": 189000,
          "quantity": 1,
          "stock": 15,
          "image_url": "https://..."
        }
      ],
      "subtotal": 189000
    }
  }
  ```

### Create Order (Snap Token)
- **Endpoint**: `POST /api/user/orders`
- **Headers**: `Authorization: Bearer <token>`
- **Request**:
  ```json
  {
    "items": [{ "product_id": "prod-1", "variant_id": "var-1", "quantity": 1 }],
    "shipping_address_id": "addr-1",
    "courier": "jne",
    "courier_service": "reg",
    "voucher_code": "DISC20"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "order_id": "order-uuid",
      "order_number": "ORD-20260907-001",
      "total_amount": 204000,
      "snap_token": "midtrans-snap-token-uuid",
      "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/..."
    }
  }
  ```

---

## 3. Wallet & Withdrawals

### Get Wallet
- **Endpoint**: `GET /api/user/wallet`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "balance": 250000.0,
      "transactions": [
        {
          "id": "tx-1",
          "type": "credit",
          "amount": 150000.0,
          "description": "Refund Retur ORD-20260901-003",
          "status": "completed",
          "created_at": "2026-09-02T10:00:00Z"
        }
      ]
    }
  }
  ```

### Request Withdrawal
- **Endpoint**: `POST /api/user/wallet/withdraw`
- **Request**:
  ```json
  {
    "amount": 100000.0,
    "bank_name": "BCA",
    "account_number": "1234567890",
    "account_holder": "Karim User"
  }
  ```
