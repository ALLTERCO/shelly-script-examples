let CONFIG = {
    "time" : ["00:00","06:00","08:00","10:00","20:00","22:00"],
    "bright" : [30,50,90,100,80,60],
  };
  
  let hour, minutes, ph, pm, nh, nm = null;
  
  function getBrightness() {
      if (hour === null || minutes === null || CONFIG.time.length === 0) return;
  
      for(let i=0; i < CONFIG.time.length; i++){
          if (i!==CONFIG.time.length-1) {
              // get the first/previous
              ph = JSON.parse(CONFIG.time[i].slice(0, 2));
              pm = JSON.parse(CONFIG.time[i].slice(3, 5));
              // get the next time
              nh = JSON.parse(CONFIG.time[i+1].slice(0, 2));
              nm = JSON.parse(CONFIG.time[i+1].slice(3, 5));
              if (nm===0)
                nm = 60;
              // 04:35 00:00 06:00
              // console.log(hour,":",minutes," - ", ph,":",pm," - ", nh,":",nm);
              if (hour >= ph && hour < nh && minutes >= pm && minutes < nm){
                  console.log("new setting:",CONFIG.bright[i]);
                  return CONFIG.bright[i];
              }
          } else {
              // get the last time
              ph = JSON.parse(CONFIG.time[i].slice(0, 2));
              pm = JSON.parse(CONFIG.time[i].slice(3, 5));
              // get the first time
              nh = JSON.parse(CONFIG.time[0].slice(0, 2));
              nm = JSON.parse(CONFIG.time[0].slice(3, 5));
              if (nm===0)
                nm = 60;
              // 23:59 22:00 00:00
              if (hour >= ph && hour < 24 && minutes >= pm && minutes < 60){
                  console.log("new setting:",CONFIG.bright[i]);            
                  return CONFIG.bright[i];
              }
          }
      }
  }
  
  Shelly.call(
      'Sys.GetStatus',  
      {}, 
      function (status) {
          // get current time
          hour = JSON.parse(status.time.slice(0, 2));
          minutes = JSON.parse(status.time.slice(3, 5));
  
          let brightIntensity = getBrightness();
  
          Shelly.call(
              'Light.Set', 
              {"id":0, "brightness": brightIntensity},
              function () {
                  //stop the script after setting the brightness
                  Shelly.call("Script.Stop",{"id":1})
              },
              null
          );
      }
  );