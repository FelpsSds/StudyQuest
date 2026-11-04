def level_for_xp(xp: int) -> int:
    """Return the current level using the project's linear XP progression."""
    return 1 + max(xp, 0) // 100


def xp_required_for_level(level: int) -> int:
    """Return the total XP required to reach a level."""
    return max(level - 1, 0) * 100


def progress_for_xp(xp: int) -> dict[str, int]:
    """Return the XP range and percentage for the current level."""
    level = level_for_xp(xp)
    current_level_xp = xp_required_for_level(level)
    next_level_xp = xp_required_for_level(level + 1)
    progress_percent = round((xp - current_level_xp) / (next_level_xp - current_level_xp) * 100)
    return {
        "current_level_xp": current_level_xp,
        "next_level_xp": next_level_xp,
        "progress_percent": min(max(progress_percent, 0), 100),
    }
