import type { Database, RunResult } from "better-sqlite3";
import type {
  Alliance,
  BearMember,
  EligibleMember,
  Profile,
  User,
} from "../../shared/types";

type SessionRow = {
  token: string;
  userId: string;
  expiresAt: number;
};

type AllianceGuildRow = {
  allianceId: string;
  guildId: string;
};

export function createQueries(db: Database) {
  const selectUserByDiscordId = db.prepare(
    "SELECT id, discordId, displayName, avatar, isAppAdmin FROM users WHERE discordId = ?"
  );
  const insertUser = db.prepare(
    "INSERT INTO users (id, discordId, displayName, avatar, isAppAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const updateUser = db.prepare(
    "UPDATE users SET displayName = ?, avatar = ? WHERE id = ?"
  );
  const selectUserById = db.prepare(
    "SELECT id, discordId, displayName, avatar, isAppAdmin FROM users WHERE id = ?"
  );
  const updateUserBotOptIn = db.prepare(
    "UPDATE users SET botOptInAssignments = ? WHERE id = ?"
  );
  const selectProfilesByUser = db.prepare(
    `SELECT profiles.id,
            profiles.userId,
            profiles.playerId,
            profiles.playerName,
            profiles.playerAvatar,
            profiles.kingdomId,
            profiles.allianceId,
            profiles.status,
            profiles.role,
            profiles.troopCount,
            profiles.marchCount,
            profiles.power,
            profiles.rallySize,
            alliances.name AS allianceName
     FROM profiles
     LEFT JOIN alliances ON alliances.id = profiles.allianceId
     WHERE profiles.userId = ?`
  );
  const selectProfileById = db.prepare(
    `SELECT profiles.id,
            profiles.userId,
            profiles.playerId,
            profiles.playerName,
            profiles.playerAvatar,
            profiles.kingdomId,
            profiles.allianceId,
            profiles.status,
            profiles.role,
            profiles.troopCount,
            profiles.marchCount,
            profiles.power,
            profiles.rallySize,
            alliances.name AS allianceName
     FROM profiles
     LEFT JOIN alliances ON alliances.id = profiles.allianceId
     WHERE profiles.id = ?`
  );
  const selectProfileByPlayerId = db.prepare(
    "SELECT * FROM profiles WHERE playerId = ?"
  );
  const insertProfile = db.prepare(
    `INSERT INTO profiles (
       id,
       userId,
       playerId,
       playerName,
       playerAvatar,
       kingdomId,
       allianceId,
       status,
       role,
       troopCount,
       marchCount,
       power,
       rallySize,
       createdAt,
       updatedAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateProfile = db.prepare(
    `UPDATE profiles
     SET playerId = ?,
         playerName = ?,
         playerAvatar = ?,
         kingdomId = ?,
         allianceId = ?,
         status = ?,
         role = ?,
         troopCount = ?,
         marchCount = ?,
         power = ?,
         rallySize = ?,
         updatedAt = ?
     WHERE id = ?`
  );
  const updateProfileClaim = db.prepare(
    `UPDATE profiles
     SET userId = ?,
         playerName = ?,
         playerAvatar = ?,
         kingdomId = ?,
         status = 'pending',
         role = 'member',
         troopCount = ?,
         marchCount = ?,
         power = ?,
         rallySize = ?,
         updatedAt = ?
     WHERE id = ?`
  );
  const updateProfileFields = db.prepare(
    `UPDATE profiles
     SET playerId = ?,
         playerName = ?,
         playerAvatar = ?,
         kingdomId = ?,
         troopCount = ?,
         marchCount = ?,
         power = ?,
         rallySize = ?,
         updatedAt = ?
     WHERE id = ?`
  );
  const updateProfileStatus = db.prepare(
    `UPDATE profiles
     SET status = ?,
         role = ?,
         updatedAt = ?
     WHERE id = ?`
  );
  const selectAllianceById = db.prepare(
    "SELECT id, name, kingdomId FROM alliances WHERE id = ?"
  );
  const selectAlliances = db.prepare(
    "SELECT id, name, kingdomId FROM alliances ORDER BY name ASC"
  );
  const selectAlliancesByKingdom = db.prepare(
    "SELECT id, name, kingdomId FROM alliances WHERE kingdomId = ? ORDER BY name ASC"
  );
  const selectAdminKingdoms = db.prepare(
    "SELECT DISTINCT kingdomId FROM alliances WHERE kingdomId IS NOT NULL ORDER BY kingdomId ASC"
  );
  const selectAllianceProfiles = db.prepare(
    `SELECT profiles.id,
            profiles.userId,
            profiles.playerId,
            profiles.playerName,
            profiles.playerAvatar,
            profiles.kingdomId,
            profiles.allianceId,
            profiles.status,
            profiles.role,
            profiles.troopCount,
            profiles.marchCount,
            profiles.power,
            profiles.rallySize,
            users.displayName AS userDisplayName
     FROM profiles
     LEFT JOIN users ON users.id = profiles.userId
     WHERE profiles.allianceId = ?`
  );
  const selectEligibleMembers = db.prepare(
    `SELECT playerId,
            playerName,
            troopCount,
            marchCount,
            power
     FROM profiles
     WHERE allianceId = ?
       AND status = 'active'
       AND playerId NOT IN (
         SELECT playerId FROM members WHERE allianceId = ?
       )
     ORDER BY COALESCE(playerName, playerId) ASC`
  );
  const selectEligibleBearMembers = db.prepare(
    `SELECT playerId,
            playerName,
            rallySize
     FROM profiles
     WHERE allianceId = ?
       AND status = 'active'
       AND playerId NOT IN (
         SELECT playerId FROM bear WHERE allianceId = ?
       )
     ORDER BY COALESCE(playerName, playerId) ASC`
  );
  const selectBearGroupMembers = db.prepare(
    "SELECT playerId, playerName, rallySize FROM bear WHERE allianceId = ? AND bearGroup = ?"
  );
  const selectBearMemberByPlayer = db.prepare(
    "SELECT playerId, playerName, rallySize, bearGroup FROM bear WHERE allianceId = ? AND playerId = ?"
  );
  const upsertBearMember = db.prepare(
    `INSERT INTO bear (allianceId, playerId, playerName, rallySize, bearGroup)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(allianceId, playerId) DO UPDATE SET
       playerName=excluded.playerName,
       rallySize=excluded.rallySize,
       bearGroup=excluded.bearGroup`
  );
  const updateProfileRallySize = db.prepare(
    `UPDATE profiles
     SET rallySize = ?,
         playerName = ?
     WHERE allianceId = ? AND playerId = ?`
  );
  const deleteBearByGroup = db.prepare(
    "DELETE FROM bear WHERE allianceId = ? AND bearGroup = ?"
  );
  const deleteBearByPlayer = db.prepare(
    "DELETE FROM bear WHERE allianceId = ? AND playerId = ? AND bearGroup = ?"
  );
  const updateProfileStatsFromMember = db.prepare(
    `UPDATE profiles
     SET troopCount = ?,
         marchCount = ?,
         power = ?,
         playerName = ?
     WHERE allianceId = ? AND playerId = ?`
  );
  const deleteMemberByPlayer = db.prepare(
    "DELETE FROM members WHERE allianceId = ? AND playerId = ?"
  );
  const deleteBearByPlayerAny = db.prepare(
    "DELETE FROM bear WHERE allianceId = ? AND playerId = ?"
  );
  const deleteProfileById = db.prepare("DELETE FROM profiles WHERE id = ?");
  const deleteMembersByAlliance = db.prepare(
    "DELETE FROM members WHERE allianceId = ?"
  );
  const deleteMetaByAlliance = db.prepare(
    "DELETE FROM meta WHERE allianceId = ?"
  );
  const deleteBearByAlliance = db.prepare(
    "DELETE FROM bear WHERE allianceId = ?"
  );
  const resetProfilesForAlliance = db.prepare(
    "UPDATE profiles SET allianceId = NULL, status = 'pending', role = 'member' WHERE allianceId = ?"
  );
  const deleteAllianceById = db.prepare("DELETE FROM alliances WHERE id = ?");
  const insertAlliance = db.prepare(
    "INSERT INTO alliances (id, name, kingdomId, createdAt) VALUES (?, ?, ?, ?)"
  );
  const countActiveProfilesByAlliance = db.prepare(
    "SELECT COUNT(1) AS count FROM profiles WHERE allianceId = ? AND status = 'active'"
  );
  const insertBootstrapRow = db.prepare(
    "INSERT OR IGNORE INTO app_bootstrap (id, createdAt) VALUES (1, ?)"
  );
  const insertSession = db.prepare(
    "INSERT INTO sessions (token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)"
  );
  const selectSession = db.prepare(
    "SELECT token, userId, expiresAt FROM sessions WHERE token = ?"
  );
  const deleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");
  const selectAllianceGuildByAllianceId = db.prepare(
    "SELECT id AS allianceId, guildId FROM alliances WHERE id = ?"
  );
  const selectAllianceGuildByGuildId = db.prepare(
    "SELECT id AS allianceId, guildId FROM alliances WHERE guildId = ?"
  );
  const updateAllianceGuild = db.prepare(
    "UPDATE alliances SET guildId = ? WHERE id = ?"
  );

  const selectOptedInAssignmentRecipients = db.prepare(
    `SELECT profiles.id AS profileId,
            profiles.playerId AS playerId,
            users.discordId AS discordId
     FROM profiles
     JOIN users ON users.id = profiles.userId
     WHERE profiles.allianceId = ?
       AND profiles.status = 'active'
       AND users.botOptInAssignments = 1
       AND users.discordId IS NOT NULL`
  );
  const insertAssignmentNotification = db.prepare(
    `INSERT INTO assignment_notifications (
       id,
       allianceId,
       playerId,
       discordId,
       payload,
       status,
       createdAt,
       updatedAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const listPendingAssignmentNotifications = db.prepare(
    `SELECT id, allianceId, playerId, discordId, payload, status, error, createdAt, updatedAt
     FROM assignment_notifications
     WHERE allianceId = ?
       AND status = 'pending'
     ORDER BY createdAt ASC`
  );
  const listPendingAssignmentNotificationsAllQuery = db.prepare(
    `SELECT id, allianceId, playerId, discordId, payload, status, error, createdAt, updatedAt
     FROM assignment_notifications
     WHERE status = 'pending'
     ORDER BY createdAt ASC`
  );
  const listFailedAssignmentNotifications = db.prepare(
    `SELECT id, allianceId, playerId, discordId, payload, status, error, createdAt, updatedAt
     FROM assignment_notifications
     WHERE allianceId = ?
       AND status = 'failed'
     ORDER BY updatedAt DESC
     LIMIT ?`
  );
  const listFailedAssignmentNotificationsAllQuery = db.prepare(
    `SELECT id, allianceId, playerId, discordId, payload, status, error, createdAt, updatedAt
     FROM assignment_notifications
     WHERE status = 'failed'
     ORDER BY updatedAt DESC
     LIMIT ?`
  );
  const updateAssignmentNotificationStatus = db.prepare(
    `UPDATE assignment_notifications
     SET status = ?, error = ?, updatedAt = ?
     WHERE id = ?`
  );
  const deletePendingAssignmentNotifications = db.prepare(
    "DELETE FROM assignment_notifications WHERE allianceId = ? AND status = 'pending'"
  );
  const deleteAssignmentNotificationsBefore = db.prepare(
    "DELETE FROM assignment_notifications WHERE updatedAt < ?"
  );

  function getUserByDiscordId(discordId: string): User | null {
    return (selectUserByDiscordId.get(discordId) as User | undefined) ?? null;
  }

  function getUserById(id: string): User | null {
    return (selectUserById.get(id) as User | undefined) ?? null;
  }

  function getProfileById(id: string): Profile | null {
    return (selectProfileById.get(id) as Profile | undefined) ?? null;
  }

  function getProfileByPlayerId(playerId: string): Profile | null {
    return (
      (selectProfileByPlayerId.get(playerId) as Profile | undefined) ?? null
    );
  }

  function getProfilesByUser(userId: string): Profile[] {
    return (selectProfilesByUser.all(userId) as Profile[]) || [];
  }

  function getAllianceById(id: string): Alliance | null {
    return (selectAllianceById.get(id) as Alliance | undefined) ?? null;
  }

  function listAlliances(): Alliance[] {
    return (selectAlliances.all() as Alliance[]) || [];
  }

  function listAlliancesByKingdom(kingdomId: number): Alliance[] {
    return (selectAlliancesByKingdom.all(kingdomId) as Alliance[]) || [];
  }

  function listAdminKingdoms(): number[] {
    const rows = selectAdminKingdoms.all() as { kingdomId: number }[];
    return rows.map((row) => row.kingdomId);
  }

  function listAllianceProfiles(allianceId: string): Profile[] {
    return (selectAllianceProfiles.all(allianceId) as Profile[]) || [];
  }

  function listEligibleMembers(allianceId: string): EligibleMember[] {
    return (selectEligibleMembers.all(allianceId, allianceId) as EligibleMember[]) || [];
  }

  function listEligibleBearMembers(allianceId: string): BearMember[] {
    return (selectEligibleBearMembers.all(allianceId, allianceId) as BearMember[]) || [];
  }

  function listBearGroupMembers(
    allianceId: string,
    group: string
  ): BearMember[] {
    return (selectBearGroupMembers.all(allianceId, group) as BearMember[]) || [];
  }

  function getBearMemberByPlayer(
    allianceId: string,
    playerId: string
  ): (BearMember & { bearGroup: string }) | null {
    return (
      (selectBearMemberByPlayer.get(allianceId, playerId) as
        | (BearMember & { bearGroup: string })
        | undefined) ?? null
    );
  }

  function upsertBearMemberRow(
    allianceId: string,
    playerId: string,
    playerName: string,
    rallySize: number,
    group: string
  ): RunResult {
    return upsertBearMember.run(
      allianceId,
      playerId,
      playerName,
      rallySize,
      group
    );
  }

  function updateProfileRallySizeRow(
    rallySize: number,
    playerName: string,
    allianceId: string,
    playerId: string
  ): RunResult {
    return updateProfileRallySize.run(
      rallySize,
      playerName,
      allianceId,
      playerId
    );
  }

  function deleteBearGroup(allianceId: string, group: string): RunResult {
    return deleteBearByGroup.run(allianceId, group);
  }

  function deleteBearMember(
    allianceId: string,
    playerId: string,
    group: string
  ): RunResult {
    return deleteBearByPlayer.run(allianceId, playerId, group);
  }

  function updateProfileStatsForMember(
    troopCount: number,
    marchCount: number,
    power: number,
    playerName: string,
    allianceId: string,
    playerId: string
  ): RunResult {
    return updateProfileStatsFromMember.run(
      troopCount,
      marchCount,
      power,
      playerName,
      allianceId,
      playerId
    );
  }

  function deleteProfile(profileId: string): RunResult {
    return deleteProfileById.run(profileId);
  }

  function deleteMemberForPlayer(
    allianceId: string,
    playerId: string
  ): RunResult {
    return deleteMemberByPlayer.run(allianceId, playerId);
  }

  function deleteBearForPlayer(
    allianceId: string,
    playerId: string
  ): RunResult {
    return deleteBearByPlayerAny.run(allianceId, playerId);
  }

  function deleteMembersForAlliance(allianceId: string): RunResult {
    return deleteMembersByAlliance.run(allianceId);
  }

  function deleteMetaForAlliance(allianceId: string): RunResult {
    return deleteMetaByAlliance.run(allianceId);
  }

  function deleteBearForAlliance(allianceId: string): RunResult {
    return deleteBearByAlliance.run(allianceId);
  }

  function resetProfilesAlliance(allianceId: string): RunResult {
    return resetProfilesForAlliance.run(allianceId);
  }

  function deleteAlliance(allianceId: string): RunResult {
    return deleteAllianceById.run(allianceId);
  }

  function deleteAllianceCascade(allianceId: string): void {
    db.transaction(() => {
      deleteMembersForAlliance(allianceId);
      deleteMetaForAlliance(allianceId);
      deleteBearForAlliance(allianceId);
      resetProfilesAlliance(allianceId);
      deleteAlliance(allianceId);
    })();
  }

  function insertAllianceRow(
    id: string,
    name: string,
    kingdomId: number,
    createdAt: number
  ): RunResult {
    return insertAlliance.run(id, name, kingdomId, createdAt);
  }

  function countActiveProfiles(allianceId: string): number {
    const row = countActiveProfilesByAlliance.get(allianceId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  function insertUserRow(
    id: string,
    discordId: string,
    displayName: string,
    avatar: string | null,
    isAppAdmin: number,
    createdAt: number
  ): RunResult {
    return insertUser.run(
      id,
      discordId,
      displayName,
      avatar,
      isAppAdmin,
      createdAt
    );
  }

  function updateUserRow(
    displayName: string,
    avatar: string | null,
    id: string
  ): RunResult {
    return updateUser.run(displayName, avatar, id);
  }

  function updateUserBotOptInRow(
    id: string,
    enabled: number
  ): RunResult {
    return updateUserBotOptIn.run(enabled, id);
  }

  function insertBootstrapRowOnce(createdAt: number): RunResult {
    return insertBootstrapRow.run(createdAt);
  }

  function insertSessionRow(
    token: string,
    userId: string,
    expiresAt: number,
    createdAt: number
  ): RunResult {
    return insertSession.run(token, userId, expiresAt, createdAt);
  }

  function getSession(token: string): SessionRow | null {
    return (selectSession.get(token) as SessionRow | undefined) ?? null;
  }

  function deleteSessionRow(token: string): RunResult {
    return deleteSession.run(token);
  }

  function listOptedInAssignmentRecipients(
    allianceId: string
  ): Array<{ profileId: string; playerId: string; discordId: string }> {
    return (
      (selectOptedInAssignmentRecipients.all(allianceId) as Array<{
        profileId: string;
        playerId: string;
        discordId: string;
      }>) || []
    );
  }

  function insertAssignmentNotificationRow(
    id: string,
    allianceId: string,
    playerId: string,
    discordId: string,
    payload: string,
    status: "pending" | "sent" | "failed",
    createdAt: number,
    updatedAt: number
  ): RunResult {
    return insertAssignmentNotification.run(
      id,
      allianceId,
      playerId,
      discordId,
      payload,
      status,
      createdAt,
      updatedAt
    );
  }

  function listPendingAssignmentNotificationsByAlliance(allianceId: string) {
    return (
      listPendingAssignmentNotifications.all(allianceId) as Array<{
        id: string;
        allianceId: string;
        playerId: string;
        discordId: string;
        payload: string;
        status: string;
        error: string | null;
        createdAt: number;
        updatedAt: number;
      }>
    );
  }

  function listPendingAssignmentNotificationsAll() {
    return (
      listPendingAssignmentNotificationsAllQuery.all() as Array<{
        id: string;
        allianceId: string;
        playerId: string;
        discordId: string;
        payload: string;
        status: string;
        error: string | null;
        createdAt: number;
        updatedAt: number;
      }>
    );
  }

  function listFailedAssignmentNotificationsByAlliance(
    allianceId: string,
    limit: number
  ) {
    return (
      listFailedAssignmentNotifications.all(allianceId, limit) as Array<{
        id: string;
        allianceId: string;
        playerId: string;
        discordId: string;
        payload: string;
        status: string;
        error: string | null;
        createdAt: number;
        updatedAt: number;
      }>
    );
  }

  function listFailedAssignmentNotificationsAll(limit: number) {
    return (
      listFailedAssignmentNotificationsAllQuery.all(limit) as Array<{
        id: string;
        allianceId: string;
        playerId: string;
        discordId: string;
        payload: string;
        status: string;
        error: string | null;
        createdAt: number;
        updatedAt: number;
      }>
    );
  }

  function updateAssignmentNotificationStatusRow(
    id: string,
    status: "sent" | "failed",
    error: string | null,
    updatedAt: number
  ): RunResult {
    return updateAssignmentNotificationStatus.run(status, error, updatedAt, id);
  }

  function deletePendingAssignmentNotificationsForAlliance(
    allianceId: string
  ): RunResult {
    return deletePendingAssignmentNotifications.run(allianceId);
  }

  function deleteAssignmentNotificationsBeforeTimestamp(
    timestamp: number
  ): RunResult {
    return deleteAssignmentNotificationsBefore.run(timestamp);
  }

  function getAllianceGuildByAllianceId(
    allianceId: string
  ): AllianceGuildRow | null {
    const row = selectAllianceGuildByAllianceId.get(allianceId) as
      | AllianceGuildRow
      | undefined;
    if (!row?.guildId) return null;
    return row;
  }

  function getAllianceGuildByGuildId(guildId: string): AllianceGuildRow | null {
    return (
      (selectAllianceGuildByGuildId.get(guildId) as
        | AllianceGuildRow
        | undefined) ?? null
    );
  }

  function upsertAllianceGuildRow(
    allianceId: string,
    guildId: string
  ): RunResult {
    return updateAllianceGuild.run(guildId, allianceId);
  }

  function deleteAllianceGuildByAlliance(
    allianceId: string
  ): RunResult {
    return updateAllianceGuild.run(null, allianceId);
  }

  function insertProfileRow(
    id: string,
    userId: string | null,
    playerId: string | null,
    playerName: string | null,
    playerAvatar: string | null,
    kingdomId: number | null,
    allianceId: string | null,
    status: string,
    role: string,
    troopCount: number | null,
    marchCount: number | null,
    power: number | null,
    rallySize: number | null,
    createdAt: number,
    updatedAt: number
  ): RunResult {
    return insertProfile.run(
      id,
      userId,
      playerId,
      playerName,
      playerAvatar,
      kingdomId,
      allianceId,
      status,
      role,
      troopCount,
      marchCount,
      power,
      rallySize,
      createdAt,
      updatedAt
    );
  }

  function updateProfileRow(
    playerId: string | null,
    playerName: string | null,
    playerAvatar: string | null,
    kingdomId: number | null,
    allianceId: string | null,
    status: string,
    role: string,
    troopCount: number | null,
    marchCount: number | null,
    power: number | null,
    rallySize: number | null,
    updatedAt: number,
    id: string
  ): RunResult {
    return updateProfile.run(
      playerId,
      playerName,
      playerAvatar,
      kingdomId,
      allianceId,
      status,
      role,
      troopCount,
      marchCount,
      power,
      rallySize,
      updatedAt,
      id
    );
  }

  function updateProfileClaimRow(
    userId: string,
    playerName: string | null,
    playerAvatar: string | null,
    kingdomId: number | null,
    troopCount: number | null,
    marchCount: number | null,
    power: number | null,
    rallySize: number | null,
    updatedAt: number,
    id: string
  ): RunResult {
    return updateProfileClaim.run(
      userId,
      playerName,
      playerAvatar,
      kingdomId,
      troopCount,
      marchCount,
      power,
      rallySize,
      updatedAt,
      id
    );
  }

  function updateProfileFieldsRow(
    playerId: string | null,
    playerName: string | null,
    playerAvatar: string | null,
    kingdomId: number | null,
    troopCount: number | null,
    marchCount: number | null,
    power: number | null,
    rallySize: number | null,
    updatedAt: number,
    id: string
  ): RunResult {
    return updateProfileFields.run(
      playerId,
      playerName,
      playerAvatar,
      kingdomId,
      troopCount,
      marchCount,
      power,
      rallySize,
      updatedAt,
      id
    );
  }

  function updateProfileStatusRow(
    status: string,
    role: string,
    updatedAt: number,
    id: string
  ): RunResult {
    return updateProfileStatus.run(status, role, updatedAt, id);
  }

  return {
    getUserByDiscordId,
    getUserById,
    getProfileById,
    getProfileByPlayerId,
    getProfilesByUser,
    getAllianceById,
    listAlliances,
    listAlliancesByKingdom,
    listAdminKingdoms,
    listAllianceProfiles,
    listEligibleMembers,
    listEligibleBearMembers,
    listBearGroupMembers,
    getBearMemberByPlayer,
    upsertBearMember: upsertBearMemberRow,
    updateProfileRallySize: updateProfileRallySizeRow,
    deleteBearGroup,
    deleteBearMember,
    updateProfileStatsForMember,
    deleteProfile,
    deleteMemberForPlayer,
    deleteBearForPlayer,
    deleteMembersForAlliance,
    deleteMetaForAlliance,
    deleteBearForAlliance,
    resetProfilesAlliance,
    deleteAlliance,
    deleteAllianceCascade,
    insertAlliance: insertAllianceRow,
    countActiveProfiles,
    insertUser: insertUserRow,
    updateUser: updateUserRow,
    updateUserBotOptIn: updateUserBotOptInRow,
    insertBootstrapRow: insertBootstrapRowOnce,
    insertSession: insertSessionRow,
    getSession,
    deleteSession: deleteSessionRow,
    getAllianceGuildByAllianceId,
    getAllianceGuildByGuildId,
    upsertAllianceGuild: upsertAllianceGuildRow,
    deleteAllianceGuildByAlliance: deleteAllianceGuildByAlliance,
    listOptedInAssignmentRecipients,
    insertAssignmentNotification: insertAssignmentNotificationRow,
    listPendingAssignmentNotificationsByAlliance,
    listPendingAssignmentNotificationsAll,
    listFailedAssignmentNotificationsByAlliance,
    listFailedAssignmentNotificationsAll,
    updateAssignmentNotificationStatus: updateAssignmentNotificationStatusRow,
    deletePendingAssignmentNotificationsForAlliance,
    deleteAssignmentNotificationsBeforeTimestamp,
    insertProfile: insertProfileRow,
    updateProfile: updateProfileRow,
    updateProfileClaim: updateProfileClaimRow,
    updateProfileFields: updateProfileFieldsRow,
    updateProfileStatus: updateProfileStatusRow,
  };
}

export type Queries = ReturnType<typeof createQueries>;
