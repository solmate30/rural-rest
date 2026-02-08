# 03. Storage Policy (Cloudinary)
> Created: 2026-02-07 17:32
> Last Updated: 2026-02-08 21:30

## 1. Overview
We use **Cloudinary** for storing and serving images. This ensures optimized delivery (WebP, auto-resize) and secure uploads without burdening our server.

## 2. Folder Structure
*   **Root Folder**: `rural-rest-v2/`
    *   `listings/`
        *   `{listing_id}/` (e.g., `listing-uuid-123/`)
            *   `hero.jpg`
            *   `kitchen.jpg`
    *   `users/`
        *   `{user_id}/` (e.g., `user-uuid-abc/`)
            *   `avatar.jpg`

## 3. Upload Policy (Security)
To prevent unauthorized uploads, we use **Signed Uploads**.

### 3.1. Flow
1.  **Client**: Request a signature from server (`/api/sign-cloudinary`).
2.  **Server**: Generate signature using API Secret (check `host` role).
3.  **Client**: Direct upload to Cloudinary using the signature.
4.  **Client**: Send the returned `secure_url` to our server to save in DB.

### 3.2. Presets (Transformations)
*   **Listing Images (`listing_preset`)**:
    *   **Format**: `f_auto` (WebP/AVIF automatically)
    *   **Quality**: `q_auto` (Balance quality/size)
    *   **Resize**: `w_1200, c_limit` (Max width 1200px)
*   **Avatar Images (`avatar_preset`)**:
    *   **Format**: `f_auto`
    *   **Resize**: `w_200, h_200, c_fill, g_face` (Crop to face)

## 4. Deletion Policy
*   When a listing or user is deleted from DB, a trigger (or Action) must call Cloudinary Admin API to delete the associated folder.

## 5. Related Documents
- **Specs**: [Cloudinary Implementation Guide](./05_CLOUDINARY_IMPLEMENTATION_GUIDE.md) - 본 정책의 코드 수준 구현 가이드
- **Specs**: [Database Schema](./01_DB_SCHEMA.md) - `listings.images` 및 `user.image` 필드 참조
- **Specs**: [API Specs](./02_API_SPECS.md) - 이미지 업로드 API 엔드포인트 명세
