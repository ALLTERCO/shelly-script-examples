// ---------------------------------------------------------------------------------------------------------------------
// SCRIPT FOR READING EXTERNAL DHT22 SENSOR WITH SHELLY WALL DISPLAY
// Luca Bartolini - Larciano (PT) Italy - luca@bitcon.it
// Indipendent Developer
// written in August 2024
// this script runs inside a shelly plus with Addon and DHT22 sensor
// it reads temperature/humidity from DHT22 wired sensor, and then put adjustments (delta) to a shelly wall-display
// in this way the wall display will show temp/humi from DHT22, and not from its local sensors.
// ---------------------------------------------------------------------------------------------------------------------
let CONFIG = {
  // url address of shelly wall display
  urlTermostato: "http://192.168.0.10",
  // url address of shelly plus with temperature sensor DHT22
  // this is the address where this program is running on
  urlSensoreInterno: "http://192.168.0.16",
  // http timeout query thermostat
  httpTimeout: 10,
  // timer in seconds for thermostat status polling. 
  lkTime: 10,
  // timer in seconds for temperature adjustments.
  lkTimeLungo: 60,
  
  // default value for temperature reading error.
  lkErrorValue: -273,
  // if set to 1  the module will print detailed informations in general log.
  lkDebugEnable: 0,
};

let tmpTimer = null;
let pingTimer = null;
let pingTimer_temperaturePoll = null;
let pingTimer_temperatureAdj = null;
let pingTimer_humidityPoll = null;

// structure to save values in asyncronous calls
let obj_temp = {
    f_offset_temp:0,
    f_offset_humi:0,
    f_disp_temp:0,
    f_disp_humi:0,
    f_sensor_temp:0,
    f_sensor_humi:0,
}

// print a info string in general log, if debug is enabled
function fnPrintDebug(par_s) {
  if (CONFIG.lkDebugEnable==1) {
    print('[luke_script_temperature]' + par_s);
  }
}
// print error in gemeral log
function fnPrintError(par_s) {
  print('[luke_script_temperature] ERROR ' + par_s);
}

// read thermostat status (short timer)
function fnPolling() {
  fnLeggiStatusTermostato();
}

// read temperature (long timer)
function fnTemperaturePoll() {
  fnLeggiParametro(CONFIG.urlTermostato + '/rpc/Temperature.GetConfig?id=0', 'offset_C', 'f_offset_temp');
  fnLeggiParametro(CONFIG.urlTermostato + '/rpc/Temperature.GetStatus?id=0', 'tC', 'f_disp_temp');
  fnLeggiParametro(CONFIG.urlSensoreInterno + '/rpc/Temperature.GetStatus?id=100', 'tC', 'f_sensor_temp');
}

// read humidity (long timer)
function fnHumidityPoll() {
  fnLeggiParametro(CONFIG.urlTermostato + '/rpc/Humidity.GetConfig?id=0', 'offset', 'f_offset_humi');
  fnLeggiParametro(CONFIG.urlTermostato + '/rpc/Humidity.GetStatus?id=0', 'rh', 'f_disp_humi');
  fnLeggiParametro(CONFIG.urlSensoreInterno + '/rpc/Humidity.GetStatus?id=100', 'rh', 'f_sensor_humi');
}

// temp/umidity adjustments (long timer)
function fnTemperatureAdjust() {
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - f_sensor_temp : " + obj_temp['f_sensor_temp']);
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - f_disp_temp: " + obj_temp['f_disp_temp']);
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - f_offset_temp: " + obj_temp['f_offset_temp']);
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - f_sensor_humi : " + obj_temp['f_sensor_humi']);
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - f_disp_humi: " + obj_temp['f_disp_humi']);
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - f_offset_humi: " + obj_temp['f_offset_humi']);  
  
  // calculate new temperature adn humidity offset
  f_New_offset_temp = obj_temp['f_sensor_temp'] - (obj_temp['f_disp_temp'] - obj_temp['f_offset_temp']);
  f_New_offset_humi = obj_temp['f_sensor_humi'] - (obj_temp['f_disp_humi'] - obj_temp['f_offset_humi']);
  if (f_New_offset_humi>50) {
    f_New_offset_humi=50;
  }
  if (f_New_offset_humi<-50) {
    f_New_offset_humi=-50;
  }
  
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - new offset temp: " + f_New_offset_temp);
  fnPrintDebug("[fnTemperatureAdjust] DEBUG - new offset humi: " + f_New_offset_humi);
  
  // write new offsets in wall display
  fnScriviParametro(CONFIG.urlTermostato + '/rpc/Temperature.SetConfig?id=0&config={"offset_C":' + f_New_offset_temp + '}');  
  fnScriviParametro(CONFIG.urlTermostato + '/rpc/Humidity.SetConfig?id=0&config={"offset":' + f_New_offset_humi + '}');  

}



// function to set a local variable (KVS)
function kvsSet(key, value) {
    Shelly.call(
        "KVS.Set",
        { "key": key, "value": value }
    );
}



// generic function that reads a parameter with http get.
// p_url: address of device to read
// p_nome: parameter to read from json response
// p_variablename: name of variable where store value in structure "obj_temp" (this because the variable writing is asyncronous)
function fnLeggiParametro(p_url, p_nome, p_variablename) {
  Shelly.call(
    "http.get",
    { url: p_url, timeout: CONFIG.httpTimeout },
    function (response, error_code, error_message) {
      if (error_code != 0) {
        fnPrintError("[fnLeggiParametro] Failed to fetch, error(" + error_code + ") " + error_message + ' - url: ' + p_url);
      } else {
        if (response === undefined) {
          fnPrintError("[fnLeggiParametro] ERROR response undefined");
        } else {
          responseData = JSON.parse(response.body);
          obj_temp[p_variablename] = responseData[p_nome];
          fnPrintDebug("[fnLeggiParametro] DEBUG lettura " + p_variablename + ' ' + p_nome + ' ' + responseData[p_nome]);
        }
      }
    }
  );   
}

// generic function that writes a parameter with http get
// p_url: address of device to write
function fnScriviParametro(p_url) {
  Shelly.call(
    "http.get",
    { url: p_url, timeout: CONFIG.httpTimeout },
    function (response, error_code, error_message) {
      if (error_code != 0) {
        fnPrintError("[fnScriviParametro] Failed to fetch, error(" + error_code + ") " + error_message + ' - url: ' + p_url);
      } else {
        // tutto ok
        if (response === undefined) {
          fnPrintError("[fnScriviParametro] ERROR response undefined");
        } else {
          responseData = JSON.parse(response.body);
          fnPrintDebug("[fnScriviParametro] DEBUG response: " + response.body);
        }
      }
    }
  );   
}


// function that periodically reads wall display config to retrieve "season" informations
// the season information is stored in a KVS variable "par_stagione"
function fnLeggiStatusTermostato() {
  fnPrintDebug("Leggi Termostato");
  Shelly.call(
    "http.get",
    { url: CONFIG.urlTermostato + '/rpc/Thermostat.GetConfig?id=0', timeout: CONFIG.httpTimeout },
    function (response, error_code, error_message) {
      if (error_code != 0) {
        fnPrintError("[fnLeggiStatusTermostato] Failed to fetch, error(" + error_code + ") " + CONFIG.urlTermostato);
      } else {
        // all ok
        if (response === undefined) {
          fnPrintError("[fnLeggiStatusTermostato] ERROR response ");
        } else {
          let responseData = JSON.parse(response.body);
          
          if (responseData["type"]=="cooling") {
			  // set a value in current shelly to define SUMMER season. (cooling mode)
             fnPrintDebug("SUMMER Season");
             kvsSet("par_stagione","cooling");
          }
          if (responseData["type"]=="heating") {
			  // set a value in current shelly to define WINTER season. (heating mode)
             fnPrintDebug("WINTER Season");
             kvsSet("par_stagione","heating");
          }
        }
      }
    }
  );
}

// delay to shedule ciclic temperature poll
function fnScheduleTemperaturePoll() {
  fnPrintDebug("Start watchdog timer fnTemperaturePoll");
  Timer.clear(tmpTimer);
  
  // schedule temperature poll
  pingTimer_temperaturePoll = Timer.set(CONFIG.lkTimeLungo * 1000, true, fnTemperaturePoll);
  
  // delayed start timer to schedule humidity polling
  tmpTimer = Timer.set(6000, false, fnScheduleHumidityPoll);    
}

function fnScheduleHumidityPoll() {
  fnPrintDebug("Start watchdog timer fnHumidityPoll");
  Timer.clear(tmpTimer);
  
  // schedule humidity polling
  pingTimer_humidityPoll = Timer.set(CONFIG.lkTimeLungo * 1000, true, fnHumidityPoll);
  
  // ddelayed start timer to schedule temp/humi adjustments
  tmpTimer = Timer.set(6000, false, fnScheduleTemperatureAdjust);   
}

function fnScheduleTemperatureAdjust() {
  fnPrintDebug("Start watchdog timer fnTemperatureAdjust");
  Timer.clear(tmpTimer);
  
  // schedule temp/humi adjustments
  pingTimer_temperatureAdj = Timer.set(CONFIG.lkTimeLungo * 1000, true, fnTemperatureAdjust);
}


fnPrintDebug("Start watchdog main timer");
// schedule main polling routine (short timer)
pingTimer = Timer.set(CONFIG.lkTime * 1000, true, fnPolling);

// delayed schedule of temperature polling
tmpTimer = Timer.set(6000, false, fnScheduleTemperaturePoll);
