/**
 * Admins appear in both department assignee lists.
 * Run: npm run test:department-members
 */
import assert from "node:assert/strict";
import {
  belongsToDepartment,
  departmentMembershipOr,
  eitherDepartmentMembershipOr,
  filterByDepartment,
} from "../lib/team/department-members";

console.log("Department membership\n");

const admin = {
  id: "admin",
  full_name: "Ada Admin",
  role: "admin",
  is_accounts: false,
  is_services: false,
};
const accountsOnly = {
  id: "am",
  full_name: "Bea",
  role: "acct_manager",
  is_accounts: true,
  is_services: false,
};
const servicesOnly = {
  id: "cs",
  full_name: "Cam",
  role: "acct_manager",
  is_accounts: false,
  is_services: true,
};
const neither = {
  id: "none",
  full_name: "Dee",
  role: "acct_manager",
  is_accounts: false,
  is_services: false,
};
const dev = {
  id: "dev",
  full_name: "Dev",
  role: "dev",
  is_accounts: false,
  is_services: false,
};

assert.equal(belongsToDepartment(admin, "is_accounts"), true);
assert.equal(belongsToDepartment(admin, "is_services"), true);
assert.equal(belongsToDepartment(accountsOnly, "is_accounts"), true);
assert.equal(belongsToDepartment(accountsOnly, "is_services"), false);
assert.equal(belongsToDepartment(servicesOnly, "is_accounts"), false);
assert.equal(belongsToDepartment(servicesOnly, "is_services"), true);
assert.equal(belongsToDepartment(dev, "is_accounts"), false);
assert.equal(belongsToDepartment(dev, "is_services"), false);

const roster = [admin, accountsOnly, servicesOnly, neither, dev];
assert.deepEqual(
  filterByDepartment(roster, "is_accounts").map((m) => m.id),
  ["admin", "am"]
);
assert.deepEqual(
  filterByDepartment(roster, "is_services").map((m) => m.id),
  ["admin", "cs"]
);
assert.deepEqual(
  filterByDepartment([neither], "is_accounts", "none").map((m) => m.id),
  ["none"]
);

assert.equal(departmentMembershipOr("is_accounts"), "is_accounts.eq.true,role.eq.admin");
assert.equal(departmentMembershipOr("is_services"), "is_services.eq.true,role.eq.admin");
assert.equal(
  eitherDepartmentMembershipOr(),
  "is_accounts.eq.true,is_services.eq.true,role.eq.admin"
);

console.log("  ✓ Admins are in both Account Managers and Client Services");
console.log("\nAll department membership checks passed.");
