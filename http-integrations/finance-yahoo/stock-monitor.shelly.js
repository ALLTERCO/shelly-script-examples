/**
 * @title Yahoo Finance stock monitor with virtual components
 * @description Polls Yahoo Finance chart API for a stock symbol and updates
 *   Virtual Components with current price, daily delta, and quote fields.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/finance-yahoo/stock-monitor.shelly.js
 */

/**
 * Stock Price Monitor
 *
 * Fetches one-day quote data for STOCK_SYMBOL and writes values to Virtual
 * Components.
 *
 * Virtual Components used:
 * - number:200..205  Price, volume, open, close, low, high
 * - text:200..202    Symbol, daily change, last updated
 */

const STOCK_SYMBOL = 'SLYG.DE';

const vcComponents = {
  group: {
		id: 200,
		key: 'stock_monitor',
		name: 'Stock Monitor',
		type: 'group',
	},
	components: [
		{
			id: 200,
			key: 'price',
			type: 'number',
			name: 'Current Price',
			unit: '€',
		},
		{
			id: 201,
			key: 'volume',
			type: 'number',
			name: 'Volume',
			unit: 'shares',
		},
		{
			id: 202,
			key: 'open',
			type: 'number',
			name: 'Open',
			unit: '€',
		},
		{
			id: 203,
			key: 'close',
			type: 'number',
			name: 'Close',
			unit: '€',
		},
		{
			id: 204,
			key: 'low',
			type: 'number',
			name: 'Low',
			unit: '€',
		},
		{
			id: 205,
			key: 'high',
			type: 'number',
			name: 'High',
			unit: '€',
		},
		{
			id: 200,
			key: 'symbol',
			type: 'text',
			name: 'Stock Symbol',
			default: STOCK_SYMBOL,
		},
		{
			id: 201,
			key: 'delta',
			type: 'text',
			name: 'Change today',
		},
		{
			id: 202,
			key: 'time',
			type: 'text',
			name: 'Last Updated',
			webIcon: 13,
		},
	],
};

function getTimestamp(ts) {
  return new Date(ts).toString().split('GMT')[0].trim();
}

function getDate(ts) {
  const date = new Date(ts);
  return (
    String(date.getDate()).padStart(2, "0") + "-" +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

function formatNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
}

function getComponentByKey(key) {
	for (let i = 0; i < vcComponents.components.length; i++) {
		const comp = vcComponents.components[i];
		if (comp.key === key) {
			return comp.type + ':' + comp.id;
		}
	}
	return null;
}

function setValue(key, value) {
  const comp = getComponentByKey(key);
  if (!comp) return;
  Virtual.getHandle(comp).setValue(value);
}

function updateStockPrice() {
	const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + STOCK_SYMBOL + '?interval=1d&range=1d';
	Shelly.call('HTTP.GET',
		{
			url: url,
			headers: { 'User-Agent': 'Mozilla/5.0' },
		},
		function (response) {
			if (!response || response.code !== 200) {
				console.log('Error: HTTP', response);
				return;
			}
			try {
				const data = JSON.parse(response.body);
				const meta = data.chart.result[0].meta;
				const price = meta.regularMarketPrice;
				const prev = meta.chartPreviousClose;
				const ts = meta.regularMarketTime * 1000;
				const delta = price - prev;
				const deltaPct = prev !== 0 ? (delta / prev) * 100 : 0;
				const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
				const trend = delta > 0 ? '⬆️ ' : delta < 0 ? '🔻 ' : '';
				const deltaText =
      			      trend  + sign +
      				  formatNum(Math.abs(delta)) + '€ (' + 
      				  sign + formatNum(Math.abs(deltaPct)) + '%) / ' + getDate(ts);
				const quote = data.chart.result[0].indicators.quote[0];
				setValue('price', formatNum(price));
				setValue('time', getTimestamp(ts));
				setValue('delta', deltaText);
				setValue('open', formatNum(quote.open[0]));
				setValue('close', formatNum(quote.close[0]));
				setValue('high', formatNum(quote.high[0]));
				setValue('low', formatNum(quote.low[0]));
				setValue('volume', quote.volume[0]);
			} catch (err) {
				console.log('Error parsing JSON:', err);
			}
		},
	);
}

// Run immediately
updateStockPrice();

// Run every 5 minutes
Timer.set(5 * 60 * 1000, true, updateStockPrice);
