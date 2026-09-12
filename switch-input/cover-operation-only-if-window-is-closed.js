/**
 * Cover operation only if addon digital input is on.
 * Motivation is that the digital input is a magnet switch that is 'on' only
 * when the window is closed. Needed for windows that interfere with the cover should they be open.
 * Current logic disables close operations should the addon button signals an open window.
 * Only single push operations are used but your could easily extend it.
 * + Adjust CONFIG to your settings.
 * + Set the buttons to DETACHED state
 * + Install the script and set it to autostart.
 */

let CONFIG = {
  buttonUpId: 1,
  buttonDownId: 0,
  windowSwitchId: 100,
};

/*
 * example events
 event{"component":"input:100","name":"input","id":100,"now":1789197264.11818885803,"info":{"component":"input:100","id":100,"event":"toggle","state":true,"ts":1789197264.11999988555}}
 event{"component":"input:1","name":"input","id":1,"now":1789197265.41068220138,"info":{"component":"input:1","id":1,"event":"single_push","ts":1789197265.41000008583}}
 */
function handleEvent(event) {
  // we react only to button events incl. magnetic switch (100)
  if (event.name === 'input') {
    let coverState = Shelly.getComponentStatus('cover:0');
    let windowState = Shelly.getComponentStatus(
      'input:' + CONFIG.windowSwitchId
    );
    // interrupt cover down operations should the window be opened
    if (
      event.id === CONFIG.windowSwitchId &&
      event.info.state === false &&
      coverState.state === 'closing'
    ) {
      console.log('window opened during cover closing: stopping cover');
      Shelly.call('Cover.stop', { id: 0 });
    }

    // debug output
    // console.log("event:"+JSON.stringify(event))
    // console.log("cover:"+JSON.stringify(coverState))
    // console.log("window:"+JSON.stringify(windowState))

    if (
      event.id === CONFIG.buttonDownId &&
      windowState.state === false &&
      (coverState.state === 'open' ||
        coverState.state === 'opening' ||
        coverState.state === 'stopped')
    ) {
      console.log('button down pressed while window is open: ignoring press');
      return;
    }
    if (event.info.event === 'single_push') {
      // console.log("operating buttons")
      // operation is ok, execute according to cover state
      if (event.id === CONFIG.buttonDownId) {
        if (
          coverState.state === 'open' ||
          coverState.state === 'opening' ||
          coverState.state === 'stopped'
        ) {
          // console.log("cover close")
          Shelly.call('Cover.close', { id: 0 });
        } else if (coverState.state === 'closing') {
          // console.log("cover stop")
          Shelly.call('Cover.stop', { id: 0 });
        }
      }
      if (event.id === CONFIG.buttonUpId) {
        if (
          coverState.state === 'closed' ||
          coverState.state === 'closing' ||
          coverState.state === 'stopped'
        ) {
          // console.log("cover open")
          Shelly.call('Cover.open', { id: 0 });
        } else if (coverState.state === 'opening') {
          // console.log("cover stop 2")
          Shelly.call('Cover.stop', { id: 0 });
        }
      }
    }
  }
}
Shelly.addEventHandler(handleEvent);
console.log('Scripts installed');
