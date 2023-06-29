// Copyright 2021 Allterco Robotics EOOD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Shelly is a Trademark of Allterco Robotics

// Shelly Script example: Control a open or close a Shelly Plus 2PM (Gen2) on cover mode
// by handling specific events
//
// The script, when run, will subscribe to events and handle "cover_open_to" and
// "cover_close_to" events.
//
// The script requires the event data to specify the desired position and optionally
// the hours and minutes of the day which the event should not be executed before.
//
// Example event data:
// {
//   "pos": 100,
//   "not_before": {
//     "h": 8,
//     "m": 0
//   }
// }
//
// Note: Currently, "not_before" is only supported for "cover_open_to" events.
//
// The event can be published on a schedule as follows:
//
// {
//   "id": 8,
//   "enable": true,
//   "timespec": "@sunrise+00h00m * * MON,TUE,WED,THU,FRI",
//   "calls": [
//       {
//           "method": "script.eval",
//           "params": {
//               "id": 1,
//               "code": "Shelly.emitEvent(\"cover_open_to\",{\"pos\":60,\"not_before\":{\"h\":7,\"m\":30})"
//           }
//       }
//   ]
// }
//
// The above example will publish the event at sunrise, top open the cover to position 60, but not before 7:30 AM.

function openCoverTo(pos) {
  var current_pos = Shelly.getComponentStatus("cover:0").current_pos;
  if (pos > current_pos) {
    Shelly.call("Cover.GoToPosition", {'id': 0, 'pos': pos});
  }
}

function closeCoverTo(pos) {
  var current_pos = Shelly.getComponentStatus("cover:0").current_pos;
  if (pos < current_pos) {
    Shelly.call("Cover.GoToPosition", {'id': 0, 'pos': pos});
  }
}
  
if (Shelly.getComponentConfig("sys").device.profile === "cover") {
  Shelly.addEventHandler(
    function (event, ud) {
      if (!event || !event.info) {
        return;
      }
      let event_name = event.info.event;
      if (event_name === "cover_open_to") {
        const data = event.info.data;
        if (!data || !data.pos) {
          return;
        }
        if (data && data.not_before && data.not_before.h) {
          const now = Date(Date.now());
          const diff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), data.not_before.h, data.not_before.m) - now;
          if (diff > 0) {
            Timer.set(
              diff ,
              false,
              function(pos) {
                  openCoverTo(pos);
              },
              data.pos
            );
            return;
          }
        }
        openCoverTo(data.pos);
      }
      else if (event_name === "cover_close_to") {
        let data = event.info.data;
        closeCoverTo(data.pos);
      }
    },
    null
  );
}
