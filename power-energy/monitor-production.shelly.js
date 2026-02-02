/**
 * @title Add Additional Meter to the Advanced Load Shedding script
 * @description Use this script paired with advanced-load-shedding.shelly.js to add a
 *   second source - example, grid, PV, generator, etc.
 */

// monitor-production script, paired with avanced-load-shedding can set the min/max wattage for a schedule, according to production from a PV array.
//This script is intended for use with advanced-load-shedding.shelly.js to incorporate an additional data source - example combine monitoring of grid with PV invertor or collector

/**************************   settings   ***************************/
let poll_time = 300;                       // number of seconds to periodically calculate running average
let adv_load_shed_ip = "192.168.1.68";     // IP address or empty if both scripts are running locally
let max_factor = 1;                        // factor to apply to produced wattage to make a maximum consumption limit
let min_factor = 0.8;                      // factor to make a minimum threshold to re-add load
let schedule_name = "Daytime Solar";       // schedule where the min/max limits are to apply
let Pro3EM_channels = [ 'a', 'b', 'c' ];   // channels to sum to calculate total production
let simulation_power = 0;                  // change to simulate total power, 0 for normal operation

/***************   program variables, do not change  ***************/
let ts = 0;
let last_cycle_time = 0;
let channel_power = { };
let power_history = { };

function total_power( ) {
    if ( simulation_power ) return simulation_power;
    let power = 0;
    for( k in channel_power )
       power += channel_power[ k ];
    return power;
}

function callback( result, error_code, error_message, user_data ) {
    if ( error_code != 0 ) {
        print( "fail " + user_data );
        // TBD: currently we don't have any retry logic
    }
}

function _simple_encode(str) {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    if (str.at(i) === 0x20) {
      res = res + "%20";
    } else {
      res = res + chr(str.at(i));
    }
  }
  return res;
}

function check_production( msg ) {
    now = Date.now() / 1000;
    if ( def( msg.delta ) ) {
        if ( def( msg.delta.a_act_power ) )
            for ( k in Pro3EM_channels )
                channel_power[ Pro3EM_channels[k] ] = msg.delta[ Pro3EM_channels[k] + '_act_power' ];
    }
    power_history[ now ] = total_power( );

    if ( now > last_cycle_time + poll_time ) {
        last_cycle_time = now;
        cnt = 0;
        total = 0;
        for ( k in power_history )
            if ( k >= now - poll_time ) {
                total += power_history[ k ];
                cnt += 1;
            } else
                delete power_history[ k ]
        if ( cnt > 0 || simulation_power != 0 ) {
            avg = total / cnt;
            if ( simulation_power != 0 ) avg = simulation_power;
            settings = JSON.stringify ( { settings:[ { schedule:schedule_name, 
                                                       kvs:[ { key:"max",value:avg * max_factor }, 
                                                             { key:"min",value:avg * min_factor } ] } ] } )
            if ( adv_load_shed_ip == "" )
                Shelly.call("KVS.set", { key:"load-shed-setting", value: settings } )
            else {
                settings = _simple_encode( '"' + settings + '"' );
                Shelly.call( "HTTP.GET", { url: "http://" + adv_load_shed_ip + "/rpc/KVS.set?key=load-shed-setting&value="+settings }, callback );
            }
        }
    }
}

function def( o ) {
    return typeof o !== "undefined";
}

Shelly.addStatusHandler( check_production );

