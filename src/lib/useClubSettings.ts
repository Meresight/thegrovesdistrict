"use client";

import { useEffect, useState } from "react";
import { booking, DEFAULT_EVENT_TYPES, type FacilityEventType } from "./config";

export type LiveClubSettings = {
  regularHourlyRate: number;
  offPeakHourlyRate: number;
  memberDiscountPercent: number;
  eventHourlyRate: number;
  eventTypes: FacilityEventType[];
  currencySymbol: string;
  paymentAccountName: string;
  paymentAccountNumber: string;
  paymentQrUrl: string;
  waiverText: string;
  announcement: string;
};

const DEFAULT_SETTINGS: LiveClubSettings = {
  regularHourlyRate: booking.defaultPeakRate,
  offPeakHourlyRate: booking.defaultOffPeakRate,
  memberDiscountPercent: booking.defaultMemberDiscountPercent,
  eventHourlyRate: booking.defaultEventRate,
  eventTypes: DEFAULT_EVENT_TYPES,
  currencySymbol: booking.currencySymbol,
  paymentAccountName: "Grove District",
  paymentAccountNumber: "09509979540 (GCash / Maya)",
  paymentQrUrl: "/images/logo-mark.png",
  waiverText: "",
  announcement: "",
};

let cachedSettings: LiveClubSettings | null = null;

export function useClubSettings(): LiveClubSettings {
  const [settings, setSettings] = useState<LiveClubSettings>(cachedSettings ?? DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;

    async function fetchLatest() {
      try {
        const res = await fetch(`/api/settings?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        if (active && data?.settings) {
          const next: LiveClubSettings = {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            offPeakHourlyRate: Number(data.settings.offPeakHourlyRate ?? booking.defaultOffPeakRate),
            regularHourlyRate: Number(data.settings.regularHourlyRate ?? booking.defaultPeakRate),
            eventHourlyRate: Number(data.settings.eventHourlyRate ?? booking.defaultEventRate),
            memberDiscountPercent: Number(
              data.settings.memberDiscountPercent ?? booking.defaultMemberDiscountPercent
            ),
            eventTypes:
              Array.isArray(data.settings.eventTypes) && data.settings.eventTypes.length > 0
                ? data.settings.eventTypes
                : DEFAULT_EVENT_TYPES,
          };
          cachedSettings = next;
          setSettings(next);
        }
      } catch {}
    }

    fetchLatest();

    const onFocus = () => fetchLatest();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return settings;
}
