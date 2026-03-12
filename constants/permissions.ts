/**
 * Feature Names for RBAC (Role-Based Access Control)
 * Must match the 'Feature' field in Google Sheets 'RolePermissions'
 */
export const FEATURES = {
    // Orders Dashboard
    VIEW_ORDER_LIST: "view_order_list",
    EDIT_ORDER: "edit_order",
    DELETE_ORDER: "delete_order",
    VERIFY_ORDER: "verify_order",
    CREATE_ORDER: "create_order",
    
    // Admin & Management
    MANAGE_ROLES: "manage_roles",
    MANAGE_PERMISSIONS: "manage_permissions",
    VIEW_REVENUE: "view_revenue",
    EXPORT_DATA: "export_data",
    MIGRATE_DATA: "migrate_data",
    
    // Inventory
    MANAGE_INVENTORY: "manage_inventory",
    STOCK_TRANSFER: "stock_transfer",
    
    // Performance
    VIEW_TEAM_LEADERBOARD: "view_team_leaderboard",
    SET_TARGETS: "set_targets"
};
