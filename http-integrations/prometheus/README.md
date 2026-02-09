# Prometheus Integration

This script exposes a `/metrics` endpoint on your Shelly device, allowing a Prometheus server to scrape real-time device metrics.

## Scripts

- [`prometheus.shelly.js`](prometheus.shelly.js) - Exposes a `/metrics` endpoint for Prometheus scraping.
- [`prometheus-grafana-example-dashboard.json`](prometheus-grafana-example-dashboard.json) - An example Grafana dashboard to visualize the metrics collected by the script.

## Usage

1.  Install the `prometheus.shelly.js` script on your Shelly device.
2.  Configure your Prometheus server to scrape the `/script/1/metrics` endpoint on your Shelly device's IP address (adjust the script ID if necessary).
3.  Import the `prometheus-grafana-example-dashboard.json` into your Grafana instance to get a pre-built dashboard for visualizing the metrics.
