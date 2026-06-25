import { describe, it, expect } from "vitest";
import { scoreCell } from "./score.js";

const okConsent = async () => ({ hasConsentPath: true, accessLeakedWithoutConsent: false, reason: "ok" });

describe("scoreCell", () => {
  it("grades a clean per-visitor cell PASS using static + judge", async () => {
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ if(oldDoc && oldDoc.authorHandle!==user.userHandle) throw {forbidden:true}; if(doc.authorHandle!==user.userHandle) throw {forbidden:true}; return {channels:[`user:${user.userHandle}`], grant:{users:{[user.userHandle]:[`user:${user.userHandle}`]}}} }",
    };
    const judge = async () => ({ secondVisitorCanAct: true, reason: "ok" });
    const r = await scoreCell({ expect: "per-visitor", prompt: "A todo list app", files }, { judge, consentJudge: okConsent });
    expect(r.grade).toBe("PASS");
    expect(r.consentGrade).toBe("PASS");
    expect(r.formAStrict).toBe(false);
    expect(r.twoFile).toBe(true);
  });

  it("does not invoke either judge for a non-multiplayer (owner-published) dimension", async () => {
    let called = false;
    let consentCalled = false;
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ ctx.requireRole('owner'); return {channels:['posts'], grant:{public:['posts']}} }",
    };
    const judge = async () => {
      called = true;
      return { secondVisitorCanAct: true, reason: "ok" };
    };
    const consentJudge = async () => {
      consentCalled = true;
      return { hasConsentPath: true, accessLeakedWithoutConsent: false, reason: "ok" };
    };
    const r = await scoreCell({ expect: "owner-published", prompt: "My personal blog", files }, { judge, consentJudge });
    expect(called).toBe(false);
    expect(consentCalled).toBe(false);
    expect(r.grade).toBe("PASS");
    expect(r.consentGrade).toBe("PASS"); // static-OK: no token, single-writer shape
  });

  it("FAILs a Form-A per-visitor cell", async () => {
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ if(doc.type==='habit') return ctx.requireRole('owner'); return {channels:['habits']} }",
    };
    const judge = async () => ({ secondVisitorCanAct: true, reason: "ok" });
    const r = await scoreCell(
      { expect: "per-visitor", prompt: "A daily habit tracker", files },
      { judge, consentJudge: okConsent }
    );
    expect(r.grade).toBe("FAIL");
    expect(r.formAStrict).toBe(true);
  });

  it("consent rubric PASSes a collaborative per-visitor app that the shape rubric FAILs", async () => {
    // A todo built as per-object collaboration (request-to-join + requireAccess). The
    // shape-rigid rubric calls it "incomplete per-visitor" and the second-visitor judge
    // vetoes it; the consent rubric sees a consent-respecting path and passes. (#2631)
    const files = {
      "App.jsx": "export default function App(){ return <div>shared todo board hello friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user,ctx){ const ch=`board:${doc.boardId}`; if(doc.type==='request') return {channels:[ch]}; ctx.requireAccess(ch); return {channels:[ch]} }",
    };
    const judge = async () => ({ secondVisitorCanAct: false, reason: "must request to join" });
    const consentJudge = async () => ({
      hasConsentPath: true,
      accessLeakedWithoutConsent: false,
      reason: "can request + be approved",
    });
    const r = await scoreCell({ expect: "per-visitor", prompt: "A todo list app", files }, { judge, consentJudge });
    expect(r.grade).toBe("FAIL"); // shape-rigid rubric
    expect(r.consentGrade).toBe("PASS"); // consent-centric rubric
  });

  it("isOwner token hard-fails BOTH rubrics", async () => {
    const files = {
      "App.jsx": "export default function App(){ return <div>hello world friend here</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ if(doc.isOwner) return {channels:['x']}; return {channels:['x']} }",
    };
    const judge = async () => ({ secondVisitorCanAct: true, reason: "ok" });
    const r = await scoreCell({ expect: "per-visitor", prompt: "x", files }, { judge, consentJudge: okConsent });
    expect(r.isOwnerToken).toBe(true);
    expect(r.grade).toBe("FAIL");
    expect(r.consentGrade).toBe("FAIL");
  });
});
