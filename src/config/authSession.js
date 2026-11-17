/**
 * Validate the shared response contract returned by password and Google auth.
 */
export const validateAuthPayload = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid authentication response from server.');
    }
    if (typeof data.access_token !== 'string' || !data.access_token.trim()) {
        throw new Error('Invalid authentication token received. Please try again.');
    }
    const user = data.user;
    if (!user || typeof user !== 'object' || Array.isArray(user)) {
        throw new Error('Invalid user profile received. Please try again.');
    }
    if (
        user.id === undefined ||
        user.id === null ||
        typeof user.username !== 'string' ||
        !user.username.trim() ||
        typeof user.email !== 'string' ||
        !user.email.trim()
    ) {
        throw new Error('Incomplete user profile received. Please try again.');
    }
    return {
        accessToken: data.access_token.trim(),
        user,
    };
};

/**
 * Persist session keys with the auth flag written last and rollback on failure.
 */
export const persistSession = (accessToken, user) => {
    const sessionKeys = ['auth_token', 'user', 'isAuthenticated'];
    const previousValues = {};
    let canRollback = true;

    for (const key of sessionKeys) {
        try {
            previousValues[key] = localStorage.getItem(key);
        } catch {
            canRollback = false;
            break;
        }
    }

    if (!canRollback) {
        throw new Error('Unable to save login session. Please ensure cookies and local storage are enabled in your browser.');
    }

    const restorePreviousSession = () => {
        for (const key of sessionKeys) {
            try {
                const prev = previousValues[key];
                if (prev === null) {
                    localStorage.removeItem(key);
                } else {
                    localStorage.setItem(key, prev);
                }
            } catch {
                console.error(`Unable to restore the previous value for ${key}.`);
            }
        }
    };

    try {
        localStorage.setItem('auth_token', accessToken);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('isAuthenticated', 'true');
    } catch {
        restorePreviousSession();
        throw new Error('Unable to save login session. Please ensure cookies and local storage are enabled in your browser.');
    }
};
