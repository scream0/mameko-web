import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const maintenanceConfig = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/ui/maintenanceConfig.json"),
    "utf-8"
  )
);

const settingsConfig = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/ui/settingsConfig.json"),
    "utf-8"
  )
);

describe("Maintenance Module Integrity", () => {
  it("maintenanceConfig has all mandatory fields", () => {
    assert.ok(maintenanceConfig.badge, "Badge is required");
    assert.ok(maintenanceConfig.title, "Title is required");
    assert.ok(maintenanceConfig.subtitle, "Subtitle is required");
    assert.ok(maintenanceConfig.description, "Description is required");
    assert.ok(maintenanceConfig.timer.countdownTemplate, "Countdown template is required");
    assert.ok(maintenanceConfig.buttons.checkStatus, "Check status button label is required");
    assert.ok(maintenanceConfig.support.whatsappUrl, "WhatsApp support URL is required");
    assert.ok(maintenanceConfig.support.whatsappNumber, "WhatsApp support number is required");
  });

  it("settingsConfig has all store maintenance fields", () => {
    const store = settingsConfig.store;
    assert.ok(store.maintenanceSectionTitle, "Store maintenance section title is required");
    assert.ok(store.maintenanceToggleLabel, "Store maintenance toggle label is required");
    assert.ok(store.maintenanceStatusActive, "Store maintenance active status badge is required");
    assert.ok(store.maintenanceStatusInactive, "Store maintenance inactive status badge is required");
    assert.ok(store.maintenanceTitleLabel, "Store maintenance title label is required");
    assert.ok(store.maintenanceMessageLabel, "Store maintenance message label is required");
    assert.ok(store.maintenanceAdminBypassNotice, "Store maintenance admin bypass notice is required");
  });

  it("evaluates health status codes correctly", () => {
    const isMaintenanceStatus = (code: number) => code === 502 || code === 503 || code === 504;

    assert.equal(isMaintenanceStatus(502), true, "502 is maintenance/bad gateway");
    assert.equal(isMaintenanceStatus(503), true, "503 is maintenance/service unavailable");
    assert.equal(isMaintenanceStatus(504), true, "504 is maintenance/gateway timeout");
    assert.equal(isMaintenanceStatus(200), false, "200 is healthy");
    assert.equal(isMaintenanceStatus(404), false, "404 is not server maintenance");
  });
});
