// Agata — smoke tests for the React Query hook surface. Real mutation/query
// behavior is covered by the integration tests on the server functions and
// the repo; here we just verify the hook modules export the expected names
// so a refactor that drops a hook fails this test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as client from "@/lib/api/client";

describe("api/client hook surface", () => {
  it("exports the query-key namespace", () => {
    assert.equal(typeof client.qk, "object");
    assert.deepEqual(client.qk.books, ["books"]);
    assert.equal(typeof client.qk.book, "function");
    assert.equal(typeof client.qk.notesForBook, "function");
    assert.equal(typeof client.qk.sessionsBetween, "function");
  });

  it("exports all book hooks", () => {
    for (const name of [
      "useBooksQuery",
      "useBookQuery",
      "useCreateBookMutation",
      "useUpdateBookMutation",
      "useDeleteBookMutation",
      "useBumpCurrentPageMutation",
    ]) {
      assert.equal(typeof (client as Record<string, unknown>)[name], "function", name);
    }
  });

  it("exports all note hooks", () => {
    for (const name of [
      "useNotesQuery",
      "useNotesForBookQuery",
      "useCreateNoteMutation",
      "useUpdateNoteMutation",
      "useDeleteNoteMutation",
    ]) {
      assert.equal(typeof (client as Record<string, unknown>)[name], "function", name);
    }
  });

  it("exports all session hooks", () => {
    for (const name of [
      "useSessionsQuery",
      "useSessionsForBookQuery",
      "useSessionsBetweenQuery",
      "useCreateSessionMutation",
      "useDeleteSessionMutation",
    ]) {
      assert.equal(typeof (client as Record<string, unknown>)[name], "function", name);
    }
  });

  it("exports goals + settings hooks", () => {
    for (const name of [
      "useGoalsQuery",
      "useSetGoalsMutation",
      "useSettingQuery",
      "useSetSettingMutation",
      "useDbHealthQuery",
    ]) {
      assert.equal(typeof (client as Record<string, unknown>)[name], "function", name);
    }
  });

  it("qk.* helpers build stable, comparable keys", () => {
    // Compare by content (JSON), not by reference — each call returns a new array.
    assert.equal(JSON.stringify(client.qk.book("x")), JSON.stringify(client.qk.book("x")));
    assert.notEqual(JSON.stringify(client.qk.book("x")), JSON.stringify(client.qk.book("y")));
    assert.equal(
      JSON.stringify(client.qk.sessionsBetween("a", "b")),
      JSON.stringify(client.qk.sessionsBetween("a", "b")),
    );
  });
});
