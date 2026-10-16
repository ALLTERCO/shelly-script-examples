// WATER HEATER MANAGMENT FOR SOLAR INSTALLATION (Energy Router) WITH SHELLY PRO EM50 (French installation - Monophase)
// C.VIALLON: 2025 - christophe.viallon@gmail.com
// This script act as an "energy router" to start the water heater during the best moment of the day when there is solar overproduction,
// or during low prices time range (if using the HP/HC contract).
// It is designed to be totally independent and embeded in a uniq Shelly Pro EM 50,
// (with no Home Assistant need nor other shelly device), and use the Shelly switch to command a heater contact command (contacteur jour/nuit in French),
// normally managed by the C1/C2 of the Linky.
// Just connect the Shelly 2A contact to the heater contactor command as if it was the C1/C2 Linky contact (following the standard recommanded way of cabling).

// While basic, it permits to optimize the consume of overproduction of energy, with a water heater in a simillare way of an "Energy Router".
// Principle: 
// During the day, and during specific day time range (to target only specific time of potential overproduction during the day).
// the water heater is activated automatically if there is enough overproduction of energy (that normally goes back to provider for nothing if not sold).
// Overproduction threshold and power of the heater should be set in the "CONFIG" header object. 
// If enough overproduction, the water heater is activated for 10 minutes (configurable but we should probably avoid to activeted/desactivate it too often)+ an offset 
// (to be sure two successive triggers are overlapping).
// after 10 minutes it will test again overproduction and turn off heater if not enough production, of reint the counter for 10 mores minutes without turning the heater off and on again.
// The total minimum working time of the heater per day is configurable in CONFIG oject, and this time, next power off time of the contact are kept in KVS permanent storage
// so that the managment should cotinue normally even after power outage, or Shelly's restart.
// During the following night, if the minimum working day time wasn't met, a last activation of the heater occures, again in a specific time range (low price hours / HC), or no activation
// if the day working time was enought. The night time range for this acivation is also configurable (a prefer to activate after my batteries are empty).
// The day and night working time ranges permit to adjust when turning on the water heater, during day and night, for better efficiency.
// This permit to adjust the tun on, to when energy provider prices are the lowest, or when batteries are fully charged/discharged ...). 
// The two clamp meters should be connected in the following way:
// - EM1(0) = A on the house grid main phase cable
// - EM1(1) = B on the heater phase cable
// - The Shelly Pro EM 2A switch should be connected to the water heater managment switch in place of the Linky.
//
// Thanks to any other contributing people from ALTERCO git , from whom i copy/paste parts of this code (logging, schedule programming).

// CONSTANT PARAMETERS:
var CONFIG = {
    WaterHeaterPower : 1500,   							// Power consume of the Heater (for calculations).
	ActivationThreshold : 85,   						// Minimum percent of WaterHeaterPower considered to allow Turning ON the heater
	MinimalConsumOfHeaterWhenON: 400,					// Minimum power consumed by heater when ON to be adjust if necessary. Permit to know if the heater is ON or OFF.
	PowerInjectionThresholdOfPVInverter: -50,		    // This is the Max power in W that can be lost to provider even when in PV or Battery charging state mode (Threshold for inverter to switch sources). 
                                                        // Used to avoid consumming batteries without knowing it. This value seems reasonable.
	MinimalHeaterActivationTime : 10 * 60, 				// Secondes. Minimum time duration of one trigger (power ON) of the heater to avoid flapping to often.
	OvertimeOffsetTrigger : 60,  						// Secondes. Offset in seconds to add to MinimalHeaterActivationTime, to ensure that it will overlap to the next activation if any, and avoid switching/flapping 
                                                        // ON-OFF-ON the water heater before next activation period.
	DailyPeriodStartTime : { hours: 11, minutes : 30 }, // Starting time of the daily period for activating heater (if conditions are met). Periods can't cross midnight.
	DailyPeriodEndTime : { hours: 16, minutes : 30 },   // Ending time of the daily period 
	NightlyPeriodStartTime : { hours: 2, minutes : 30 }, // Nightly period start time to turn on heater if needed (in case of insufficient activation during the day).
	NightlyPeriodEndTime : { hours: 5, minutes : 0 },   // Nightly period end time. Periods can't cross midnight.
	MinimalTotalDailyActivation : 2 * 60 * 60,          // Minimal cumulation of daily activation time required in seconds, to avoid nightly activation.
	log_tag: "WHeater" + Shelly.getCurrentScriptId(),	// For logging
	script_id: Shelly.getCurrentScriptId(),				// Keep ScriptID for any purpose.
	log: true, 											// enable/disable informational/debug log messages
	numberOfPowerValuesForMean : 6						// Indicate the number of received previous values kept for calculating power mean (more or less one every 10 sec received)
}

// OTHER GLOBAL VARIABLES:
var Reinit_Cumul_Schedule = {
	KVS_tag: "Reinit_Cumul-Schedule-" + CONFIG.script_id,
	Timespec: "0 " + CONFIG.DailyPeriodStartTime.minutes + " " + CONFIG.DailyPeriodStartTime.hours + " * * *",
	schedule_id: -1
}

var main_permanent_values = {
	_nextDesactivationTime: Math.floor(Date.now() / 1000), // Next desactivation time in seconds since epoch (Kept in KVS to be permanent).
	_lastDailyTotalActivation: 0						   // Last recorded total cumulated time of daily activation (Kept in KVS to be permanent).
}
	 
var _RealHeaterTriggerActivationTime = CONFIG.MinimalHeaterActivationTime + CONFIG.OvertimeOffsetTrigger;
var _switch_timer_handler;      							// To manage timer(s)
var _ActivationThresholdValue = 0 - Math.floor((CONFIG.WaterHeaterPower * CONFIG.ActivationThreshold) / 100);    //Real Negative value use as threshold 
var _last_grid_power_values = [];    // Used for collecting last grid active power values 
var _last_grid_power_values_idx;     // For use in handler

//// LOGGING FUNCTION (by Ben https://af3556.github.io/posts/shelly-scripting-part2
// rate limit console.log messages to the given interval
var _logQueue = {
  queue: [],      // queued messages
  maxSize: 20,    // limit the size of the queue
  interval: 100   // ms
}

// dequeue one message; intended to be called via a Timer
function _logWrite() {
  // Shelly doesn't do array.shift (!), splice instead
  if (_logQueue.queue.length > 0) {
    // include a 'tag' in the log messages for easier filtering
    console.log('['+ CONFIG.log_tag + ']', _logQueue.queue.splice(0, 1)[0]);
  }
}

function _log() {
  if (!CONFIG.log) return;
  if (_logQueue.queue.length < _logQueue.maxSize) {
    _logQueue.queue.push(arguments.join(' '));
  } else {
    console.log('_log: overflow!!'); // you may or may not actually get to see this
  }
}

// Retrieve permanent values for specific variables from KVS:
function get_permanent_value(permanent_variable_name) {
	_log("- Looking for "+ permanent_variable_name + "..."); 

	Shelly.call("KVS.get", { "key": permanent_variable_name }, function (result, error_code, message) {
		if (error_code)
		{
			if (error_code == -105) 
			{ 
				// Variable doesn't exists
				_log("Variable :" + permanent_variable_name + " not found in KVS, adding it with actual value (" + main_permanent_values[permanent_variable_name] +")...")
				Shelly.call("KVS.set", { "key": permanent_variable_name , "value" : main_permanent_values[permanent_variable_name] }, function (result, error_code, message) {
					if (error_code)
					{
						_log("Error: KVS.Set:" + error_code + message);
					} else {
						_log("New KVS variable: " + permanent_variable_name +" correctlly set.");
					}
				}); 
			} else {
				_log("Error: KVS.get:" + error_code + message);
			}
		} else {
			main_permanent_values[permanent_variable_name] = Number(result.value);
			_log("KVS value found for " + permanent_variable_name  + ", loaded value:" + main_permanent_values[permanent_variable_name]);
		}
	});
}

function loadMainKVSvalues(status) {
  // load all permanent values 
  for (var var_name in main_permanent_values)
  {
		get_permanent_value(var_name);
  }
}

//// COLLECTING LAST ACTIVE POWER VALUES of GRID (to make mean and eventually filter them)
// We keep a "window of the last " numberOfPowerValuesForMean values to get GRID power from em1:0

// Called by Init() to initialize Grid array values: 
function initGridArray () { 
	_last_grid_power_values_idx = 0;
	var _init_grid_value=(Shelly.getComponentStatus("EM1",0).act_power || 0);
	for (var i = 0; i < CONFIG.numberOfPowerValuesForMean; i++) {
		_last_grid_power_values.push(_init_grid_value); 
	}
}

// Handler that manage the Array (initialized in Init()):
function _power_statusHander(status_ntf) {
  if(status_ntf.component !== "em1:0") return;
  if(typeof status_ntf.delta.act_power === "undefined") return;
  //console.log(JSON.stringify(status_ntf));
  _last_grid_power_values[_last_grid_power_values_idx]=status_ntf.delta.act_power;
  _last_grid_power_values_idx=((_last_grid_power_values_idx + 1) % CONFIG.numberOfPowerValuesForMean);

}

//Return the mean of the last active power's values :
function _getGridActivePower() {
	var _mean_value = 0;
	for (var i = 0; i < CONFIG.numberOfPowerValuesForMean; i++) {
		_mean_value+=(_last_grid_power_values[i]);
	}
	_mean_value=Math.round(_mean_value / CONFIG.numberOfPowerValuesForMean);
	return _mean_value;
}

//// REINIT "_lastDailyTotalActivation" every day with Schedule:
function registerReinitCumulScheduleIfNotRegistered() {
  _log("Initialize Daily Total Activation Reset scheduler to " + Reinit_Cumul_Schedule.Timespec );
  Shelly.call(
    "KVS.Get",
    {
      key: Reinit_Cumul_Schedule.KVS_tag,
    },
    function (result, error_code, error_message) {
      _log("Reading Reinit_Cumul schedule tag from KVS", JSON.stringify(result, error_code, error_message));
      //we are not registered yet
      if (error_code !== 0) {
        installSchedule();
        return;
      }
      Reinit_Cumul_Schedule.schedule_id = result.value;
      //check if the schedule was deleted and reinstall
      Shelly.call("Schedule.List", {}, function (result) {
        let i = 0;
        for (i = 0; i < result.jobs.length; i++) {
          if (result.jobs[i].id === Reinit_Cumul_Schedule.schedule_id) return;
        }
        installSchedule();
      });
    }
  );
}

function saveScheduleIDInKVS(scheduleId) {
  Shelly.call("KVS.Set", {
    key: Reinit_Cumul_Schedule.KVS_tag,
    value: scheduleId,
  });
}

function installSchedule() {
  Shelly.call(
    "Schedule.Create",
    {
      enable: true,
      timespec: Reinit_Cumul_Schedule.Timespec,
      calls: [
        {
          method: "script.eval",
          params: {
            id: CONFIG.script_id,
            code: "reinit_cumul()",
          },
        },
      ],
    },
    function (result) {
      //save a record that we are registered
      saveScheduleIDInKVS(result.id);
    }
  );
}

// Actual scheduled task: Reset the daily total time cumulation
function reinit_cumul() {
    var _current_time = new Date();
	_log("Reinit of daily activation time cumulation (Now: " + _current_time.toString() + ")...");
	main_permanent_values._lastDailyTotalActivation = 0;
	Shelly.call("KVS.set", {"key": "_lastDailyTotalActivation", "value" : main_permanent_values._lastDailyTotalActivation },function (result, error_code, message) {
		if (error_code)
		{
			_log(" - Error: KVS.Set:" + error_code + message);
		} else {
			_log(" - KVS variable: _lastDailyTotalActivation correctly set to " + main_permanent_values._lastDailyTotalActivation);
		}
	}); 
}

//// MAIN FUNCTIONS FOR WATER HEATER MANAGEMENT

// Return the status of the switch that command heater
function _SwitchClosed () {
  var status = Shelly.getComponentStatus('switch', 0);
  if ( status != null ) {
	_log("Switch status=", JSON.stringify(status));
	return (status.output === true);
  } else {
	_log("Error: getComponentStatus(switch,0)");
	return null;
  }
}

// Trigger a new switch activation to turn ON the water heater for "duration" seconds
function activateSwitch(duration) {
    var _current_time = Math.floor(Date.now() / 1000); // Current time in seconds

    // If any activation current, we just reinit the timer for a new period
    if (_SwitchClosed()) {
        _log("Switch ACTIVATED. Réinit. of timer for more " + duration + "s from now.");
        Timer.clear(_switch_timer_handler); // Clear prévious timer
    } else {
        _log("STARTING switch activation for " + duration +"s...");
        Shelly.call("Switch.Set", { id: 0, on: true });
    }

    // Désactiver le contact après la durée d'activation
    _switch_timer_handler = Timer.set(duration * 1000, false, function() {
        _log("Switch desactivation by timer (end of activation period)...");
        Shelly.call("Switch.Set", { id: 0, on: false });
    });

    // Mise à jour du dernier temps d'activation
    _nextDesactivationTime = _current_time + duration;
    Shelly.call("KVS.set", {"key": "_nextDesactivationTime", "value" : _nextDesactivationTime }); // Save next 
}

// Check if power production is enough to turn on heater (during day period)
// If OK, turn it ON.
function checkPowerProduction() {
    var _current_grid_active_power = _getGridActivePower(); 					     // Mean of last  EM1(0) values (should be the total grid phase power- If negative: Overproduction is going back to provider)
    var _current_heater_active_power = Shelly.getComponentStatus("EM1",1).act_power; // EM1(1) should be the heater only phase (value from 0 to WaterHeaterPower).
    var _required_overproduction=(_ActivationThresholdValue + (_current_heater_active_power));
    var _isHeaterON = (_current_heater_active_power > CONFIG.MinimalConsumOfHeaterWhenON);
    _log("Grid power: " + _current_grid_active_power +" W (Needed: " + _ActivationThresholdValue + " W) - Switch state: " + _SwitchClosed() + " - Heater state: " + _isHeaterON + " - Actual required power: " + _required_overproduction + "W).");

    if (_current_grid_active_power < _required_overproduction) {
		_log("-> Overproduction looks enought for heater requirements ...");
		if (_current_grid_active_power < CONFIG.PowerInjectionThresholdOfPVInverter) {
			_log("--> Will not consume batteries either, turning ON heater switch.");
			activateSwitch(_RealHeaterTriggerActivationTime);
			main_permanent_values._lastDailyTotalActivation += CONFIG.MinimalHeaterActivationTime;
			Shelly.call("KVS.set", {"key": "_lastDailyTotalActivation", "value" : main_permanent_values._lastDailyTotalActivation }); // Update KVS value
			_log("New Daily Total Activation record: "+ main_permanent_values._lastDailyTotalActivation + "s.");
		} else { 
			_log("--> Not sure that it won't consume batteries. NOT turning on heater.");
		}
    } else {
        _log("-> Not enought overproduction for heater requirements. NOT turning ON heater.");
    }
}

// FUNCTIONS TO TEST PERIODS
// params from CONFIG values
function _isTimeInPeriod(startTime,endTime,currentTime) {
	var _startTimeMinutes = startTime.hours * 60 + startTime.minutes;
    var _endTimeMinutes = endTime.hours * 60 + endTime.minutes;
    var _currentTimeMinutes = currentTime.hours * 60 + currentTime.minutes;
    //_log("isInTimePeriod: startTimeMinutes:" + _startTimeMinutes,"_endTimeMinutes:"+_endTimeMinutes,"_currentTimeMinutes:"+_currentTimeMinutes);
	if ((_endTimeMinutes-_startTimeMinutes) < 0) {
	   // Range pass midnight, we split in two the tests: 
	   return (_isTimeInPeriod(startTime,{ hours: 23, minutes : 59 },currentTime) || _isTimeInPeriod({ hours: 00, minutes : 00 },endTime,currentTime));
   } else {
	   //All is same day 
	   return (_currentTimeMinutes >= _startTimeMinutes && _currentTimeMinutes <= _endTimeMinutes );  
   }
}

// Test function for Daily period.
// Converts all in minutes from current day, then compare
function isInDailyPeriod() {
    var _current_date = new Date();
	var _current_time = { hours: _current_date.getHours(), minutes: _current_date.getMinutes() }; 
	isInRange=_isTimeInPeriod(CONFIG.DailyPeriodStartTime,CONFIG.DailyPeriodEndTime,_current_time);
	_log("Checking if we are in DAILY period (Now: " + _current_time.hours + "h" + _current_time.minutes + ",Test range: " + CONFIG.DailyPeriodStartTime.hours + "h" +CONFIG.DailyPeriodStartTime.minutes + " - " + CONFIG.DailyPeriodEndTime.hours + "h" + CONFIG.DailyPeriodEndTime.minutes +"). Is in range?: " + isInRange + ".");
    return isInRange;
}

// Test function for Nightly period
function isInNightlyPeriod() {
    var _current_date = new Date();
	var _current_time = { hours: _current_date.getHours(), minutes: _current_date.getMinutes() }; 
	isInRange=_isTimeInPeriod(CONFIG.NightlyPeriodStartTime,CONFIG.NightlyPeriodEndTime,_current_time);
	_log("Checking if we are in NIGHTLY period (Now: " + _current_time.hours + "h" + _current_time.minutes + ",Test range: " + CONFIG.NightlyPeriodStartTime.hours + "h" +CONFIG.NightlyPeriodStartTime.minutes + " - " + CONFIG.NightlyPeriodEndTime.hours + "h" + CONFIG.NightlyPeriodEndTime.minutes +"). Is in range?: " + isInRange + ".");
    return isInRange;
}

// Check is more activation of the heater is need during nighly period
// If daily activation was longuer than MinimalTotalDailyActivation, not activated
// else activated for a period of the difference between the need and actual daily duration of activation.
function NightSwitchActivation() {
    if (!_SwitchClosed() && main_permanent_values._lastDailyTotalActivation < CONFIG.MinimalTotalDailyActivation) {
        var missingActivationTime = CONFIG.MinimalTotalDailyActivation - main_permanent_values._lastDailyTotalActivation;
        _log("Daily activation time (" + main_permanent_values._lastDailyTotalActivation + "s) was to low. Completing with "+ missingActivationTime +"s of nightly activation.");
        activateSwitch(missingActivationTime);
        main_permanent_values._lastDailyTotalActivation += missingActivationTime;
        Shelly.call("KVS.set", {"key": "_lastDailyTotalActivation", "value" : main_permanent_values._lastDailyTotalActivation }); // Update KVS value
    } else {
        _log("Daily activation time was OK ("+ main_permanent_values._lastDailyTotalActivation +"s). No need to turn heater on again.");
    }
}

// Fonction principale exécutée toutes les `MinimalHeaterActivationTime` secondes
function ActivationManagementProcess() {
    _log("Starting main WATER HEATER management process...");
    if (isInDailyPeriod()) {
        _log("We are in daily period, checking power production...");
        checkPowerProduction();
    } else if (isInNightlyPeriod()) {
        _log("We are in nightly period, checking if we need to turn ont heater again...");
        NightSwitchActivation();
    } else {
        _log("Out of any activation period. Verification if switch is active...");
        if (_SwitchClosed()) {
            _log("-> Switch ACTIVE. Turning it OFF ...");
			Shelly.call("Switch.Set", { id: 0, on: false });
		} else {
		    _log("-> Switch inactive. Nothing to do.");
		}
    }
    _log("End of activation process for now.");
}

////////////     MAIN MANAGEMENT FUNCTIONS

function startManagement() {
	// Plan the main process every 'MinimalHeaterActivationTime` seconds
	_log("Starting activation management process every " + CONFIG.MinimalHeaterActivationTime +"s.");

	var _nextDesactivation=new Date(main_permanent_values._nextDesactivationTime * 1000);	
	var _current_time=Math.floor(Date.now() / 1000);
	if (main_permanent_values._nextDesactivationTime > _current_time ) {
		_log("Restoring last activation ...");
		activateSwitch(main_permanent_values._nextDesactivationTime-_current_time);
	} else {
		_log("No need to restore last activation (Too old:"+main_permanent_values._nextDesactivationTime+"s).");
	}
	
	// Few more logs to know what happens:
	_SwitchClosed();
	_log("INIT: Next desactivation Time: " + _nextDesactivation.toISOString() + " (" + main_permanent_values._nextDesactivationTime + "s) - TotalDailyActivation: "+ main_permanent_values._lastDailyTotalActivation+ "s.");
	
	// Activate Management process one time after 10 seconds, then every MinimalHeaterActivationTime:
	Timer.set(10 * 1000, false, ActivationManagementProcess);
	Timer.set(CONFIG.MinimalHeaterActivationTime * 1000, true, ActivationManagementProcess);
}

// Init function
function init() {
  console.log(CONFIG.log_tag +": Initialization starting...");
  if (CONFIG.log) {
		// set up the log timer; this burns a relatively precious resource but
		// could easily be moved to an existing timer callback
		Timer.set(_logQueue.interval, true, _logWrite);
  }
  
  // Get our main permanent values back when starting:
  loadMainKVSvalues();
  
  // Initialize Grid Power array :
  initGridArray();
  //Add power grid values collection process 
  Shelly.addStatusHandler(_power_statusHander);
  
  // Verify Schedule for Daily total activation time RESET:
  registerReinitCumulScheduleIfNotRegistered();
  
  //Wait for all KVS init then start management: 
  Timer.set(1000, false, startManagement);
}

////////////    MAIN    ///////////////
init();


// Fonction test pour debug :
//Shelly.call("KVS.List",{"match": "*"}, function (result, error_code, message) {
//    print(JSON.stringify(result), error_code, message);
//  })
