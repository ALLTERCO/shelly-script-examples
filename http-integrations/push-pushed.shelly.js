/**
 * @title Push notifications using Pushed service
 * @description Use a script to notify directly on your mobile phone via a push
 *   notification service.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/push-pushed.shelly.js
 */

let CONFIG = {
  PUSHED_URL: 'https://api.pushed.co/1/push',
  PUSHED_APP_KEY: null,
  PUSHED_APP_SECRET: null,
  PUSHED_TARGET_TYPE: "app",
};

function getPushedDataObject(msg) {
  if (CONFIG.PUSHED_APP_KEY === null) return null;
  if (CONFIG.PUSHED_APP_SECRET === null) return null;
  if (typeof msg === "undefined" || msg === null) return null;
  //object with keys as expected by Pushed
  let result = {
    app_key: CONFIG.PUSHED_APP_KEY,
    app_secret: CONFIG.PUSHED_APP_SECRET,
    target_type: CONFIG.PUSHED_TARGET_TYPE,
    content: msg,
  };
  return result;
}

//JS object to x-www-form-urlencoded
function prepareFormData(pushed_obj) {
  let post_body_arr = [];
  for (let i in pushed_obj) {
    post_body_arr.push(i + "=" + pushed_obj[i]);
  }
  let result = "";
  for (let a_i in post_body_arr) {
    if (result.length > 0) result += "&";
    result += post_body_arr[a_i];
  }
  return result;
}

let notificationInFlight = false;
function sendNotification(msg) {
  //bail out if we are sending at the moment, prevent spam
  if (notificationInFlight) return false;
  let pushed_data = getPushedDataObject(msg);
  if(pushed_data === null) return;
  let pushed_form_data = prepareFormData(pushed_data);
  Shelly.call(
    "HTTP.POST",
    {
      url: CONFIG.PUSHED_URL,
      content_type: "application/x-www-form-urlencoded",
      ssl_ca: "*",
      timeout: 10,
      body: pushed_form_data,
    },
    function (result, err_code, err_message) {
      if (err_code !== 0) print(err_message);
      console.log("Pushed result", JSON.stringify(result));
    }
  );
}

sendNotification("A message from Shelly");
