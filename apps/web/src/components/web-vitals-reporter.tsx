import type { Metric } from "web-vitals";
import { isPublicWebVitalPath } from "@rem-viet/cms";
import { useEffect } from "react";

type WebVitalsReporterProps = {
  sampleRate: number;
};

const samplingKey = "rem-viet:rum-sampled:v1";

function isSampled(sampleRate: number) {
  const boundedRate = Math.min(1, Math.max(0, sampleRate));
  try {
    const existing = sessionStorage.getItem(samplingKey);
    if (existing === "1") return true;
    if (existing === "0") return false;
    const sampled = Math.random() < boundedRate;
    sessionStorage.setItem(samplingKey, sampled ? "1" : "0");
    return sampled;
  } catch {
    return Math.random() < boundedRate;
  }
}

function getDeviceClass() {
  if (window.innerWidth < 768) return "mobile" as const;
  if (window.innerWidth < 1_024) return "tablet" as const;
  return "desktop" as const;
}

function sendMetric(metric: Metric, path: string, deviceClass: string) {
  if (metric.name !== "CLS" && metric.name !== "LCP" && metric.name !== "INP") {
    return;
  }
  const body = JSON.stringify({
    schemaVersion: 1,
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    path,
    deviceClass,
  });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/vitals", blob)) return;
  void fetch("/api/vitals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function WebVitalsReporter({ sampleRate }: WebVitalsReporterProps) {
  useEffect(() => {
    if (sampleRate <= 0 || navigator.webdriver || !isSampled(sampleRate)) {
      return;
    }
    const path = window.location.pathname;
    if (!isPublicWebVitalPath(path)) return;
    const deviceClass = getDeviceClass();
    void import("web-vitals")
      .then(({ onCLS, onINP, onLCP }) => {
        const report = (metric: Metric) =>
          sendMetric(metric, path, deviceClass);
        onCLS(report);
        onLCP(report);
        onINP(report);
      })
      .catch(() => undefined);
  }, [sampleRate]);

  return null;
}
