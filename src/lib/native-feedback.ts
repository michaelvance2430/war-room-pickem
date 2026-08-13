import { isWarRoomNative } from "@/lib/native-contract";

export async function nativeSuccessFeedback(): Promise<void> {
  if (!isWarRoomNative()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Feedback is enhancement-only; never interrupt a pick or invite action.
  }
}

export async function nativeSelectionFeedback(): Promise<void> {
  if (!isWarRoomNative()) return;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    // Simulator and unsupported devices may not provide a haptic engine.
  }
}
