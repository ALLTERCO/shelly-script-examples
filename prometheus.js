/*
 * This script exposes a "/status" endpoint that returns Prometheus metrics that can be scraped.
 * It will be reachable under "<ip>/script/<id>/status". Id will be 1 if this is your first script.
 *
 * Example Prometheus config:
 *
 * scrape_configs:
 *   - job_name: 'shelly'
 *     metrics_path: /script/1/status
 *     static_configs:
 *       - targets: ['<ip>']
 *
 * Replace <ip> with the ip address of the device and adjust the script id if needed.
 *
 * Note: This script assumes you have one switch
 */
var info = Shelly.getDeviceInfo();
function promLabel(label, value) {
  return [label, "=", '"', value, '"'].join("");
}
var defaultLabels = [
  ["name", info.name],
  ["id", info.id],
  ["mac", info.mac],
  ["app", info.app],
  ["switch", "0"],
]
  .map(function (data) {
    return promLabel(data[0], data[1]);
  })
  .join(",");
function printPrometheusMetric(name, value) {
  return ["shelly_", name, "{", defaultLabels, "}", " ", value, "\n"].join("");
}
HTTPServer.registerEndpoint("status", function (request, response) {
  var sys = Shelly.getComponentStatus("sys");
  var sw = Shelly.getComponentStatus("switch:0");
  var res = [
    printPrometheusMetric("uptime_seconds", sys.uptime),
    printPrometheusMetric("ram_size_bytes", sys.ram_size),
    printPrometheusMetric("ram_free_bytes", sys.ram_free),
    printPrometheusMetric("switch_power_watts", sw.apower),
    printPrometheusMetric("switch_voltage_volts", sw.voltage),
    printPrometheusMetric("switch_current_amperes", sw.current),
    printPrometheusMetric("temperature_celsius", sw.temperature.tC),
    printPrometheusMetric("switch_power_watthours_total", sw.aenergy.total),
  ].join("");
  response.body = res;
  response.send();
});
