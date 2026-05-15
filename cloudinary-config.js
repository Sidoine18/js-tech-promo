// ============================================================
// cloudinary-config.js — JS TECH Media Cloud
// Handles: profile photos, post images, chat files, audio, video
// ============================================================

export const CLOUDINARY = {
  cloudName:  'jstech2026',          // Your cloud name
  apiKey:     '996788953141324',
  // NOTE: API Secret must NEVER be exposed client-side.
  // Use unsigned upload preset or a signed URL from your backend.
  uploadPreset: 'jst_unsigned',      // Create this preset in Cloudinary dashboard (unsigned)
  uploadUrl:  'https://api.cloudinary.com/v1_1/jstech2026/upload'
};

// ── Upload a file to Cloudinary (unsigned) ──────────────────
// Returns: { url, publicId, resourceType, format, bytes }
export async function uploadToCloudinary(file, folder = 'jst-general', onProgress = null) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY.uploadPreset);
    fd.append('folder', `js-tech/${folder}`);

    // Resource type
    const rType = file.type.startsWith('video') ? 'video'
                : file.type.startsWith('audio') ? 'video'   // Cloudinary handles audio under "video"
                : 'image';
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/${rType}/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url:          data.secure_url,
          publicId:     data.public_id,
          resourceType: data.resource_type,
          format:       data.format,
          bytes:        data.bytes,
          width:        data.width,
          height:       data.height,
          duration:     data.duration
        });
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.status} — ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}

// ── Get optimized URL from Cloudinary ───────────────────────
export function getOptimizedUrl(publicId, opts = {}) {
  const { w = 400, h = 400, crop = 'fill', quality = 'auto', format = 'auto' } = opts;
  return `https://res.cloudinary.com/${CLOUDINARY.cloudName}/image/upload/w_${w},h_${h},c_${crop},q_${quality},f_${format}/${publicId}`;
}

// ── Delete from Cloudinary (needs backend/signed) ───────────
// This is a placeholder — implement server-side for security
export async function deleteFromCloudinary(publicId) {
  console.warn('deleteFromCloudinary: Implement server-side for security.', publicId);
}
