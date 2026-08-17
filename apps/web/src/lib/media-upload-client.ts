export type UploadedMedia = {
  key: string;
  url: string;
};

type MediaUploadResponse = {
  data?: UploadedMedia[];
  message?: string;
};

export function uploadMediaFile(
  file: File,
  onProgress?: (percent: number) => void,
) {
  const formData = new FormData();
  formData.append("files", file);

  return new Promise<UploadedMedia>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", "/api/uploads/media");
    request.responseType = "json";
    request.timeout = 60_000;
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(
        Math.min(99, Math.round((event.loaded / event.total) * 100)),
      );
    });
    request.addEventListener("load", () => {
      const result = request.response as MediaUploadResponse | null;
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result?.message || "Không thể tải media."));
        return;
      }

      const uploaded = result?.data?.[0];
      if (!uploaded?.url) {
        reject(new Error("Máy chủ không trả về media vừa tải."));
        return;
      }

      onProgress?.(100);
      resolve(uploaded);
    });
    request.addEventListener("error", () =>
      reject(new Error("Mất kết nối khi tải media.")),
    );
    request.addEventListener("timeout", () =>
      reject(new Error("Tải media quá thời gian. Hãy thử lại.")),
    );
    request.send(formData);
  });
}
