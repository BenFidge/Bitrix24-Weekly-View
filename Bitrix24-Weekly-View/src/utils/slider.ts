import { bitrix24Api } from "../services/bitrix24Api";
import { toDateValue } from "./date";

/**
 * Centralized helper for opening this app in a Bitrix24 SidePanel slider.
 * - Responsive width: 95% on small screens, max 700px on desktop
 * - Height is locked via CSS when IFRAME_TYPE=SIDE_SLIDER (see src/styles/side-slider.css)
 */
export function openBookingCreateSlider(resourceId: number, day: Date): Promise<void> {
  return bitrix24Api.openApplicationInSlider({
    view: "booking-create",
    date: toDateValue(day),
    resourceId: String(resourceId),
  });
}

export function openBookingEditSlider(bookingId: number | string): Promise<void> {
  return bitrix24Api.openApplicationInSlider({
    view: "booking-edit",
    bookingId: String(bookingId),
  });
}

export function isSideSlider(): boolean {
  const qs = new URLSearchParams(window.location.search);
  return qs.get("IFRAME_TYPE") === "SIDE_SLIDER" || qs.get("IFRAME") === "Y";
}
