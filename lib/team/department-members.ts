/** Profile department flags used for assignment dropdowns. */
export type DeptProfileFlag = "is_accounts" | "is_services";

export type DepartmentMemberOption = {
  id: string;
  full_name: string | null;
  email?: string | null;
  role?: string | null;
  is_accounts?: boolean | null;
  is_services?: boolean | null;
};

/**
 * Admins belong to both departments. The department checkboxes are for Users.
 */
export function belongsToDepartment(
  member: Pick<DepartmentMemberOption, "role" | DeptProfileFlag>,
  flag: DeptProfileFlag
): boolean {
  if (member.role === "admin") return true;
  return !!member[flag];
}

/**
 * PostgREST `or` filter for people who belong to one department.
 * Pair with `.eq("is_active", true)` at the call site.
 */
export function departmentMembershipOr(flag: DeptProfileFlag): string {
  return `${flag}.eq.true,role.eq.admin`;
}

/** People in either department, including admins. */
export function eitherDepartmentMembershipOr(): string {
  return "is_accounts.eq.true,is_services.eq.true,role.eq.admin";
}

/**
 * Members eligible for a department assignee dropdown.
 * Always keeps the current assignee visible even if their dept flag was cleared.
 */
export function filterByDepartment(
  members: DepartmentMemberOption[],
  flag: DeptProfileFlag,
  currentAssigneeId?: string | null
): DepartmentMemberOption[] {
  return members.filter(
    (m) =>
      belongsToDepartment(m, flag) ||
      (!!currentAssigneeId && m.id === currentAssigneeId)
  );
}
