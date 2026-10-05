/**
 * Office clock is Arizona. Client clocks come from state and ZIP.
 * Run: npx tsx scripts/test-timezones.ts
 */
import assert from "node:assert/strict";
import { timeZoneForClient } from "../lib/time/client-timezone";
import { OFFICE_TZ } from "../lib/time/office";
import { formatZonedClock, utcToWall, wallTimeToUtc } from "../lib/time/zoned";

const winter = wallTimeToUtc("2026-01-15", "14:00", OFFICE_TZ);
assert.ok(winter);
assert.equal(winter.toISOString(), "2026-01-15T21:00:00.000Z");
assert.equal(formatZonedClock(winter, "America/New_York"), "4:00 PM EST");

const summer = wallTimeToUtc("2026-07-15", "14:00", OFFICE_TZ);
assert.ok(summer);
assert.equal(summer.toISOString(), "2026-07-15T21:00:00.000Z");
assert.equal(formatZonedClock(summer, "America/New_York"), "5:00 PM EDT");
assert.equal(formatZonedClock(summer, OFFICE_TZ), "2:00 PM MST");

const roundTrip = utcToWall(summer, OFFICE_TZ);
assert.deepEqual(roundTrip, { ymd: "2026-07-15", hm: "14:00" });

assert.equal(timeZoneForClient("Florida", "33101")?.timeZone, "America/New_York");
assert.equal(timeZoneForClient("FL", "32501")?.timeZone, "America/Chicago");
assert.equal(timeZoneForClient("AZ", "85001")?.timeZone, "America/Phoenix");
assert.equal(timeZoneForClient("Arizona", "86503")?.timeZone, "America/Denver");
assert.equal(timeZoneForClient("TX", "79901")?.timeZone, "America/Denver");
assert.equal(timeZoneForClient("TX", "75201")?.timeZone, "America/Chicago");
assert.equal(timeZoneForClient("NY", null)?.label, "Eastern");
assert.equal(timeZoneForClient("", "10001"), null);

console.log("timezone checks passed");
