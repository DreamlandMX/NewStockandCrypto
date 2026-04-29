const {
    deriveDefaultUsername,
    mapProfileRow,
    normalizeText
} = require('./profile-helpers');
const { openAppDatabase } = require('./sqlite-store-helpers');
const { nowIso } = require('./store-helpers');

module.exports = {
    createProfileStore
};

function createProfileStore(options = {}) {
    const { db, dbPath } = openAppDatabase(options);

    db.exec(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            bio TEXT NOT NULL DEFAULT '',
            website TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            avatar_url TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    const profileColumns = db.prepare('PRAGMA table_info(user_profiles)').all().map((row) => row.name);
    if (!profileColumns.includes('website')) {
        db.exec(`ALTER TABLE user_profiles ADD COLUMN website TEXT NOT NULL DEFAULT ''`);
    }
    if (!profileColumns.includes('location')) {
        db.exec(`ALTER TABLE user_profiles ADD COLUMN location TEXT NOT NULL DEFAULT ''`);
    }
    if (!profileColumns.includes('avatar_url')) {
        db.exec('ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT');
    }

    const statements = {
        getProfile: db.prepare(`
            SELECT user_id, username, bio, website, location, avatar_url, created_at, updated_at
            FROM user_profiles
            WHERE user_id = ?
            LIMIT 1
        `),
        upsertProfile: db.prepare(`
            INSERT INTO user_profiles (
                user_id,
                username,
                bio,
                website,
                location,
                avatar_url,
                created_at,
                updated_at
            ) VALUES (
                @user_id,
                @username,
                @bio,
                @website,
                @location,
                @avatar_url,
                @created_at,
                @updated_at
            )
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                bio = excluded.bio,
                website = excluded.website,
                location = excluded.location,
                avatar_url = excluded.avatar_url,
                updated_at = excluded.updated_at
        `)
    };

    function getProfile(user) {
        const row = statements.getProfile.get(user.id);
        return mapProfileRow(row, user);
    }

    function updateProfile(user, updates = {}) {
        const current = getProfile(user);
        const timestamp = nowIso();
        const nextProfile = {
            user_id: user.id,
            username: normalizeText(updates.username !== undefined ? updates.username : current.username, 80) || deriveDefaultUsername(user),
            bio: normalizeText(updates.bio !== undefined ? updates.bio : current.bio, 1000),
            website: normalizeText(updates.website !== undefined ? updates.website : current.website, 255),
            location: normalizeText(updates.location !== undefined ? updates.location : current.location, 120),
            avatar_url: updates.avatar_url !== undefined ? (updates.avatar_url || null) : current.avatar_url,
            created_at: current.created_at || timestamp,
            updated_at: timestamp
        };

        statements.upsertProfile.run(nextProfile);
        return getProfile(user);
    }

    return {
        dbPath,
        getProfile,
        updateProfile
    };
}
