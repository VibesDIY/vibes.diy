import {
  EvtRequestGrant,
  EvtUserNotification,
  isEvtDocChanged,
  isEvtRequestGrant,
  isEvtUserNotification,
  msgBase,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { VibeDiyApiConnection } from "./api-connection.js";

type ListenerDetacher = () => void;

async function decodeMessagePayload(raw: unknown): Promise<unknown> {
  if (raw instanceof Blob) {
    return JSON.parse(await raw.text());
  }
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  return JSON.parse(new TextDecoder().decode(raw as Uint8Array));
}

function attachPayloadListener<P>(
  conn: VibeDiyApiConnection,
  isPayload: (payload: unknown) => payload is P,
  onPayload: (payload: P) => void
): ListenerDetacher {
  const unsub = conn.onMessage((wsEvent) => {
    if (wsEvent.type !== "MessageEvent") return;
    decodeMessagePayload(wsEvent.event.data)
      .then((parsed) => {
        const msg = msgBase(parsed);
        if (!(msg instanceof type.errors) && isPayload(msg.payload)) {
          onPayload(msg.payload);
        }
      })
      .catch((_e: unknown) => {
        // Not a valid message — ignore
      });
  });
  return () => {
    unsub();
  };
}

export function attachDocChangedToConnection(
  conn: VibeDiyApiConnection,
  fn: (ownerHandle: string, appSlug: string, dbName: string, docId: string) => void
): ListenerDetacher {
  return attachPayloadListener(conn, isEvtDocChanged, (payload) => {
    fn(payload.ownerHandle, payload.appSlug, payload.dbName, payload.docId);
  });
}

export function attachRequestGrantToConnection(conn: VibeDiyApiConnection, fn: (evt: EvtRequestGrant) => void): ListenerDetacher {
  return attachPayloadListener(conn, isEvtRequestGrant, (payload) => {
    fn(payload);
  });
}

export function attachUserNotificationToConnection(
  conn: VibeDiyApiConnection,
  fn: (evt: EvtUserNotification) => void
): ListenerDetacher {
  return attachPayloadListener(conn, isEvtUserNotification, (payload) => {
    fn(payload);
  });
}

export interface ReplayConnectionStateParams {
  conn: VibeDiyApiConnection;
  docChangedListeners: ((ownerHandle: string, appSlug: string, dbName: string, docId: string) => void)[];
  docChangedDetachers: Map<(ownerHandle: string, appSlug: string, dbName: string, docId: string) => void, ListenerDetacher>;
  requestGrantListeners: ((evt: EvtRequestGrant) => void)[];
  requestGrantDetachers: Map<(evt: EvtRequestGrant) => void, ListenerDetacher>;
  userNotificationListeners: ((evt: EvtUserNotification) => void)[];
  userNotificationDetachers: Map<(evt: EvtUserNotification) => void, ListenerDetacher>;
  docSubscriptions: { ownerHandle: string; appSlug: string; dbName: string }[];
  requestGrantSubscriptions: { ownerHandle: string; appSlug: string }[];
  userNotificationSubscribed: boolean;
  subscribeDocs: (sub: { ownerHandle: string; appSlug: string; dbName: string }) => Promise<unknown>;
  subscribeRequestGrants: (sub: { ownerHandle: string; appSlug: string }) => Promise<unknown>;
  subscribeUserNotifications: (req: object) => Promise<unknown>;
}

export function replayConnectionState(params: ReplayConnectionStateParams): void {
  const {
    conn,
    docChangedListeners,
    docChangedDetachers,
    requestGrantListeners,
    requestGrantDetachers,
    userNotificationListeners,
    userNotificationDetachers,
    docSubscriptions,
    requestGrantSubscriptions,
    userNotificationSubscribed,
    subscribeDocs,
    subscribeRequestGrants,
    subscribeUserNotifications,
  } = params;

  // Re-attach all onDocChanged listeners to the new connection
  for (const fn of docChangedListeners) {
    docChangedDetachers.get(fn)?.();
    const detach = attachDocChangedToConnection(conn, fn);
    docChangedDetachers.set(fn, detach);
  }

  // Re-attach all onRequestGrant listeners to the new connection
  for (const fn of requestGrantListeners) {
    requestGrantDetachers.get(fn)?.();
    const detach = attachRequestGrantToConnection(conn, fn);
    requestGrantDetachers.set(fn, detach);
  }

  // Re-subscribe to all doc subscriptions (server needs to know again)
  for (const sub of docSubscriptions) {
    subscribeDocs(sub).catch((_e: unknown) => {
      /* re-subscribe best-effort; next reconnect will retry */
    });
  }

  // Re-subscribe to all request-grant subscriptions (server needs to know again)
  for (const sub of requestGrantSubscriptions) {
    subscribeRequestGrants(sub).catch((_e: unknown) => {
      /* re-subscribe best-effort; next reconnect will retry */
    });
  }

  // Re-attach all onUserNotification listeners to the new connection
  for (const fn of userNotificationListeners) {
    userNotificationDetachers.get(fn)?.();
    const detach = attachUserNotificationToConnection(conn, fn);
    userNotificationDetachers.set(fn, detach);
  }

  // Re-subscribe to user notifications if we had subscribed before (server needs to know again)
  if (userNotificationSubscribed) {
    void subscribeUserNotifications({}).catch((_e: unknown) => {
      /* best-effort */
    });
  }
}
