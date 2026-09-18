//This script sends the import/export power value and voltage from your solar installation to OpenEVSE to regulate charging without needing an MQTT broker.
//Change the IP address to match your OpenEVSE. The script sends data every 5 seconds.
//The example is made for a Shelly Pro EM, reading channel 0 (EM1 id:0).

//Instructions:
//Access Shelly web interface > Scripts > Create
//Paste the script below, enable Autostart: On, Save and Start
//Verify in console (Scripts > Console) that it prints "Enviado cada 5s"

//Author: EA4GKQ

let ipOpenEVSE = "192.168.3.254";

function sendPower() {
  Shelly.call("EM1.GetStatus",{ id: 0 },
      function(status) {
        if (status && status.act_power) {
          let powerValue = 0;  // Variable global para act_power
          let voltageValue = 0;  // Variable global para act_power
          powerValue = status.act_power;
          voltageValue =  status.voltage;
          print("act_power obtenido: " + powerValue+" w");
          
          print("voltaje obtenido: " + voltageValue+" v" );
          
          let body = "{\"grid_ie\": " + powerValue + ",\"voltage\": " + voltageValue + "}";
          
          Shelly.call(
            "HTTP.POST", 
            {"url": "http://"+ipOpenEVSE+"/status", "body": body},
            function (response) {
              if (response && response.code === 200) {
                 print("Enviado: " + body);
                 Shelly.emitEvent("HTTP-result", response.body);
              } else {
                 print("Error HTTP: " + JSON.stringify(response));
              }
            }
          );
        } else {
          print("Error: status EM1 inválido " + JSON.stringify(status));
        }
      }
  );

}

// Inicia timer cada 5 segundos (5000 ms), repetitivo
timerHandle = Timer.set(5000, true, sendPower);
print("🚀 Solar-to-OpenEVSE timer started: 5s interval");
