# 05. Cloudinary Implementation Guide
> Created: 2026-02-08 21:30
> Last Updated: 2026-02-08 21:30

본 문서는 `03_STORAGE_POLICY.md`에 정의된 이미지 저장 정책을 코드 수준에서 구현하기 위한 상세 가이드이다.

## 1. Overview

### 1.1. 구현 범위
- **Listing 이미지**: 호스트가 숙소 등록/편집 시 업로드 (다중 이미지)
- **사용자 아바타**: 프로필 이미지 업로드 (단일 이미지)

### 1.2. 기술 선택
- **SDK**: `cloudinary` Node.js SDK (v2)
- **업로드 방식**: Signed Upload (서버에서 서명 생성, 클라이언트에서 직접 업로드)
- **저장소**: Cloudinary CDN (WebP/AVIF 자동 변환)

### 1.3. 업로드 흐름 요약

```
[Client]                    [Server]                  [Cloudinary]
   |                           |                           |
   |-- 1. POST /api/sign ----->|                           |
   |                           |-- 서명 생성 (API Secret) -->|
   |<-- 2. {signature, ts} ----|                           |
   |                           |                           |
   |-- 3. Direct Upload (signature + file) --------------->|
   |                           |                           |
   |<-- 4. {secure_url, public_id} ------------------------|
   |                           |                           |
   |-- 5. POST /admin/edit --->| (secure_url을 DB에 저장)   |
```

## 2. 패키지 설치

```bash
cd rural-rest-v2
npm install cloudinary
```

`package.json` 추가 항목:
```json
{
  "dependencies": {
    "cloudinary": "^2.6.0"
  }
}
```

## 3. 환경 변수 설정

### 3.1. `.env` 파일 (로컬 개발)

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3.2. 환경 변수 취득 경로
1. Cloudinary Dashboard (https://console.cloudinary.com) 로그인
2. Dashboard > "Product Environment Credentials" 섹션에서 확인
3. Vercel 배포 시: Vercel Dashboard > Settings > Environment Variables에 동일하게 등록

## 4. 서버 유틸리티

### 4.1. Cloudinary 설정 (`app/lib/cloudinary.server.ts`)

```typescript
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * 서명 업로드를 위한 파라미터 생성
 * @param folder - 업로드 대상 폴더 (e.g., "rural-rest-v2/listings/{id}")
 * @param preset - 변환 프리셋 이름
 */
export function generateSignedParams(folder: string, preset?: string) {
  const timestamp = Math.round(Date.now() / 1000);

  const params: Record<string, string | number> = {
    timestamp,
    folder,
  };

  if (preset) {
    params.upload_preset = preset;
  }

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
    ...(preset && { uploadPreset: preset }),
  };
}

/**
 * Cloudinary 이미지 삭제
 * @param publicId - 삭제 대상 이미지의 public_id
 */
export async function deleteImage(publicId: string) {
  return cloudinary.uploader.destroy(publicId);
}

/**
 * 폴더 내 모든 이미지 삭제 (리스팅/사용자 삭제 시)
 * @param folder - 삭제 대상 폴더 경로
 */
export async function deleteFolder(folder: string) {
  // 폴더 내 리소스 먼저 삭제
  const { resources } = await cloudinary.api.resources({
    type: "upload",
    prefix: folder,
    max_results: 100,
  });

  if (resources.length > 0) {
    const publicIds = resources.map(
      (r: { public_id: string }) => r.public_id
    );
    await cloudinary.api.delete_resources(publicIds);
  }

  // 빈 폴더 삭제
  await cloudinary.api.delete_folder(folder);
}
```

### 4.2. 서명 API 라우트 (`app/routes/api.sign-cloudinary.ts`)

```typescript
import type { Route } from "./+types/api.sign-cloudinary";
import { requireUser } from "~/lib/auth.server";
import { generateSignedParams } from "~/lib/cloudinary.server";

/**
 * POST /api/sign-cloudinary
 * Body: { type: "listing" | "avatar", listingId?: string }
 *
 * Listing 이미지: host/admin만 접근 가능
 * Avatar: 모든 로그인 사용자 접근 가능
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  const body = await request.json();
  const { type, listingId } = body as {
    type: "listing" | "avatar";
    listingId?: string;
  };

  let folder: string;
  let preset: string | undefined;

  switch (type) {
    case "listing": {
      // 호스트/관리자만 리스팅 이미지 업로드 가능
      if (!["host", "admin"].includes((user as any).role)) {
        return new Response("Forbidden", { status: 403 });
      }
      if (!listingId) {
        return Response.json(
          { error: "listingId is required" },
          { status: 400 }
        );
      }
      folder = `rural-rest-v2/listings/${listingId}`;
      preset = "listing_preset";
      break;
    }
    case "avatar": {
      folder = `rural-rest-v2/users/${user.id}`;
      preset = "avatar_preset";
      break;
    }
    default:
      return Response.json(
        { error: "Invalid type" },
        { status: 400 }
      );
  }

  const params = generateSignedParams(folder, preset);
  return Response.json(params);
}
```

### 4.3. React Router 라우트 등록 (`app/routes.ts`)

```typescript
// 기존 라우트에 추가
route("api/sign-cloudinary", "routes/api.sign-cloudinary.ts"),
```

## 5. Cloudinary Upload Preset 설정

Cloudinary Dashboard에서 사전 설정이 필요하다.

### 5.1. `listing_preset` (Listing 이미지용)

| 항목 | 값 |
|:---|:---|
| Preset Name | `listing_preset` |
| Signing Mode | Signed |
| Format | `f_auto` (WebP/AVIF 자동) |
| Quality | `q_auto` |
| Resize | `c_limit, w_1200` (최대 1200px) |
| Allowed Formats | jpg, png, webp |

### 5.2. `avatar_preset` (아바타용)

| 항목 | 값 |
|:---|:---|
| Preset Name | `avatar_preset` |
| Signing Mode | Signed |
| Format | `f_auto` |
| Resize | `c_fill, w_200, h_200, g_face` (얼굴 중심 크롭) |
| Allowed Formats | jpg, png, webp |

설정 경로: Cloudinary Dashboard > Settings > Upload > Upload presets > Add preset

## 6. 클라이언트 구현

### 6.1. 업로드 훅 (`app/hooks/use-cloudinary-upload.ts`)

```typescript
import { useState } from "react";

interface UploadResult {
  secureUrl: string;
  publicId: string;
}

interface UseCloudinaryUploadOptions {
  type: "listing" | "avatar";
  listingId?: string;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

export function useCloudinaryUpload(options: UseCloudinaryUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function upload(file: File): Promise<UploadResult | null> {
    setIsUploading(true);
    setProgress(0);

    try {
      // 1. 서버에서 서명 획득
      const signRes = await fetch("/api/sign-cloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: options.type,
          listingId: options.listingId,
        }),
      });

      if (!signRes.ok) {
        throw new Error("서명 생성에 실패했습니다.");
      }

      const {
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder,
        uploadPreset,
      } = await signRes.json();

      // 2. Cloudinary에 직접 업로드
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);
      if (uploadPreset) {
        formData.append("upload_preset", uploadPreset);
      }

      const uploadRes = await new Promise<UploadResult>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
          );

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              resolve({
                secureUrl: data.secure_url,
                publicId: data.public_id,
              });
            } else {
              reject(new Error("업로드에 실패했습니다."));
            }
          };

          xhr.onerror = () => reject(new Error("네트워크 오류"));
          xhr.send(formData);
        }
      );

      options.onSuccess?.(uploadRes);
      return uploadRes;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류";
      options.onError?.(message);
      return null;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }

  return { upload, isUploading, progress };
}
```

### 6.2. 사용 예시: Listing Photo Manager (admin.edit 라우트)

```typescript
// admin.edit.tsx 내부에서
const { upload, isUploading, progress } = useCloudinaryUpload({
  type: "listing",
  listingId: listing.id,
  onSuccess: (result) => {
    // 업로드된 URL을 이미지 목록에 추가
    setImages((prev) => [...prev, result.secureUrl]);
  },
  onError: (error) => {
    toast({ title: "업로드 실패", description: error, variant: "destructive" });
  },
});

// 파일 선택 핸들러
function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const files = e.target.files;
  if (!files) return;
  Array.from(files).forEach((file) => upload(file));
}
```

### 6.3. 사용 예시: Avatar Upload (프로필 설정)

```typescript
const { upload, isUploading } = useCloudinaryUpload({
  type: "avatar",
  onSuccess: async (result) => {
    // 서버에 아바타 URL 업데이트 요청
    await fetch("/api/profile", {
      method: "POST",
      body: JSON.stringify({ image: result.secureUrl }),
    });
  },
});
```

## 7. DB 연동

### 7.1. Listing 이미지 저장

`listings.images` 필드에 JSON 배열로 저장한다 (기존 스키마 활용).

```typescript
// action 내부 (admin.edit 라우트)
import { db } from "~/db/index.server";
import { listings } from "~/db/schema";
import { eq } from "drizzle-orm";

// images: string[] (Cloudinary secure_url 배열)
await db
  .update(listings)
  .set({ images: JSON.stringify(images) })
  .where(eq(listings.id, listingId));
```

### 7.2. 아바타 URL 저장

`user.image` 필드에 단일 URL로 저장한다.

```typescript
import { user } from "~/db/schema";

await db
  .update(user)
  .set({ image: secureUrl })
  .where(eq(user.id, userId));
```

## 8. 이미지 삭제 처리

### 8.1. 개별 이미지 삭제 (Listing 편집 시)

```typescript
// action 내부
import { deleteImage } from "~/lib/cloudinary.server";

// public_id는 URL에서 추출하거나 별도 저장
// 예: "rural-rest-v2/listings/abc123/hero" 형태
await deleteImage(publicId);
```

### 8.2. Listing 삭제 시 전체 이미지 삭제

```typescript
import { deleteFolder } from "~/lib/cloudinary.server";

// Listing 삭제 action에서
await deleteFolder(`rural-rest-v2/listings/${listingId}`);
await db.delete(listings).where(eq(listings.id, listingId));
```

## 9. 보안 고려사항

| 항목 | 대책 |
|:---|:---|
| **무단 업로드 방지** | 서명 API에서 `requireUser` + 역할 검증 (listing은 host/admin만) |
| **파일 크기 제한** | Cloudinary Upload Preset에서 `max_file_size: 10MB` 설정 |
| **파일 형식 제한** | Preset에서 `allowed_formats: jpg, png, webp`만 허용 |
| **API Secret 노출 방지** | Secret은 서버 측에서만 사용. 클라이언트에는 서명만 전달 |
| **서명 재사용 방지** | timestamp 기반 서명으로 시간 만료 (기본 1시간) |

## 10. 파일 구조 요약

구현 완료 시 추가/수정되는 파일 목록:

```
rural-rest-v2/
  app/
    lib/
      cloudinary.server.ts    # [신규] Cloudinary 설정 및 유틸리티
    hooks/
      use-cloudinary-upload.ts # [신규] 클라이언트 업로드 훅
    routes/
      api.sign-cloudinary.ts   # [신규] 서명 API 라우트
      admin.edit.tsx            # [수정] Photo Manager에 업로드 기능 연결
    routes.ts                   # [수정] 서명 라우트 등록
  .env                          # [수정] Cloudinary 환경 변수 추가
  package.json                  # [수정] cloudinary 패키지 추가
```

## 11. Related Documents
- **Specs**: [Storage Policy](./03_STORAGE_POLICY.md) - 폴더 구조, 프리셋, 삭제 정책 원본
- **Specs**: [Database Schema](./01_DB_SCHEMA.md) - `listings.images`, `user.image` 필드 참조
- **Specs**: [API Specs](./02_API_SPECS.md) - 라우트 패턴 및 에러 처리 가이드라인
- **Specs**: [Admin Management Spec](./04_ADMIN_MANAGEMENT_SPEC.md) - 호스트 리스팅 편집 기능 명세
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 시스템 가이드라인
- **Prototype**: [Admin Editor Review](../02_Prototype/05_ADMIN_EDITOR_REVIEW.md) - Photo Manager UI 프로토타입
- **Logic**: [Auth & Session](../04_Logic/06_AUTH_AND_SESSION_LOGIC.md) - requireUser 인증 로직
