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
