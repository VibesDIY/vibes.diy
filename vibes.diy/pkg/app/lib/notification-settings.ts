import { isUserSettingNotifications } from "@vibes.diy/api-types";
import type { UserSettingItem, UserSettingNotifications } from "@vibes.diy/api-types";

export interface NotificationSettings {
  buildComplete: boolean;
  buildFailed: boolean;
  vibePublished: boolean;
  commentPosted: boolean;
  accessRequestPending: boolean;
}

export const defaultNotificationSettings: NotificationSettings = {
  buildComplete: true,
  buildFailed: true,
  vibePublished: true,
  commentPosted: true,
  accessRequestPending: true,
};

export function toNotificationSettings(setting?: UserSettingNotifications): NotificationSettings {
  return {
    buildComplete: setting?.buildComplete ?? defaultNotificationSettings.buildComplete,
    buildFailed: setting?.buildFailed ?? defaultNotificationSettings.buildFailed,
    vibePublished: setting?.vibePublished ?? defaultNotificationSettings.vibePublished,
    commentPosted: setting?.commentPosted ?? defaultNotificationSettings.commentPosted,
    accessRequestPending: setting?.accessRequestPending ?? defaultNotificationSettings.accessRequestPending,
  };
}

export function getNotificationSettings(settings: readonly UserSettingItem[]): NotificationSettings {
  return toNotificationSettings(settings.find(isUserSettingNotifications));
}
