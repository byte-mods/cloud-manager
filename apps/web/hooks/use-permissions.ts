import { useAuthStore, type Role } from '@/stores/auth-store';

type Module =
  | 'compute'
  | 'storage'
  | 'networking'
  | 'databases'
  | 'ai_ml'
  | 'security'
  | 'security_testing'
  | 'monitoring'
  | 'devops'
  | 'data_engineering'
  | 'cost'
  | 'iot'
  | 'analytics'
  | 'tutorials'
  | 'ai_assistant'
  | 'infrastructure'
  | 'cloud_connect';

type Permission = 'read' | 'write' | 'full' | 'none';

type Action = 'read' | 'write';

/**
 * Role-permission matrix.
 * Each role maps to a record of module -> permission level.
 */
const rolePermissions: Record<Role, Record<Module, Permission>> = {
  cloud_architect: {
    compute: 'full',
    storage: 'full',
    networking: 'full',
    databases: 'full',
    ai_ml: 'full',
    security: 'full',
    security_testing: 'full',
    monitoring: 'full',
    devops: 'full',
    data_engineering: 'read',
    cost: 'full',
    iot: 'read',
    analytics: 'full',
    tutorials: 'full',
    ai_assistant: 'full',
    infrastructure: 'full',
    cloud_connect: 'full',
  },
  devops_engineer: {
    compute: 'full',
    storage: 'write',
    networking: 'write',
    databases: 'write',
    ai_ml: 'read',
    security: 'read',
    security_testing: 'write',
    monitoring: 'full',
    devops: 'full',
    data_engineering: 'read',
    cost: 'read',
    iot: 'read',
    analytics: 'read',
    tutorials: 'full',
    ai_assistant: 'full',
    infrastructure: 'full',
    cloud_connect: 'full',
  },
  data_engineer: {
    compute: 'read',
    storage: 'full',
    networking: 'read',
    databases: 'full',
    ai_ml: 'full',
    security: 'read',
    security_testing: 'read',
    monitoring: 'read',
    devops: 'read',
    data_engineering: 'full',
    cost: 'read',
    iot: 'write',
    analytics: 'full',
    tutorials: 'full',
    ai_assistant: 'full',
    infrastructure: 'write',
    cloud_connect: 'read',
  },
  system_admin: {
    compute: 'full',
    storage: 'full',
    networking: 'full',
    databases: 'full',
    ai_ml: 'read',
    security: 'full',
    security_testing: 'full',
    monitoring: 'full',
    devops: 'write',
    data_engineering: 'read',
    cost: 'full',
    iot: 'write',
    analytics: 'read',
    tutorials: 'full',
    ai_assistant: 'full',
    infrastructure: 'full',
    cloud_connect: 'full',
  },
  network_admin: {
    compute: 'read',
    storage: 'read',
    networking: 'full',
    databases: 'read',
    ai_ml: 'none',
    security: 'write',
    security_testing: 'write',
    monitoring: 'write',
    devops: 'read',
    data_engineering: 'none',
    cost: 'read',
    iot: 'write',
    analytics: 'read',
    tutorials: 'full',
    ai_assistant: 'full',
    infrastructure: 'write',
    cloud_connect: 'write',
  },
};

const permissionHierarchy: Record<Permission, number> = {
  none: 0,
  read: 1,
  write: 2,
  full: 3,
};

function hasPermission(
  permission: Permission,
  requiredAction: Action
): boolean {
  const level = permissionHierarchy[permission];
  const requiredLevel = permissionHierarchy[requiredAction];
  return level >= requiredLevel;
}

type UsePermissionsReturn = {
  can: (action: Action, module: Module) => boolean;
  role: Role | null;
  getPermission: (module: Module) => Permission;
};

export function usePermissions(): UsePermissionsReturn {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;

  function can(action: Action, module: Module): boolean {
    if (!role) return false;
    const permissions = rolePermissions[role];
    if (!permissions) return false;
    const permission = permissions[module] ?? 'none';
    return hasPermission(permission, action);
  }

  function getPermission(module: Module): Permission {
    if (!role) return 'none';
    const permissions = rolePermissions[role];
    if (!permissions) return 'none';
    return permissions[module] ?? 'none';
  }

  return { can, role, getPermission };
}

export type { Module, Permission, Action, UsePermissionsReturn };
