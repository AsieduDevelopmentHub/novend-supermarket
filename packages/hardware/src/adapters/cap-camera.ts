import { registerPlugin } from "@capacitor/core";

type NovendCameraPlugin = {
  capturePhoto: () => Promise<{ base64: string; mimeType: string }>;
};

export const NovendCamera = registerPlugin<NovendCameraPlugin>("NovendCamera");
