import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * 서명 업로드를 위한 파라미터 생성
 * @param folder - 업로드 대상 폴더 (e.g., "rural-rest/listings/{id}")
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
