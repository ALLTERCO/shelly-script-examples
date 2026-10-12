// Deterministic RPC/Modbus integration tests. Run: node --test bridge.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'midea-clivet-r32-pro-modbus-vc.shelly.js'), 'utf8');

function emulator(config = {}, initial = {}) {
  const registers = { 0: 0x8, 1: 3, 2: (42 << 8) | 35, 3: 42, 4: 50, 5: 0x180,
    100: 45, 101: 3, 104: 30, 105: 35, 115: 48, 124: 0, 128: 0, 131: 47,
    201: (25 << 8) | 25, 202: (5 << 8) | 5, 203: (65 << 8) | 65,
    204: (22 << 8) | 22, 207: 60, 208: 20, ...initial };
  const components = new Map();
  const timers = [];
  const logs = [];
  const trace = [];
  let now = 0;
  let timerId = 0;
  let offline = false;
  let beforeRpc = null;
  let rejectWrites = false;
  let failWrite = false;
  let failReadback = false;
  let pendingReadback = false;
  let serial = { mode: 'mb_client', serial: { baud: 9600, format: '8N1' } };
  const clone = x => JSON.parse(JSON.stringify(x));
  function call(method, params, callback) {
    trace.push({ time: now, method, params: clone(params) });
    if (beforeRpc) beforeRpc(method, params, api);
    if (method === 'Shelly.GetComponents') {
      const items = [...components.entries()].map(([key, x]) => ({ key, config: x.config, status: { value: x.value } }));
      callback({ total: items.length, components: items.slice(params.offset, params.offset + 4) }, 0, ''); return;
    }
    if (method === 'Virtual.Add') {
      const key = params.type + ':' + params.id;
      if (components.size >= 10 || components.has(key)) { callback(null, -1, 'Capacity/conflict'); return; }
      components.set(key, { config: clone(params.config), value: params.config.default_value });
      callback({ id: params.id }, 0, ''); return;
    }
    if (method.endsWith('.SetConfig')) {
      if (method === 'Serial.SetConfig') { serial = clone(params.config); callback({ restart_required: false }, 0, ''); return; }
      const key = method.split('.')[0].toLowerCase() + ':' + params.id;
      if (!components.has(key)) { callback(null, -1, 'Missing component'); return; }
      Object.assign(components.get(key).config, clone(params.config));
      callback({ restart_required: false }, 0, ''); return;
    }
    if (method === 'Serial.GetConfig') { callback(clone(serial), 0, ''); return; }
    if (method === 'MbRtuClient.ReadHoldingRegisters') {
      if (offline || (pendingReadback && failReadback)) {
        pendingReadback = false; callback(null, -1, 'Timeout'); return;
      }
      pendingReadback = false;
      const values = [];
      for (let i = 0; i < params.qty; i++) {
        const value = registers[params.addr + i];
        if (value === undefined) { callback(null, 2, 'Illegal address'); return; }
        values.push(value);
      }
      callback({ values }, 0, ''); return;
    }
    if (method === 'MbRtuClient.WriteSingleRegister' || method === 'MbRtuClient.WriteHoldingRegisters') {
      if (offline || failWrite) { callback(null, -1, 'Write timeout'); return; }
      const value = params.value === undefined ? params.values[0] : params.value;
      assert.ok(Number.isInteger(value) && value >= 0 && value <= 65535);
      if (!rejectWrites) registers[params.addr] = value;
      pendingReadback = true; callback({}, 0, ''); return;
    }
    if (method.endsWith('.Set')) {
      const key = method.split('.')[0].toLowerCase() + ':' + params.id;
      const item = components.get(key);
      if (!item) { callback(null, -1, 'Missing component'); return; }
      const kind = key.split(':')[0];
      if (kind === 'number') assert.ok(typeof params.value === 'number' && params.value >= item.config.min && params.value <= item.config.max);
      if (kind === 'boolean') assert.equal(typeof params.value, 'boolean');
      if (kind === 'text') assert.ok(params.value.length <= item.config.max_len);
      item.value = params.value; callback(null, 0, ''); return;
    }
    throw new Error('Unexpected RPC: ' + method);
  }
  const context = vm.createContext({
    print: x => logs.push(x),
    Shelly: { call,
      getComponentConfig: (type, id) => components.get(type + ':' + id)?.config,
      getComponentStatus: (type, id) => {
        const c = components.get(type + ':' + id); return c ? { value: c.value } : undefined;
      } },
    Timer: { set: (delay, repeat, callback) => {
      assert.equal(repeat, false);
      timers.push({ id: ++timerId, at: now + delay, callback });
      assert.ok(timers.length <= 3, 'Unbounded timer accumulation'); return timerId;
    } }
  });
  vm.runInContext(source, context);
  Object.assign(context.CONFIG, config);
  const api = {
    context, registers, components, logs, trace,
    writes: () => trace.filter(x => /MbRtuClient.Write/.test(x.method)),
    value: (type, id) => components.get(type + ':' + id)?.value,
    change: (type, id, value) => { components.get(type + ':' + id).value = value; },
    offline: value => { offline = value; },
    rejectWrites: value => { rejectWrites = value; },
    failWrite: value => { failWrite = value; },
    failReadback: value => { failReadback = value; },
    hook: fn => { beforeRpc = fn; },
    until(predicate, max = 5000) {
      for (let n = 0; !predicate(); n++) {
        assert.ok(n < max && timers.length, 'Predicate not reached: ' + logs.slice(-3));
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const t = timers.shift(); now = t.at; t.callback();
      }
    },
    advance(ms) {
      const end = now + ms;
      for (let n = 0; timers.length; n++) {
        assert.ok(n < 10000);
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        if (timers[0].at > end) break;
        const t = timers.shift(); now = t.at; t.callback();
      }
      now = end;
    },
    sync() { this.until(() => context.ready); }
  };
  return api;
}
const control = { enableWrites: true, expectedControllerVersion: 47, hasDhwTank: true };

test('exactly nine components; initial synchronization sends no Modbus writes', () => {
  const e = emulator(control); e.sync();
  assert.equal(e.components.size, 9);
  assert.equal(e.writes().length, 0);
  assert.equal(e.value('number', 223), 35);
  assert.equal(e.value('number', 227), 48);
  assert.match(e.value('text', 228), /ONLINE.*CONTROL/);
});
test('read-only default restores a changed UI value without writing', () => {
  const e = emulator(); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.equal(e.value('number', 223), 35);
  assert.match(e.value('text', 228), /READ ONLY/);
});
test('startup never replays persisted control values', () => {
  const e = emulator(control);
  e.hook((m, p) => { if (m === 'Serial.GetConfig' && !e.context.ready) e.change('number', 223, 55); });
  e.sync(); assert.equal(e.writes().length, 0); assert.equal(e.value('number', 223), 35);
});
test('zone-1 write preserves zone-2 and other flags in register 0', () => {
  const e = emulator(control); e.sync(); e.change('boolean', 220, true); e.advance(15000);
  assert.equal(e.registers[0], 0xa); assert.equal(e.writes().length, 1);
});
test('two controls sharing register 0 preserve each other', () => {
  const e = emulator(control); e.sync();
  e.change('boolean', 220, true); e.change('boolean', 221, true); e.advance(20000);
  assert.equal(e.registers[0], 0xe); assert.equal(e.writes().length, 2);
});
test('water target preserves the zone-2 high byte', () => {
  const e = emulator(control); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.registers[2], (42 << 8) | 40);
  assert.ok(e.logs.some(x => /CONFIRMED.*Water Target/.test(x)));
});
test('RMW uses a fresh high byte, not the poll snapshot', () => {
  const e = emulator(control); e.sync(); e.change('number', 223, 40);
  let changed = false;
  e.hook((m, p) => { if (!changed && m === 'MbRtuClient.ReadHoldingRegisters' && p.addr === 2 && p.qty === 1) {
    changed = true; e.registers[2] = (47 << 8) | 35;
  } });
  e.advance(15000); assert.equal(e.registers[2], (47 << 8) | 40);
});
test('Silent Mode preserves all other function bits and the silent level', () => {
  const e = emulator(control); e.sync(); e.change('boolean', 222, true); e.advance(15000);
  assert.equal(e.registers[5], 0x1c0);
});
test('DHW target uses address 4 and integer degrees', () => {
  const e = emulator(control); e.sync(); e.change('number', 224, 55); e.advance(15000);
  assert.equal(e.registers[4], 55); assert.equal(e.writes()[0].params.addr, 4);
});
test('negative temperatures decode as signed 16-bit whole degrees', () => {
  const e = emulator(control, { 104: 65531 }); e.sync(); assert.equal(e.value('number', 225), -5);
});
test('physical controller changes update UI without being written back', () => {
  const e = emulator(control); e.sync(); e.registers[2] = (42 << 8) | 39; e.advance(15000);
  assert.equal(e.value('number', 223), 39); assert.equal(e.writes().length, 0);
});
test('controller version mismatch blocks writes', () => {
  const e = emulator(control, { 131: 48 }); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.match(e.value('text', 228), /VERSION MISMATCH/);
});
test('missing expected version keeps control disabled', () => {
  const e = emulator({ enableWrites: true }); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.match(e.value('text', 228), /READ ONLY/);
});
test('room-control profile does not receive writes', () => {
  const e = emulator(control, { 0: 9 }); e.sync(); e.change('boolean', 222, true); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.match(e.value('text', 228), /ROOM CONTROL/);
});
test('factory and configured target limits both apply', () => {
  const e = emulator(control, { 203: 45 }); e.sync(); e.change('number', 223, 46); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.equal(e.value('number', 223), 35);
});
test('fractional setpoints cause no device write', () => {
  const e = emulator(control); e.sync(); e.change('number', 223, 35.5);
  e.until(() => !e.context.ready); assert.equal(e.writes().length, 0);
});
test('weather curve controls its own water target', () => {
  const e = emulator(control, { 5: 0x1180 }); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.match(e.value('text', 228), /WEATHER CURVE/);
});
test('fresh pre-write guards catch a newly activated weather curve', () => {
  const e = emulator(control); e.sync(); e.change('number', 223, 40);
  let reads = 0;
  e.hook((m, p) => { if (m === 'MbRtuClient.ReadHoldingRegisters' && p.addr === 0 && ++reads === 2) e.registers[5] |= 0x1000; });
  e.advance(15000); assert.equal(e.writes().length, 0);
});
test('active faults block writes', () => {
  const e = emulator(control, { 124: 9 }); e.sync(); e.change('boolean', 220, true); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.match(e.value('text', 228), /fault=9/);
});
test('offline changes are discarded during reconnect synchronization', () => {
  const e = emulator(control); e.sync(); e.offline(true);
  e.until(() => !e.context.ready); e.change('boolean', 220, true); e.change('number', 223, 45);
  e.offline(false); e.until(() => e.context.ready); e.advance(15000);
  assert.equal(e.writes().length, 0); assert.equal(e.value('number', 223), 35);
});
test('a write timeout is not automatically replayed', () => {
  const e = emulator(control); e.sync(); e.failWrite(true); e.change('number', 223, 40);
  e.until(() => !e.context.ready); e.failWrite(false); e.until(() => e.context.ready); e.advance(15000);
  assert.equal(e.writes().length, 1); assert.equal(e.registers[2] & 255, 35);
});
test('a lost write response/readback resynchronizes with physical state', () => {
  const e = emulator(control); e.sync(); e.failReadback(true); e.change('number', 223, 40);
  e.until(() => !e.context.ready); e.failReadback(false); e.until(() => e.context.ready); e.advance(15000);
  assert.equal(e.writes().length, 1); assert.equal(e.value('number', 223), 40);
});
test('a controller-rejected command publishes the actual readback', () => {
  const e = emulator(control); e.sync(); e.rejectWrites(true); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.value('number', 223), 35); assert.equal(e.writes().length, 1);
  assert.ok(e.logs.some(x => /NOT CONFIRMED/.test(x)));
});
test('one-word FC16 works only when explicitly configured', () => {
  const e = emulator({ ...control, writeFunction: 16 }); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.writes()[0].method, 'MbRtuClient.WriteHoldingRegisters');
  assert.deepEqual(e.writes()[0].params.values, [(42 << 8) | 40]);
});
test('DHW reads and writes are omitted when the tank is not configured', () => {
  const e = emulator({ ...control, hasDhwTank: false }); e.sync(); e.change('boolean', 221, true); e.advance(15000);
  assert.equal(e.writes().length, 0);
  assert.ok(!e.trace.some(x => x.method === 'MbRtuClient.ReadHoldingRegisters' && (x.params.addr === 115 || x.params.addr === 207)));
});
test('a foreign component ID is left untouched', () => {
  const e = emulator();
  e.components.set('boolean:220', { config: { name: 'Other application' }, value: true });
  e.advance(5000);
  assert.equal(e.components.size, 1); assert.equal(e.value('boolean', 220), true);
  assert.ok(!e.trace.some(x => /Virtual.Add|SetConfig/.test(x.method)));
});
test('capacity is checked before any components are created', () => {
  const e = emulator();
  for (let id = 200; id < 202; id++) e.components.set('boolean:' + id, { config: { name: 'Other' }, value: false });
  e.advance(5000); assert.equal(e.components.size, 2);
  assert.ok(!e.trace.some(x => x.method === 'Virtual.Add'));
});
test('one unrelated virtual component is compatible with nine bridge components', () => {
  const e = emulator(); e.components.set('boolean:200', { config: { name: 'Other' }, value: true });
  e.sync(); assert.equal(e.components.size, 10); assert.equal(e.value('boolean', 200), true);
});
test('all reads use Holding Registers; no installer or mode register is written', () => {
  const e = emulator(control); e.sync(); e.change('boolean', 220, true); e.change('number', 223, 40); e.advance(20000);
  assert.ok(!e.trace.some(x => /ReadInput|ReadCoils|WriteCoils/.test(x.method)));
  assert.ok(e.writes().every(x => [0, 2, 4, 5].includes(x.params.addr)));
});
test('cooling targets require allowCooling and controller cooling limits', () => {
  const e = emulator({ ...control, allowCooling: true }, { 1: 2, 2: (42 << 8) | 20 });
  e.sync(); e.change('number', 223, 15); e.advance(15000);
  assert.equal(e.registers[2], (42 << 8) | 15);
});
test('Auto does not accept a manual water target', () => {
  const e = emulator(control, { 1: 1 }); e.sync(); e.change('number', 223, 40); e.advance(15000);
  assert.equal(e.writes().length, 0);
});
test('fresh guards catch a mode changed on the original controller', () => {
  const e = emulator(control); e.sync(); e.change('number', 223, 40);
  let reads = 0;
  e.hook((m, p) => { if (m === 'MbRtuClient.ReadHoldingRegisters' && p.addr === 0 && ++reads === 2) e.registers[1] = 2; });
  e.advance(15000); assert.equal(e.writes().length, 0);
});
test('a replaced command is deferred until its latest UI value can be handled', () => {
  const e = emulator(control); e.sync(); e.change('number', 223, 40);
  let changed = false;
  e.hook((m, p) => { if (!changed && m === 'MbRtuClient.ReadHoldingRegisters' && p.addr === 2 && p.qty === 1) {
    changed = true; e.change('number', 223, 41);
  } });
  e.advance(30000);
  assert.equal(e.registers[2] & 255, 41);
  assert.ok(e.writes().every(x => (x.params.value & 255) !== 40));
});
