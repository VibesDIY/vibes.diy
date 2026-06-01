// Pickathon Picker — per-user channels with friend grants
//
// Channels:
//   faves-{userSlug}       user's favorited events
//   notes-{userSlug}       user's event notes
//   shifts-{userSlug}      user's extra shifts (meals, breaks, etc.)
//   friendship-{a}-{b}     invite state between two users (a < b)
//
// Friendship grants:
//   Accepted invite always grants mutual faves.
//   shareNotes / shareShifts toggles grant those channels too.

export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use Pickathon Picker" };

  const type = doc.type || (oldDoc && oldDoc.type);

  switch (type) {
    case "favorite": {
      if (oldDoc && oldDoc.userId !== user.userSlug) {
        throw { forbidden: "can only modify your own favorites" };
      }
      return {
        channel: `faves-${user.userSlug}`,
        grant: { users: { [user.userSlug]: [`faves-${user.userSlug}`] } },
      };
    }

    case "note": {
      if (oldDoc && oldDoc.userId !== user.userSlug) {
        throw { forbidden: "can only modify your own notes" };
      }
      return {
        channel: `notes-${user.userSlug}`,
        grant: { users: { [user.userSlug]: [`notes-${user.userSlug}`] } },
      };
    }

    case "shift": {
      if (oldDoc && oldDoc.userId !== user.userSlug) {
        throw { forbidden: "can only modify your own shifts" };
      }
      return {
        channel: `shifts-${user.userSlug}`,
        grant: { users: { [user.userSlug]: [`shifts-${user.userSlug}`] } },
      };
    }

    case "invite": {
      const from = doc.from || (oldDoc && oldDoc.from);
      const to = doc.to || (oldDoc && oldDoc.to);
      if (!from || !to) throw { forbidden: "invite requires from and to" };
      if (from === to) throw { forbidden: "cannot invite yourself" };

      const pair = [from, to].sort().join("-");
      const channel = `friendship-${pair}`;

      if (user.userSlug !== from && user.userSlug !== to) {
        throw { forbidden: "only participants can modify invites" };
      }

      // New invite — sender creates it
      if (!oldDoc) {
        if (from !== user.userSlug) throw { forbidden: "can only invite as yourself" };
        return {
          channel,
          grant: { users: { [from]: [channel], [to]: [channel] } },
        };
      }

      // Acceptance — only invitee can flip to accepted
      if (doc.status === "accepted" && oldDoc.status !== "accepted") {
        if (user.userSlug !== to) throw { forbidden: "only the invitee can accept" };
      }

      const grants = { [from]: [channel], [to]: [channel] };

      if (doc.status === "accepted") {
        // Mutual faves — always on for accepted friends
        grants[from].push(`faves-${to}`);
        grants[to].push(`faves-${from}`);

        if (doc.shareNotes) {
          grants[from].push(`notes-${to}`);
          grants[to].push(`notes-${from}`);
        }
        if (doc.shareShifts) {
          grants[from].push(`shifts-${to}`);
          grants[to].push(`shifts-${from}`);
        }
      }

      return { channel, grant: { users: grants } };
    }

    default:
      throw { forbidden: `unknown document type: ${type}` };
  }
}
