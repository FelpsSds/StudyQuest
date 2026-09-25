from datetime import date


def calculate_streak(activity_dates: set[date], today: date) -> tuple[int, int]:
    """Return current and best consecutive-day streaks up to today."""
    dates = sorted(activity_date for activity_date in activity_dates if activity_date <= today)
    if not dates:
        return 0, 0

    best_streak = 1
    current_run = 1
    for previous, current in zip(dates, dates[1:]):
        if (current - previous).days == 1:
            current_run += 1
            best_streak = max(best_streak, current_run)
        else:
            current_run = 1

    if today not in activity_dates:
        return 0, best_streak

    current_streak = 1
    for previous, current in zip(reversed(dates[:-1]), reversed(dates[1:])):
        if (current - previous).days == 1:
            current_streak += 1
        else:
            break

    return current_streak, best_streak
