let key = "";
let url = "https://api.telegram.org/bot" + key + "/getUpdates";
let offset = 0;

Shelly.call("HTTP.GET", {
  url: url
}, function(d, r) {
  if(r !== 0) {
    return;
  }
  
  let data = JSON.parse(d.body);
  //offset = d.body.result[0].update_id + 1;
  //console.log(offset, d.body.result[0].text);
});