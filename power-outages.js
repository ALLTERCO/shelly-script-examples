/******************* poweroutages.js ***************************
This script can monitor devices or web sites by loading an http 
request, and if they become unreachable, take a series of actions.
Each action can be an MQTT message or an http web request.
*************************   settings  ************************/

tasks = [ { "name": "turn-off-router", "url":"http://192.168.1.188/rpc/switch.Off?id=0" },
          { "name": "turn-on-router-after-delay", "delay": 10, "url":"http://192.168.1.189/rpc/switch.On?id=0" },
          { "name": "resume-polling-after-delay", "resume_poll": 30},
          { "name": "mq-c", "topic":"updown", "message":"{device} is {state}"} ];

devices = [ { "name": "test-web-connection",
               "actions": [ {"task": "turn-off-router", "dir": "down"},
                            {"task": "turn-on-router-after-delay", "dir": "down"},  
                            {"task": "resume-polling-after-delay", "dir": "down"},  
                            {"task": "mq-c", "dir": "down"} ], 
               "url": "http://192.168.1.40/rpc/sys.getStatus",
               "poll_time": 10  },
            { "name": "plug-b",
              "enable": false,
              "actions": [ {"task": "web-b", "dir": "both"} ], 
               "url": "http://192.168.1.181/rpc/sys.getStatus",
               "poll_time": 10  } ];

cycle_time = 5;    // the script runs periodically to check if it is time to poll or send queued notifications
// cycle time defines the minimum poll_time for any device, and affects latency of message delivery
verbose = 1;       // level 0=quiet, 1=state changes and actions, 2=polling, 3=copious

/***************   program variables, do not change  ***************/
in_flight = 0;
task_map = {};
timer_handle = "";
next_device = 0;

function def( o ) {
    return typeof o !== "undefined";
}

function poll_response( result, error_code, error_message, dev ) {
    if ( verbose > 2 ) print( "poll response" );
    in_flight--;
    let new_state = "up"
    if ( error_code != 0 ) new_state = 'down';
    devices[ dev ].action = 'complete';
    if ( new_state != devices[ dev ].state ) {
        devices[ dev ].state = new_state;
        devices[ dev ].action = 'changed';
        if ( verbose > 0 ) print( devices[ dev ].name + " is now " + new_state + " [" + in_flight + "]" );
    }
}

function action_response( result, error_code, error_message, task ) {
    if ( verbose > 2 ) print( "action response" );
    in_flight--;
    if ( error_code != 0 )
        print( "failed to send notification: " + task + " [" + in_flight + "]" )
}

function apply_templates( s, d ){
    s = s.replace( '{device}', d.name );
    s = s.replace( '{state}', d.state );
    return s;
}

function action( d ) {
    if ( verbose > 2 ) print( "action" );
    while( in_flight < 3 && d.actions_processed < d.actions.length ) {
        let action = d.actions[ d.actions_processed ];

        if ( action.dir == 'both' || action.dir == d.state ) {
            if ( def( task_map[ action.task ].resume_poll ) ) task_map[ action.task ].delay = task_map[ action.task ].resume_poll;
            if ( def( task_map[ action.task ].delay ) ) {
                if ( ! def( task_map[ action.task ].end_of_delay ) ) {
                   task_map[ action.task ].end_of_delay = Date.now() / 1000 + task_map[ action.task ].delay;
                   return;
                } else {
                   if ( Date.now() / 1000 < task_map[ action.task ].end_of_delay ) return;
                }
                task_map[ action.task ].end_of_delay = undefined;
            }
            if ( def( task_map[ action.task ].resume_poll ) ) {
                if ( d.state == 'down' ) {
                    if ( verbose > 0 ) print( "resume-poll (still down)" )
                    d.cycle_count += 1;
                    d.state = 'poll-again';
                } else {
                    if ( verbose > 0 ) print( "resume-poll (up)" )
                }
            } else if ( def( task_map[ action.task ].url ) ) {
                in_flight++;
                let url = apply_templates( task_map[ action.task ].url, d );
                if ( verbose > 0 ) print( "webhook " + action.task );
                Shelly.call( "HTTP.GET", { url: url }, action_response,  action.task  );
            } else if ( def( task_map[ action.task ].topic ) && MQTT.isConnected() ) {
                let topic = apply_templates( task_map[ action.task ].topic, d );
                let message = apply_templates( task_map[ action.task ].message, d );
                if ( verbose > 0 ) print( "MQTT " + action.task );
                MQTT.publish( topic, message );
            }
        }
        d.actions_processed ++;
   }
   if ( d.actions_processed == d.actions.length ) d.action = 'notified';
}

function check_states( ) {
    let now = Date.now() / 1000;
    let last_device = next_device;

    while( in_flight < 3 ) {
        let d = devices[ next_device ];
        if ( d.enable ) {
            if ( verbose > 2 ) print( "check " + d.name + " (" + d.action + ") [" + in_flight + "]" );
            if ( ( d.state == 'unknown' || d.state == 'poll-again' || d.last_poll < now - d.poll_time ) && d.action != 'in-flight' && d.action != 'changed' ) {
                d.action = 'in-flight';
                in_flight++;
                d.actions_processed = 0;
                if ( d.state != 'poll-again' ) d.cycle_count = 1;
                d.last_poll = now;
                if ( verbose > 1 ) print( "polling " + d.name + " [" + in_flight + "]" );
                Shelly.call( "HTTP.GET", { url: d.url }, poll_response, next_device );
            } else if ( d.action == 'changed' && ( d.state == 'up' || d.state == 'down' ) ) {
                action( d );
            }
        } else
            if ( verbose > 2 ) print( d.name + " is disabled [" + in_flight + "]" );
        next_device ++;
        if ( next_device >= devices.length ) next_device = 0;
        if ( next_device == last_device ) break;
    }
}

function init( ) {
    if ( verbose > 2 ) print( "init" );
    for ( let d in devices ) {
        devices[ d ].state = 'unknown';
        devices[ d ].action = '';
        devices[ d ].last_poll = 0;
        devices[ d ].actions_processed = 0;
        if ( ! def( devices[ d ].enable ) ) devices[ d ].enable = true
    }
    for ( let n in tasks ) {
        task_map[ tasks[ n ].name ] = tasks[ n ];
    }
    timer_handle = Timer.set( 1000 * cycle_time, true, check_states );
}

init();
