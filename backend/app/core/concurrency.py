from threading import Lock


_USER_OPERATION_LOCKS = tuple(Lock() for _ in range(64))


def user_operation_lock(user_id: int) -> Lock:
    """Return a process-local lock shared by operations for the same user."""
    return _USER_OPERATION_LOCKS[user_id % len(_USER_OPERATION_LOCKS)]
