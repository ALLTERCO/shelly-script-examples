let key = "";
let url = "https://api.telegram.org/bot" + key + "/getUpdates";
let offset = 0;

let CONFIG = {
  
};

let KVS = {
  load: function (key, callback) {
    Shelly.call(
      "KVS.Get", 
      { key: key },
      function (data, error, message, kvsObject) {
        if(error !== 0) {
          console.log("Cannot read the value for the provided key, reason:", message);
          return;
        }
        kvsObject[key] = data.value;
        if(callback) {
          callback();
        }
      },
      this
    );
  },

  write: function (key, value) {
    Shelly.call("KVS.Set", { key: key, value: value } );
  }
};

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

function printTest() {
  console.log(KVS.test);
}

KVS.load("test", printTest);