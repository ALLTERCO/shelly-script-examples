/**
 * Shelly script example of using HTTP handlers
 * Implemeting a simple HTTP server with action handlers
 *
 * Usage:
 * call the setup action on your shelly
 * curl 'http://<SHELLY-IP>/script/<SCRIPT-ID>/api?action=setup'
 *
 * call the profile action, pass the profile parameter
 * see handleProfile method
 * curl 'http://<SHELLY-IP>/script/<SCRIPT-ID>/api?action=profile&profile=<local|remote>'
 */

//as hoisting is not supported in Shelly Scripting
//we introduce a registration method
const CONFIG = {
  url_segment: "api",
  action_param: "action",
  actions: {},
  registerActionHandler: function(actionParamValue,handler) {
    this.actions[actionParamValue] = handler;
  }
};

//prototype of a handler response
let resultProto = {
  msg: "",
  code: 200,
};

// action handlers below

//this is just a dummy handler, nothing interesting
let handleSetup = function(qsParams, response) {
  response.code = 200;
  response.body = "Setup: successful";
  response.send();
}

//switch between detached and follow mode for the first switch
let handleProfile = function(qsParams, response) {
  if (typeof qsParams.profile === "undefined") {
    response.code = 424;
    response.body = "Missing parameter profile";
    response.send();
    return;
  };
  let _config = {
    in_mode : "detached"
  }
  if (qsParams.profile === "local") {
    _config.in_mode = "follow";
    _config.initial_state = "off";
  }
  Shelly.call(
    "switch.setconfig",
    {
      id: 0,
      config: _config
    },
    function (res, err_code, err_msg) {
      if (err_code !== 0) {
        response.code = 400;
        response.body = err_msg;
        response.send();
      } else {
        response.code = 200;
        response.body = "Successful profile setup";
        response.send();
      }
    }
  );
}

CONFIG.registerActionHandler('setup', handleSetup);
CONFIG.registerActionHandler('profile', handleProfile);

//No need to adapt anything below
function parseQS(qs) {
  let params = {};
  if (qs.length === 0) return params;
  let paramsArray = qs.split("&");
  for (let idx in paramsArray) {
    let kv = paramsArray[idx].split("=");
    params[kv[0]] = kv[1] || null;
  }
  return params;
}

function httpServerHandler(request, response) {
  let responseCode = 200;
  let responseBody = "";
  let params = parseQS(request.query);
  let actionParam = params[CONFIG.action_param];
  console.log('Action param', actionParam);
  console.log(JSON.stringify(params));
  if (
    typeof actionParam === "undefined" ||
    typeof CONFIG.actions[actionParam] === "undefined" ||
    CONFIG.actions[actionParam] === null
  ) {
    response.code = 400;
    response.body =
      "No " +
      CONFIG.action_param +
      " parameter in query string or no action defined";
    response.send();
  } else {
    CONFIG.actions[actionParam](params, response);
    console.log("Handler called");
  }
}

//we don't handle failure of this method
//as according to docs it abort the entire script
HTTPServer.registerEndpoint(CONFIG.url_segment, httpServerHandler);
