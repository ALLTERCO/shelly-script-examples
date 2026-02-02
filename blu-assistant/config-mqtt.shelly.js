/**
 * @title BLU Assistant MQTT configuration
 * @description Configures MQTT settings on Shelly BLU devices via BLE scanning and RPC.
 */

/************************************************
* CONFIGURATION
************************************************/
var CONFIG = {
  FILTERED_BLE_ID: '', // default BLE ID
  ALLTERCO_MFD_ID: 'a90b',

  MQTT_SERVER: '',
  MQTT_CLIENT_ID: '',
  MQTT_PREFIX: '',

  URL_CA_BUNDLE: '',
  URL_CLIENT_CERT: '',
  URL_CLIENT_KEY: '',

  SYS_BTN: 'pair',
  VIRTUAL_BTN: 'button:202', // MQTT deploy button

  // --- IDs of your virtual UI components ---
  UI_FILTERED_BLE_ID: 'text:200', // BLE ID
  UI_MQTT_SERVER: 'text:205', // MQTT Server
  UI_MQTT_CLIENT_ID: 'text:206', // MQTT Client ID
  UI_MQTT_PREFIX: 'text:207', // MQTT Prefix
  UI_URL_CA_BUNDLE: 'text:208', // CA Bundle URL
  UI_URL_CLIENT_CERT: 'text:209', // Client Cert URL
  UI_URL_CLIENT_KEY: 'text:210', // Client Key URL
}

var BLE_SCAN = { active: false, duration_ms: 750, window_ms: 95, interval_ms: 100, rssi_thr: -60 }

/************************************************
* OVERRIDE CONFIG WITH UI FIELDS
************************************************/
var uiBleId = Virtual.getHandle(CONFIG.UI_FILTERED_BLE_ID)
var uiServer = Virtual.getHandle(CONFIG.UI_MQTT_SERVER)
var uiClientId = Virtual.getHandle(CONFIG.UI_MQTT_CLIENT_ID)
var uiPrefix = Virtual.getHandle(CONFIG.UI_MQTT_PREFIX)
var uiCaBundle = Virtual.getHandle(CONFIG.UI_URL_CA_BUNDLE)
var uiCert = Virtual.getHandle(CONFIG.UI_URL_CLIENT_CERT)
var uiKey = Virtual.getHandle(CONFIG.UI_URL_CLIENT_KEY)
var uiDeployBtn = Virtual.getHandle(CONFIG.VIRTUAL_BTN)

function refreshConfig() {
  var v
  if (uiBleId) {
    v = uiBleId.getValue()
    // parse hex or decimal input
    CONFIG.FILTERED_BLE_ID = (v.indexOf('0x') === 0 ? parseInt(v, 16) : parseInt(v, 10)) || CONFIG.FILTERED_BLE_ID
  }
  if (uiServer && (v = uiServer.getValue())) CONFIG.MQTT_SERVER = v
  if (uiClientId && (v = uiClientId.getValue())) CONFIG.MQTT_CLIENT_ID = v
  if (uiPrefix && (v = uiPrefix.getValue())) CONFIG.MQTT_PREFIX = v
  if (uiCaBundle && (v = uiCaBundle.getValue())) CONFIG.URL_CA_BUNDLE = v
  if (uiCert && (v = uiCert.getValue())) CONFIG.URL_CLIENT_CERT = v
  if (uiKey && (v = uiKey.getValue())) CONFIG.URL_CLIENT_KEY = v

  console.log(
    'CONFIG ← UI:',
    JSON.stringify({
      FILTERED_BLE_ID: CONFIG.FILTERED_BLE_ID,
      MQTT_SERVER: CONFIG.MQTT_SERVER,
      MQTT_CLIENT_ID: CONFIG.MQTT_CLIENT_ID,
      MQTT_PREFIX: CONFIG.MQTT_PREFIX,
      URL_CA_BUNDLE: CONFIG.URL_CA_BUNDLE,
      URL_CLIENT_CERT: CONFIG.URL_CLIENT_CERT,
      URL_CLIENT_KEY: CONFIG.URL_CLIENT_KEY,
    })
  )
}

/************************************************
* HTTP GET helper – accepts body / body_b64 / body_base64
************************************************/
function fetch(url, cb) {
  console.log('HTTP GET', url)
  Shelly.call('HTTP.GET', { url: url, binary: true }, function (res, ec, em) {
    if (ec || !res || res.code !== 200) {
      console.log('HTTP GET failed', ec, em)
      cb(null)
      return
    }

    var txt = null

    if (typeof res.body === 'string') {
      /* plain text             */
      txt = res.body
      console.log('HTTP GET -> body', txt.length, 'bytes')
    } else if (typeof res.body_b64 === 'string') {
      txt = atob(res.body_b64)
      console.log('HTTP GET -> body_b64', txt.length, 'bytes')
    } else if (typeof res.body_base64 === 'string') {
      txt = atob(res.body_base64)
      console.log('HTTP GET -> body_base64', txt.length, 'bytes')
    } else {
      console.log('HTTP GET unknown payload keys:', JSON.stringify(res))
    }

    cb(txt)
  })
}

/************************************************
* upload PEM with progress
************************************************/
function putPem(addr, method, text, cb) {
  if (!text) {
    console.log(method, 'input NULL – abort')
    cb(false)
    return
  }
  var lines = text.split('\n'), i = 0, bytes = 0
  function next(app) {
    var chunk = lines[i++] + '\n'
    bytes += chunk.length
    if (i % 10 === 0 || i === lines.length) console.log(method, '…', i, '/', lines.length)
    Shelly.call(
      'GATTC.call',
      {
        addr: addr,
        method: method,
        params: { data: chunk, append: app },
      },
      function (r, e, m) {
        if (e) {
          console.log(method, 'error', m)
          cb(false)
        } else if (i < lines.length) next(true)
        else {
          console.log(method, 'DONE', bytes, 'bytes')
          cb(true)
        }
      }
    )
  }
  next(false)
}

/************************************************
* push MQTT config
************************************************/
function mqttConfig(addr, cb) {
  var cfg = {
    enable: true,
    server: CONFIG.MQTT_SERVER,
    client_id: CONFIG.MQTT_CLIENT_ID,
    topic_prefix: CONFIG.MQTT_PREFIX,
    ssl_ca: 'user_ca.pem',
    rpc_ntf: true,
    status_ntf: true,
    enable_control: true,
    enable_rpc: true,
    use_client_cert: true,
  }
  console.log('MQTT.SetConfig sending…')
  Shelly.call(
    'GATTC.call',
    {
      addr: addr,
      method: 'MQTT.SetConfig',
      params: { config: cfg },
    },
    function (r, e, m) {
      if (e) {
        console.log('MQTT.SetConfig ERROR', m)
        cb(false)
      } else {
        console.log('MQTT.SetConfig OK – restart required')
        cb(true)
      }
    }
  )
}

/************************************************
* full deployment chain
************************************************/
function fetchCa(context) {
  fetch(CONFIG.URL_CA_BUNDLE, function (ca) {
    if (!ca) {
      console.log('CA download NULL – abort')
      return
    }
    context.ca = ca
    fetchClientCert(context)
  })
}

function fetchClientCert(context) {
  fetch(CONFIG.URL_CLIENT_CERT, function (cc) {
    if (!cc) {
      console.log('Client-cert download NULL – abort')
      return
    }
    context.cc = cc
    fetchClientKey(context)
  })
}

function fetchClientKey(context) {
  fetch(CONFIG.URL_CLIENT_KEY, function (ck) {
    if (!ck) {
      console.log('Client-key download NULL – abort')
      return
    }
    context.ck = ck
    putUserCa(context)
  })
}

function putUserCa(context) {
  putPem(context.addr, 'Shelly.PutUserCA', context.ca, function (ok1) {
    if (!ok1) {
      console.log('CA upload failed – abort')
      return
    }
    putClientCert(context)
  })
}

function putClientCert(context) {
  putPem(context.addr, 'Shelly.PutTLSClientCert', context.cc, function (ok2) {
    if (!ok2) {
      console.log('Cert upload failed – abort')
      return
    }
    putClientKey(context)
  })
}

function putClientKey(context) {
  putPem(context.addr, 'Shelly.PutTLSClientKey', context.ck, function (ok3) {
    if (!ok3) {
      console.log('Key upload failed – abort')
      return
    }
    mqttConfigProcess(context)
  })
}

function mqttConfigProcess(context) {
  console.log('All certificates uploaded OK')
  mqttConfig(context.addr, function (ok4) {
    if (!ok4) {
      console.log('MQTT config failed – abort')
      return
    }
    reboot(context)
  })
}

function reboot(context) {
  Shelly.call('GATTC.call', { addr: context.addr, method: 'Shelly.Reboot', params: {} }, function (r, e, m) {
    if (e) {
      console.log('Reboot RPC error', m)
      return
    }
    console.log('Rebooting … wait 10 s')
    Timer.set(10000, false, function () {
      Shelly.call('GATTC.call', { addr: context.addr, method: 'MQTT.GetStatus', params: {} }, function (res, ec, em) {
        if (ec) console.log('MQTT.GetStatus error', em)
        else console.log('MQTT connected?', res && res.connected)
      })
    })
  })
}

function deploy(addr) {
  console.log('=== provisioning', addr, '===')
  var context = { addr: addr }
  fetchCa(context)
}

/************************************************
* BLE scan selecting strongest RSSI
************************************************/
function idFromAdv(a) {
  return parseInt(a.substr(22, 2), 16) + (parseInt(a.substr(24, 2), 16) << 8)
}

function sortRSSI(devices) {
  for (var i = 0; i < devices.length; i++) {
    for (var j = i + 1; j < devices.length; j++) {
      if (devices[i].rssi < devices[j].rssi) {
        var temp = devices[i]
        devices[i] = devices[j]
        devices[j] = temp
      }
    }
  }
}

function scanCb(res) {
  if (!res || !Array.isArray(res.results)) {
    console.log('BLE scan invalid')
    return
  }
  var matchedDevices = res.results.filter(function (dev) {
    return (
      typeof dev.adv_data === 'string' &&
      dev.adv_data.indexOf(CONFIG.ALLTERCO_MFD_ID) === 10 &&
      idFromAdv(dev.adv_data) === CONFIG.FILTERED_BLE_ID
    )
  })
  if (!matchedDevices.length) {
    console.log('No matching devices')
    return
  }
  sortRSSI(matchedDevices)
  var target = matchedDevices[0]
  console.log('Target', target.addr, 'RSSI', target.rssi)
  deploy(target.addr)
}

function scan() {
  console.log('BLE scan…')
  Shelly.call('GATTC.Scan', BLE_SCAN, scanCb)
}

/************************************************
* triggers
************************************************/
Shelly.addEventHandler(function (ev) {
  if (ev.info && ev.info.component === 'sys' && ev.info.event === 'brief_btn_down' && ev.info.name === CONFIG.SYS_BTN) {
    console.log('System button -> scan')
    scan()
  }
})

function init() {
  // apply overrides at startup
  refreshConfig()

  // re-apply on any text-field change
  var uiHandles = [uiBleId, uiServer, uiClientId, uiPrefix, uiCaBundle, uiCert, uiKey]
  uiHandles.forEach(function (h) {
    if (h && h.on) h.on('change', refreshConfig)
  })

  // hook the virtual “MQTT” button
  if (uiDeployBtn) {
    uiDeployBtn.on('single_push', function () {
      console.log('Virtual deploy button pressed → scan')
      scan()
    })
  }

  console.log('Ready – press the physical or virtual button to provision MQTT')
}

init()