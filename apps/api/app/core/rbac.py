from enum import Enum


class Role(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    AREA_ADMIN = "AREA_ADMIN"
    FIELD_OFFICER = "FIELD_OFFICER"


class Permission(str, Enum):
    VIEW_CONSUMERS = "view_consumers"
    VIEW_METER_LOCATIONS = "view_meter_locations"
    VIEW_PENDING_CONSUMERS = "view_pending_consumers"

    CREATE_ASSIGNMENT = "create_assignment"
    VIEW_ASSIGNMENTS = "view_assignments"
    UPDATE_ASSIGNMENT = "update_assignment"

    MANAGE_OFFICERS = "manage_officers"
    MANAGE_MASTER_METERS = "manage_master_meters"


ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.SUPER_ADMIN: {
        Permission.VIEW_CONSUMERS,
        Permission.VIEW_METER_LOCATIONS,
        Permission.VIEW_PENDING_CONSUMERS,
        Permission.CREATE_ASSIGNMENT,
        Permission.VIEW_ASSIGNMENTS,
        Permission.UPDATE_ASSIGNMENT,
        Permission.MANAGE_OFFICERS,
        Permission.MANAGE_MASTER_METERS,
    },
    Role.ADMIN: {
        Permission.VIEW_CONSUMERS,
        Permission.VIEW_METER_LOCATIONS,
        Permission.VIEW_PENDING_CONSUMERS,
        Permission.CREATE_ASSIGNMENT,
        Permission.VIEW_ASSIGNMENTS,
        Permission.UPDATE_ASSIGNMENT,
        Permission.MANAGE_OFFICERS,
        Permission.MANAGE_MASTER_METERS,
    },
    Role.AREA_ADMIN: {
        Permission.VIEW_CONSUMERS,
        Permission.VIEW_METER_LOCATIONS,
        Permission.VIEW_PENDING_CONSUMERS,
        Permission.CREATE_ASSIGNMENT,
        Permission.VIEW_ASSIGNMENTS,
        Permission.UPDATE_ASSIGNMENT,
        Permission.MANAGE_OFFICERS,
    },
    Role.FIELD_OFFICER: {
        Permission.VIEW_CONSUMERS,
        Permission.VIEW_METER_LOCATIONS,
        Permission.VIEW_PENDING_CONSUMERS,
        Permission.VIEW_ASSIGNMENTS,
        Permission.UPDATE_ASSIGNMENT,
    },
}


def has_permission(
    role: str,
    permission: Permission,
) -> bool:
    try:
        normalized_role = Role(role)
    except ValueError:
        return False

    return permission in ROLE_PERMISSIONS.get(
        normalized_role,
        set(),
    )