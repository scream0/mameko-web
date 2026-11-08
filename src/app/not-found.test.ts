import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const notFoundConfig = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/ui/notFoundConfig.json"),
    "utf-8"
  )
);

describe("NotFound 404 Module Integrity", () => {
  it("notFoundConfig has all mandatory fields", () => {
    assert.ok(notFoundConfig.badge, "Badge is required");
    assert.equal(notFoundConfig.content.errorCode, "404", "Error code must be 404");
    assert.ok(notFoundConfig.content.title, "Title is required");
    assert.ok(notFoundConfig.content.description, "Description is required");
    assert.ok(Array.isArray(notFoundConfig.quotes), "Quotes must be an array");
    assert.ok(notFoundConfig.quotes.length > 0, "Must have at least one quote");
    assert.ok(notFoundConfig.buttons.backHome, "backHome button label is required");
    assert.ok(notFoundConfig.buttons.exploreProducts, "exploreProducts button label is required");
    assert.ok(notFoundConfig.buttons.homeHref, "homeHref is required");
    assert.ok(notFoundConfig.buttons.exploreHref, "exploreHref is required");
  });
});

