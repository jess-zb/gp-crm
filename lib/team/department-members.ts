/** Profile department flags used for assignment dropdowns. */
export type DeptProfileFlag = "is_accounts" | "is_services";

export type DepartmentMemberOption = {
  id: string;
  full_name: string | null;
  email?: string | null;
  is_accounts?: boolean | null;
  is_services?: boolean | null;
};

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
    (m) => !!m[flag] || (!!currentAssigneeId && m.id === currentAssigneeId)
  );
}
