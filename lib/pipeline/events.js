import { Events } from "@borealise/shared";

export function onUserUpdate(client, handler) {
  return client.on(Events.USER_UPDATE, handler);
}

export function onUserPresenceUpdate(client, handler) {
  return client.on(Events.USER_PRESENCE_UPDATE, handler);
}

export function onUserTyping(client, handler) {
  return client.on(Events.USER_TYPING, handler);
}

export function onUserLevelUp(client, handler) {
  return client.on(Events.USER_LEVEL_UP, handler);
}

export function onSessionCreate(client, handler) {
  return client.on(Events.SESSION_CREATE, handler);
}

export function onSessionDelete(client, handler) {
  return client.on(Events.SESSION_DELETE, handler);
}

export function onSessionUpdate(client, handler) {
  return client.on(Events.SESSION_UPDATE, handler);
}

export function onNotificationCreate(client, handler) {
  return client.on(Events.NOTIFICATION_CREATE, handler);
}

export function onNotificationDelete(client, handler) {
  return client.on(Events.NOTIFICATION_DELETE, handler);
}

export function onRoomJoin(client, handler) {
  return client.on(Events.ROOM_JOIN, handler);
}

export function onRoomLeave(client, handler) {
  return client.on(Events.ROOM_LEAVE, handler);
}

export function onRoomUpdate(client, handler) {
  return client.on(Events.ROOM_UPDATE, handler);
}

export function onRoomDelete(client, handler) {
  return client.on(Events.ROOM_DELETE, handler);
}

export function onRoomUserJoin(client, handler) {
  return client.on(Events.ROOM_USER_JOIN, handler);
}

export function onRoomUserLeave(client, handler) {
  return client.on(Events.ROOM_USER_LEAVE, handler);
}

export function onRoomUserKick(client, handler) {
  return client.on(Events.ROOM_USER_KICK, handler);
}

export function onRoomUserBan(client, handler) {
  return client.on(Events.ROOM_USER_BAN, handler);
}

export function onRoomUserMute(client, handler) {
  return client.on(Events.ROOM_USER_MUTE, handler);
}

export function onRoomUserUnmute(client, handler) {
  return client.on(Events.ROOM_USER_UNMUTE, handler);
}

export function onRoomUserRoleUpdate(client, handler) {
  return client.on(Events.ROOM_USER_ROLE_UPDATE, handler);
}

export function onRoomUserAvatarUpdate(client, handler) {
  return client.on(Events.ROOM_USER_AVATAR_UPDATE, handler);
}

export function onRoomUserSubscriptionUpdate(client, handler) {
  return client.on(Events.ROOM_USER_SUBSCRIPTION_UPDATE, handler);
}

export function onRoomChatMessage(client, handler) {
  return client.on(Events.ROOM_CHAT_MESSAGE, handler);
}

export function onRoomChatDelete(client, handler) {
  return client.on(Events.ROOM_CHAT_DELETE, handler);
}

export function onRoomChatUpdate(client, handler) {
  return client.on(Events.ROOM_CHAT_UPDATE, handler);
}

export function onRoomDjAdvance(client, handler) {
  return client.on(Events.ROOM_DJ_ADVANCE, handler);
}

export function onRoomDjUpdate(client, handler) {
  return client.on(Events.ROOM_DJ_UPDATE, handler);
}

export function onRoomWaitlistJoin(client, handler) {
  return client.on(Events.ROOM_WAITLIST_JOIN, handler);
}

export function onRoomWaitlistLeave(client, handler) {
  return client.on(Events.ROOM_WAITLIST_LEAVE, handler);
}

export function onRoomWaitlistUpdate(client, handler) {
  return client.on(Events.ROOM_WAITLIST_UPDATE, handler);
}

export function onRoomWaitlistLock(client, handler) {
  return client.on(Events.ROOM_WAITLIST_LOCK, handler);
}

export function onRoomWaitlistCycle(client, handler) {
  return client.on(Events.ROOM_WAITLIST_CYCLE, handler);
}

export function onRoomTimeSync(client, handler) {
  return client.on(Events.ROOM_TIME_SYNC, handler);
}

export function onRoomVote(client, handler) {
  return client.on(Events.ROOM_VOTE, handler);
}

export function onRoomGrab(client, handler) {
  return client.on(Events.ROOM_GRAB, handler);
}

export function onFriendRequest(client, handler) {
  return client.on(Events.FRIEND_REQUEST, handler);
}

export function onFriendRequestCancel(client, handler) {
  return client.on(Events.FRIEND_REQUEST_CANCEL, handler);
}

export function onFriendAccept(client, handler) {
  return client.on(Events.FRIEND_ACCEPT, handler);
}

export function onFriendRemove(client, handler) {
  return client.on(Events.FRIEND_REMOVE, handler);
}

export function onSystemMessage(client, handler) {
  return client.on(Events.SYSTEM_MESSAGE, handler);
}

export function onMaintenance(client, handler) {
  return client.on(Events.MAINTENANCE, handler);
}

export function onRateLimit(client, handler) {
  return client.on(Events.RATE_LIMIT, handler);
}
