export type Role = "superadmin" | "admin";

export const PERMISSIONS = [
  "session:manage",
  "contact:read",
  "group:read",
  "list:manage",
  "broadcast:manage",
  "apikey:manage",
  "user:manage",
  "audit:read",
  "scope:all", // boleh melihat data milik semua user
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN: Permission[] = [
  "session:manage",
  "contact:read",
  "group:read",
  "list:manage",
  "broadcast:manage",
  "apikey:manage",
];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(ADMIN),
  superadmin: new Set<Permission>([...ADMIN, "user:manage", "audit:read", "scope:all"]),
};

export const can = (role: Role, p: Permission) => MATRIX[role].has(p);
