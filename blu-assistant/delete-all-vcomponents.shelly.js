/**
 * @title Delete all virtual components
 * @description Removes all dynamic virtual components and groups with throttled RPC calls.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/blu-assistant/delete-all-vcomponents.shelly.js
 */

//
// delete_all_virtuals_throttled.shelly.js
//
(function() {
  // your own script ID, used to stop it when we're done
  var SCRIPT_ID = Shelly.getCurrentScriptId();

  // entry point: fetch the list and kick off deletion
  function deleteAll() {
    Shelly.call("Shelly.GetComponents", { dynamic_only: true }, function(res, err) {
      if (err) {
        print("Error fetching components: " + JSON.stringify(err));
        return;
      }
      var comps = res.components || [];
      if (comps.length === 0) {
        print("✅ No virtual components/groups left. Stopping script.");
        Shelly.call("Script.Stop", { id: SCRIPT_ID });
        return;
      }
      deleteOne(comps, 0);
    });
  }

  // delete comps[idx], then after 200 ms move on to the next one
  function deleteOne(comps, idx) {
    if (idx >= comps.length) {
      // finished this batch – wait a moment then re-run to catch leftovers
      Timer.set(500, false, deleteAll);
      return;
    }
    var key = comps[idx].key;
    print("🗑️ Deleting " + key + "…");
    Shelly.call("Virtual.Delete", { key: key }, function(res2, err2) {
      if (err2) {
        print("❌ Failed to delete " + key + ": " + JSON.stringify(err2));
      } else {
        print("✔️ Deleted " + key);
      }
      // throttle to ~5 calls/sec
      Timer.set(200, false, function() {
        deleteOne(comps, idx + 1);
      });
    });
  }

  // run immediately on load
  deleteAll();
})();
