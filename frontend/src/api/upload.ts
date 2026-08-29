import { Platform } from "react-native";
import { getToken } from "@/src/api/client";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

/** Upload a local image and return the stored storage path. */
export async function uploadImage(uri: string): Promise<string> {
  const token = await getToken();
  const name = `photo_${Date.now()}.jpg`;
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    // React Native multipart file shape
    form.append("file", { uri, name, type: "image/jpeg" } as any);
  }
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // never set Content-Type manually
    body: form,
  });
  if (!res.ok) {
    let msg = "Upload failed. Please try again.";
    try {
      const data = await res.json();
      if (data?.detail) msg = data.detail;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.path as string;
}

/** Build an authenticated URL to display a stored file (works on web + native). */
export function fileUrl(path: string | null | undefined, token: string | null): string | null {
  if (!path || !token) return null;
  return `${BASE}/files/${path}?token=${encodeURIComponent(token)}`;
}
