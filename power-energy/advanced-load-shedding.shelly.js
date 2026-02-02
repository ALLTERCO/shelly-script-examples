/**
 * @title Advanced Load shedding with schedules and notifications
 * @description Adds schedule, device, and notification templates and functionality to
 *   the original load shedding script.
 */

// load-shedding script will keep measured usage between a low (min) and high
// (max) total power (watts), by controlling power to other devices

// Key considerations:

// 1. Make sure the value set for max is greater than the value set for min (10% should be considered the lowest spread, 20% is a better minimum spread)
// 2. The greater the distance between min and max, the less "churn" you'll have. Setting ample space between these values will make your load shedding more efficient.
// 3. The lowest value for poll_time should be 60 - during "turn on" cycles, you should allow enough time for inrush spikes to settle.
// 4. Priority is in order of most important (keep on if possible) to least important.
// 5. Any device that isn't listed at all, or is left out from all schedules will be unmanaged--never subject to load shedding.
// 6. Best practice is to name all of the included devices in each schedule, in one of the sets "priority," "on," or "off".

// poll_time: minimum time span between applying normal on/off steps
// short_poll: when adding devices, highest priority devices are turned on, even if they are presumed to already be on, this shorter time speeds the process

// JSON schema for input settings:
// devices = [ { "name":,"descr":,"addr":,"gen":,"type":,"id":,"notify":}, # shelly device. descr and notify are optional, notify defaults to false
//             { "name":,"descr":,"on_url":,"off_url":,"notify":},         # webhook example.
//             ...
//           ]
// notify = [ { "name":, "descr":, "url": },                               # each named notifiction can be used in a schedule
//            ...                                                          # occurences of {device}, {state}, and {wattage} will be replaced inline
//          ]
// schedules = [
//               { "name":,"enable":,"start":,"days":,                     # enable is optional, defaults to true, days optional, defaults to SMTWTFS
//                 "descr":,  
//                 "priority":[],                                          # prioritized device list. first is kept on most, last in list is first to shed
//                 "on":[],                                                # devices to keep on. may contain the single entry "ALL", or a list of devices
//                 "off":[],                                               # devices to keep off. a schedule must have at least one of priority, on, off       
//                 "min":,"max":,"poll_time":,"short_poll":,               # if priority is specified, all of these options are required
//                 "notify_on":,"notify_off"                               # notifications are optional
//               },
//               ...
//             ]

/************************   settings  ************************/

Pro4PM_channels = [ 0, 1, 2, 3 ];      // default to sum of all channels for 4PM 
Pro3EM_channels = [ 'a', 'b', 'c' ];   // similar if device is 3EM

max_ = 1200;                 // global max, used only if never defined in schedules
min_ = 900;                  //                    "                       "
poll_time = 300;             // unless overriden in a schedule, defines time between shedding or adding load
short_poll = 10;             // faster cycle time when verifying that an "on" device is still on
logging = false;
kvs_status = false;          // store status in key-value-store
simulation_power = 0;        // set this to manually test in console
simulation_hhmm = "";        // leave "" for normal operation, set to time like "03:00" to test
simulation_day = -1;         // -1 for normal operation, to test, 0=Sunday, 1=Monday...

devices = [ { "name":"Water heater", "descr": "Shelly Pro 3EM", "addr":"192.168.1.105","gen":2, "type":"Switch", "id":100, "notify" : true },
            { "name":"EV charger", "descr": "Shelly Pro 3EM", "addr":"192.168.1.106","gen":2, "type":"Switch", "id":100, "notify" : true },
            { "name":"Pool Pump", "descr": "Shelly Pro 3EM", "addr":"192.168.1.107","gen":2, "type":"Switch", "id":100, "notify" : false },
            { "name":"Oven", "descr": "Shelly Pro 3EM", "addr":"192.168.1.108","gen":2, "type":"Switch", "id":100, "notify" : true },
            { "name":"Air Conditioner", "descr": "Shelly Pro 3EM", "addr":"192.168.1.109","gen":2, "type":"Switch", "id":100, "notify" : false },
            { "name":"Ceiling fan",  "descr": "Shelly 1PM", "addr":"192.168.1.110","gen":1, "type":"relay", "id":0, "notify" : false },
            { "name":"Hot Tub", "descr": "NodeRed endpoint to control non-shelly devices", 
                     "on_url":"http://192.168.2.1:1880/endpoint/hot_tub?state=ON",
                     "off_url":"http://192.168.2.1:1880/endpoint/hot_tub?state=ON",
                     "notify" : false },
            { "name":"Entertainment Center",  "descr": "Shelly Plus 2PM relay single channel",
                     "addr":"192.168.1.114","gen":2,"type":"relay","id":0, "notify" : true },
            { "name":"HVAC",  "descr": "Shelly Plus 1PM with contactor",
                     "addr":"192.168.1.111","gen":2,"type":"relay","id":0, "notify" : true },
            { "name":"Dishwasher",  "descr": "Shelly Plus 2PM relay first channel",
                     "addr":"192.168.1.112","gen":2,"type":"relay","id":0, "notify" : true },
            { "name":"Microwave", "descr": "Shelly Plus 2PM relay second channel",
                     "addr":"192.168.1.112","gen":2,"type":"relay","id":1, "notify" : true },
          ]

notify = [ { "name": "notify off", "descr": "IFTTT webhook to fire when a device is disabled",
              "url":"https://maker.ifttt.com/trigger/send_email/with/key/crLBieQXeiUi1SwQUmYMLn&value1=knobs" },
            { "name": "notify on",
              "url":"https://maker.ifttt.com/trigger/send_email/with/key/crLBieQXeiUi1SwQUmYMLn&value1=sally" },
         ]

schedules = [ { "name":"Daytime Solar", "enable": true, "start":"07:00", "days":"SMTWTFS",
                "descr":"Weekdays, starting 7AM, when solar production ramps up",
                "priority":["HVAC","Oven","Microwave","Entertainment Center","Water heater","EV charger","Dishwasher","Ceiling fan","Pool Pump"],
                "min":2500, "max":3500, "poll_time":300, short_poll:10 },
             { "name":"Evening Time of Use-Peak Demand", "enable": true, "start":"17:00", "days":".MTWTF.",
                "descr":"Weekdays, starting 5PM, returning to grid, time of use/peak demand rates apply with penalty",
                "priority":["HVAC","Ceiling fan","Entertainment Center","Microwave","Dishwasher"],
                "off" : ["Pool Pump"],
                "min":2000, "max":3000, "poll_time":300, short_poll:10,
                "notify_on" : "notify on", "notify_off" : "notify off" },
             { "name":"Weekend Nights Grid", "enable": true, "start":"17:00", "days":"S.....S",
                "descr":"Saturday/Sunday after solar, no Time of Use rates",
                "on" : ["ALL"] },
             { "name":"All Nights Grid", "enable": true, "start":"20:00", "days":"SMTWTFS",
                "descr":"Every day, starting 8PM, returning to grid, time of use/peak demand rates have ended",
                "on" : ["ALL"] },
           ]

/***************   program variables, do not change  ***************/

ts = 0;
idx_next_to_toggle = -1;
last_cycle_time = 0;
channel_power = { };
verifying = false;
days = "SMTWTFS";
last_schedule = -1;
schedule = -1;
device_map = {};
schedule_map = {};
notify_map = {};
priority = [];
queue = []
in_flight = 0;
kvs = { device_states : { }, power : 0, schedule : "none", direction : "coasting" };
last_kv = "";
notify_on = "";
notify_off = "";

function total_power( ) {
    if ( simulation_power ) return simulation_power;
    let power = 0;
    for( let k in channel_power )
       power += channel_power[ k ];
    return power;
}

function callback( result, error_code, error_message, user_data ) {
    in_flight--;
    if ( error_code != 0 ) {
        print( "fail " + user_data );
        // TBD: currently we don't have any retry logic
    } else {
        if ( logging ) print( "success" );
    }
}

function turn( pdevice, dir, notify, wattage ) {
    let device = devices[ device_map[ pdevice ] ];
    let cmd = "";
    if ( dir == "on" && device.presumed_state == "on" )
        verifying = true;
    else
        verifying = false;
    if ( dir != device.presumed_state )
        kvs.device_states[ device.name ] = dir;

    device.presumed_state = dir;
    let on = dir == "on" ? "true" : "false";
    print( "Turn " + device.name + " " + dir );

    if ( simulation_hhmm || simulation_power || simulation_day > -1 ) return;
    if ( def( device.notify ) && device.notify ) {
        if ( dir == "on" && notify_on != "" )
            cmd = notify[ notify_map[ notify_on ] ];
        if ( dir == "off" && notify_off != "" )
            cmd = notify[ notify_map[ notify_off ] ];
        if ( cmd != "" ) {
            cmd = cmd.replace( "{device}", device.name );
            cmd = cmd.replace( "{state}", dir );
            cmd = cmd.replace( "{wattage}", wattage );
            Shelly.call( "HTTP.GET", { url: cmd }, callback, device.name );
            in_flight++;
        }
    }

    if ( def( device.gen ) ) {
        if ( device.gen == 1 )
            cmd = device.type+"/"+device.id.toString()+"?turn="+dir
        else
            cmd = "rpc/"+device.type+".Set?id="+device.id.toString()+"&on="+on
        Shelly.call( "HTTP.GET", { url: "http://"+device.addr+"/"+cmd }, callback, device.name );
        in_flight++;
    }
    if ( def( device.on_url ) && dir == "on" ) {
        Shelly.call( "HTTP.GET", { url: device.on_url }, callback, device.name );
        in_flight++;
    }
    if ( def( device.off_url ) && dir == "off" ) {
        Shelly.call( "HTTP.GET", { url: device.off_url }, callback, device.name );
        in_flight++;
    }
}

function qturn( device, dir, notify, wattage ) {
    if (!def(device)) {
        print("undef in qturn");
        return;
    }
    queue.push( { "device": device, "dir": dir, "notify": notify, "wattage": wattage } )
}

function pad0( s, n ) {
    s = s.toString();
    if ( s.length < n )
        return '0' + s;
    return s;
}

function find_active_schedule( ) {
    let sched = -1;
    let sched_time = '00:00';
    let last_sched = 0;
    let last_time = '00:00';
    let now = new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let start_time = schedules[ 0 ].start;
    let day = now.getDay();
    let hhmm = pad0(hour,2) + ':' + pad0(minute,2);
    if ( simulation_day > -1 )
        day = simulation_day;
    if ( simulation_hhmm != "" )
        hhmm = simulation_hhmm;
    for ( n in schedules ) {
        let s = schedules[ n ];
        if ( def( s.enable ) && ! s.enable ) continue;
        if ( s.start > last_time ) {
            last_time = s.start;
            last_sched = n;
        }
        if ( ! def( s.days ) || s.days[ day ] == days[ day ] ) {
            if ( hhmm >= s.start && s.start >= sched_time && s.start > sched_time ) {
                sched_time = s.start;
                sched = n;
            }
        }
    }
    if ( sched == -1 ) sched = last_sched;
    return sched;
}

function toggle_all( dir, notify, wattage ) {
    for ( let d in devices ) {
        qturn( devices[ d ].name, dir, notify, wattage );
    }
}

function check_queue( ) {
    if ( queue.length > 0 && in_flight < 2 ) {
        let t = queue[0];
        queue = queue.slice(1);
        turn( t.device, t.dir, t.notify, t.wattage );
    }
}

function process_kv( result, error_code, error_message ) {
    if ( last_kv != result.value ) {
        last_kv = result.value;
        let j = JSON.parse( result.value );
        if ( def( j.settings ) ) {
            for ( s in j.settings ) {
                 let setting = j.settings[ s ];
                 if ( def( setting.schedule ) &&
                      def( setting.kvs ) &&
                      setting.schedule in schedule_map  )
                     for ( k in setting.kvs ) {
                         kv = setting.kvs[ k ];
                         if ( def( kv.key ) &&
                              def( kv.value )
                         ) schedules[ schedule_map[ setting.schedule ] ][ kv.key ] = kv.value;
                     }
            }
        }
    }
}

function check_power( msg ) {
    if (!def(msg)) return;
    check_queue();
    let now = Date.now() / 1000;
    let poll_now = false;
    if ( def( msg.delta ) ) {
        if ( def( msg.delta.apower ) && msg.id in Pro4PM_channels )
            channel_power[ msg.id ] = msg.delta.apower;
        if ( def( msg.delta.a_act_power ) )
            for ( let k in Pro3EM_channels )
                channel_power[ Pro3EM_channels[k] ] = msg.delta[ Pro3EM_channels[k] + '_act_power' ];
    }
    kvs.power = total_power( );

    let schedule = find_active_schedule( ); 
    if ( schedule != last_schedule ) {
        kvs.schedule = schedules[ schedule ].name;
        print( "activated " + kvs.schedule );
        let s = schedules[ schedule ]
        if ( def( s.priority ) )
            priority = s.priority;
        else
            priority = [];
        kvs.direction = "loading";
        idx_next_to_toggle = 0;
        if ( def( s.min ) ) min_ = s.min;
        if ( def( s.max ) ) max_ = s.max;
        if ( def( s.poll_time ) ) poll_time = s.poll_time;
        if ( def( s.short_poll ) ) short_poll = s.short_poll;
        if ( def( s.notify_on ) ) notify_on = s.notify_on;
        if ( def( s.notify_off ) ) notify_off = s.notify_off;
        if ( def( s.off ) ) for  (let  d in s.off ) if ( s.off[d] == "ALL" ) toggle_all( "off", notify, kvs.power ) else qturn( s.off[d], "off", notify, kvs.power );
        if ( def( s.on ) ) for ( let d in s.on ) if ( s.on[d] == "ALL" ) toggle_all( "on", notify, kvs.power ) else qturn( s.on[d], "on", notify, kvs.power );
    } 

    if ( now > last_cycle_time + poll_time || verifying && now > last_cycle_time + short_poll ) {
        last_cycle_time = now;
        poll_now = true;
    }
    if ( priority.length ) {
        if ( kvs.power > max_ ) {
            if ( kvs.direction !== "shedding" ) {
                kvs.direction = "shedding";
                idx_next_to_toggle = priority.length -1;
            }
        } else if ( kvs.power < min_ ) {
            if ( kvs.direction !== "loading" ) {
                kvs.direction = "loading";
                idx_next_to_toggle = 0;
            }
        } else if ( kvs.direction !== "coasting" ) {
            kvs.direction = "coasting";
        }

        if ( def( msg.delta ) || schedule != last_schedule ) {
            if ( poll_now ) {
                if ( kvs.direction === "loading" ) {
                    qturn( priority[ idx_next_to_toggle ], "on", notify, kvs.power );
                    if ( idx_next_to_toggle < priority.length -1 ) idx_next_to_toggle += 1;
                }
                if ( kvs.direction === "shedding" ) {
                    qturn( priority[ idx_next_to_toggle ], "off", notify, kvs.power );
                    if ( idx_next_to_toggle > 0 ) idx_next_to_toggle -= 1;
                }
            }
        }
    } else if ( poll_now )
        Shelly.call( "KVS.get", {key:"load-shed-setting"}, process_kv )

    last_schedule = schedule;
    check_queue();
    if ( poll_now && kvs_status )
        Shelly.call( "KVS.set", { key : "load-shed-status", value : JSON.stringify( kvs ) } )
}

function def( o ) {
    return typeof o !== "undefined";
}

function check_devices( l, t, s ) {
    for ( let d in l )
        if ( ! ( l[d] in device_map ) && l[d] != "ALL" )
            print( "Undefined device " + l[d] + " in list '" + t + "' of schedule " + s.name );
}

function init( ) {
    for ( let d in devices ) {
        device_map[ devices[d].name ] = d;
        d.presumed_state = "unknown";
    }
    for ( let sched in schedules ) {
        schedule_map[ schedules[ sched ].name ] = sched;
        let s = schedules[sched];
        s.start = pad0( s.start, 5);
        if ( def(s.off) ) check_devices(s.off, "off", s );
        if ( def(s.on) ) check_devices(s.on, "on", s );
        if ( def(s.priority) ) check_devices(s.priority, "priority", s );
    }
    for ( let n in notify )
        notify_map[ notify[ n ].name ] = n;
}

init();

Shelly.addStatusHandler( check_power );
