import { describe, it, expect } from "vitest";
import { scoreCell } from "./score.js";

describe("scoreCell", () => {
  it("grades a clean per-visitor cell PASS using static + judge", async () => {
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ if(oldDoc && oldDoc.authorHandle!==user.userHandle) throw {forbidden:true}; if(doc.authorHandle!==user.userHandle) throw {forbidden:true}; return {channels:[`user:${user.userHandle}`], grant:{users:{[user.userHandle]:[`user:${user.userHandle}`]}}} }",
    };
    const judge = async () => ({ secondVisitorCanAct: true, reason: "ok" });
    const r = await scoreCell({ expect: "per-visitor", prompt: "A todo list app", files }, { judge });
    expect(r.grade).toBe("PASS");
    expect(r.formAStrict).toBe(false);
    expect(r.twoFile).toBe(true);
  });

  it("does not invoke the judge for a non-multiplayer (owner-published) dimension", async () => {
    let called = false;
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ ctx.requireRole('owner'); return {channels:['posts'], grant:{public:['posts']}} }",
    };
    const judge = async () => {
      called = true;
      return { secondVisitorCanAct: true, reason: "ok" };
    };
    const r = await scoreCell({ expect: "owner-published", prompt: "My personal blog", files }, { judge });
    expect(called).toBe(false);
    expect(r.grade).toBe("PASS");
  });

  it("FAILs a Form-A per-visitor cell", async () => {
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js":
        "export default function access(doc,oldDoc,user){ if(doc.type==='habit') return ctx.requireRole('owner'); return {channels:['habits']} }",
    };
    const judge = async () => ({ secondVisitorCanAct: true, reason: "ok" });
    const r = await scoreCell({ expect: "per-visitor", prompt: "A daily habit tracker", files }, { judge });
    expect(r.grade).toBe("FAIL");
    expect(r.formAStrict).toBe(true);
  });
});
