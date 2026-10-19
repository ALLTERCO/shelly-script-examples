const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const artifact = fs.readFileSync(
  require('node:path').join(
    __dirname,
    '..',
    'lg-kchh020ldgc-pro-rs485-vc.shelly.js'
  ),
  'utf8'
);
const meta = JSON.parse(artifact.match(/^\/\* @meta ([\s\S]*?)\*\//)[1]);

// Independent Modbus CRC implementation using a lookup table.
const table = Array.from({ length: 256 }, (_, v) => {
  for (let j = 0; j < 8; j++) v = v & 1 ? (v >>> 1) ^ 0xa001 : v >>> 1;
  return v;
});
function crc(buf) {
  let c = 0xffff;
  for (const n of buf) c = (c >>> 8) ^ table[(c ^ n) & 255];
  return c;
}
function packet(bytes) {
  const b = Buffer.from(bytes),
    c = crc(b);
  return Buffer.concat([b, Buffer.from([c & 255, c >>> 8])]);
}

class Fixture {
  constructor(options = {}) {
    this.options = options;
    this.ms = 0;
    this.jobs = [];
    this.seq = 0;
    this.logs = [];
    this.frames = [];
    this.writes = [];
    this.events = [];
    this.serialChanges = [];
    this.maxTimers = 0;
    this.storage = options.storage || new Map();
    this.components = options.components || new Map();
    this.serial = JSON.parse(
      JSON.stringify(
        options.serial || {
          mode: 'disabled',
          serial: { baud: 115200, format: '8N1' },
        }
      )
    );
    this.plant = {
      power: false,
      h: [0, 70, 350, 1, 1],
      t: [125, 70, 120],
      fault: 0,
    };
    Object.assign(this.plant, options.plant || {});
    this.plants = new Map([[1, this.plant]]);
    for (const [id, plant] of Object.entries(options.plants || {}))
      this.plants.set(Number(id), plant);
    this.provision();
    this.handles = {};
    this.rx = null;
    this.timerIds = new Set();
    const script = {
      id: 3,
      storage: {
        getItem: k => (this.storage.has(k) ? this.storage.get(k) : null),
        setItem: (k, v) => this.storage.set(k, v),
      },
      getVcHandle: role => this.handle(role),
    };
    const uart = {
      configure: o =>
        assert.deepEqual(JSON.parse(JSON.stringify(o)), {
          baud: 9600,
          format: '8N1',
        }),
      send: s => this.transmit(s),
      recv: cb => {
        this.rx = cb;
      },
    };
    const sandbox = {
      print: s => this.logs.push(String(s)),
      Script: script,
      UART: {
        get: id => (options.uartUnavailable ? null : id === 100 ? uart : null),
      },
      Timer: {
        set: (delay, repeat, fn) => {
          const id = ++this.seq;
          this.timerIds.add(id);
          this.maxTimers = Math.max(this.maxTimers, this.timerIds.size);
          const run = () => {
            if (!this.timerIds.has(id)) return;
            fn();
            if (repeat) this.schedule(delay, run);
            else this.timerIds.delete(id);
          };
          this.schedule(delay, run);
          return id;
        },
        clear: id => this.timerIds.delete(id),
      },
      Shelly: {
        getUptimeMs: () => this.ms,
        getDeviceInfo: () => ({
          model: 'SPEM-002CEBEU50',
          ver: '2.0.1',
          app: 'ProEM',
        }),
        call: (method, params, cb, userdata) =>
          this.rpc(method, params, cb, userdata),
      },
    };
    this.ctx = vm.createContext(sandbox);
    vm.runInContext(artifact.replace(/\ninit\(\);\s*$/, '\n'), this.ctx, {
      timeout: 1500,
    });
    Object.assign(this.ctx.CFG, options.cfg || {});
    if (options.prestart) options.prestart(this.ctx);
    this.ctx.init();
  }
  provision() {
    const owned = [...this.components.values()].filter(
      c => c.owner === 'script:3'
    );
    const existingRoles = new Set(owned.map(c => c.role));
    const missing = Object.keys(meta.vc).filter(
      role => !existingRoles.has(role)
    );
    const obsolete = owned.filter(c => !meta.vc[c.role]);
    if (this.components.size - obsolete.length + missing.length > 10)
      throw new Error('firmware VC budget');
    for (const c of obsolete) this.components.delete(c.key);
    for (const [role, spec] of Object.entries(meta.vc)) {
      let c = owned.find(c => c.role === role);
      if (!c) {
        let id = 200;
        while (this.components.has(spec.type + ':' + id)) id++;
        const key = spec.type + ':' + id;
        c = { key, role, owner: 'script:3', value: spec.config.default_value };
        this.components.set(key, c);
      }
      c.spec = structuredClone(spec);
      if (this.options.stale && role in this.options.stale)
        c.value = this.options.stale[role];
    }
  }
  handle(role) {
    if (this.handles[role]) return this.handles[role];
    const c = [...this.components.values()].find(
      c => c.owner === 'script:3' && c.role === role
    );
    if (!c) return null;
    const listeners = [];
    this.handles[role] = {
      getValue: () => c.value,
      getStatus: () => ({ value: c.value, source: c.source }),
      getConfig: () => ({
        id: Number(c.key.split(':')[1]),
        ...structuredClone(c.spec.config),
      }),
      setValue: v =>
        this.schedule(1, () => this.set(c, v, 'script:3', listeners)),
      on: (event, cb) => {
        assert.equal(event, 'change');
        listeners.push(cb);
        return listeners.length;
      },
      input: (v, source = 'http') => this.set(c, v, source, listeners),
      force: (v, source = 'http') => {
        for (const cb of listeners)
          this.schedule(1, () => cb({ source, value: v }));
      },
    };
    return this.handles[role];
  }
  set(c, value, source, listeners) {
    const old = c.value;
    c.value = value;
    c.source = source;
    if (old !== value)
      for (const cb of listeners) this.schedule(1, () => cb({ source, value }));
  }
  input(role, value, source = 'http') {
    if (!meta.vc[role].access.includes('w')) return false;
    this.handles[role].input(value, source);
    return true;
  }
  value(role) {
    return this.handle(role).getValue();
  }
  schedule(delay, fn) {
    this.jobs.push({ at: this.ms + delay, fn, id: ++this.seq });
  }
  advance(duration) {
    const end = this.ms + duration;
    let iterations = 0;
    while (true) {
      this.jobs.sort((a, b) => a.at - b.at || a.id - b.id);
      if (!this.jobs.length || this.jobs[0].at > end) break;
      const j = this.jobs.shift();
      this.ms = j.at;
      j.fn();
      assert(++iterations < 100000, 'scheduler runaway');
    }
    this.ms = end;
  }
  rpc(method, p, cb, userdata) {
    this.schedule(1, () => {
      if (method === 'Shelly.GetComponents') {
        const cs = [
          { key: 'sys' },
          { key: 'script:3' },
          ...Array.from(this.components.values()).map(c => ({
            key: c.key,
            attrs: { owner: c.owner, role: c.role },
          })),
          {
            key: 'serial:100',
            attrs: {
              modes: this.options.noJsuart
                ? ['mb_client']
                : ['disabled', 'jsuart', 'mb_client'],
            },
          },
        ];
        const offset = p.offset || 0;
        cb(
          {
            components: cs.slice(offset, offset + 3),
            offset,
            total: cs.length,
          },
          0,
          ''
        );
      } else if (method === 'Serial.GetConfig')
        cb(structuredClone(this.serial), 0, '');
      else if (method === 'Serial.SetConfig') {
        this.serialChanges.push(JSON.parse(JSON.stringify(p)));
        Object.assign(this.serial, structuredClone(p.config));
        cb({ restart_required: false }, 0, '');
      } else if (method.endsWith('.SetConfig')) {
        const type = method.split('.')[0].toLowerCase();
        const c = this.components.get(type + ':' + p.id);
        assert(c && c.owner === 'script:3');
        if (c.role === this.options.configFailureRole) {
          cb(null, -104, 'simulated config rejection', userdata);
          return;
        }
        Object.assign(c.spec.config, JSON.parse(JSON.stringify(p.config)));
        cb({ restart_required: false }, 0, '', userdata);
      } else throw Error('Unapproved RPC ' + method);
    });
  }
  transmit(s) {
    const b = Buffer.from(s, 'latin1');
    assert.equal(b.length, 8);
    assert.equal(crc(b.subarray(0, 6)), b.readUInt16LE(6));
    const req = {
      sid: b[0],
      fc: b[1],
      a: b.readUInt16BE(2),
      n: b.readUInt16BE(4),
      at: this.ms,
    };
    assert(req.sid >= 1 && req.sid <= 247);
    this.frames.push(req);
    if (req.fc === 5 || req.fc === 6) this.writes.push(req);
    const plant = this.plants.get(req.sid);
    if (!plant) return s.length;
    const behavior = this.options.behavior
      ? this.options.behavior(req, this)
      : {};
    let out;
    if (behavior.exception)
      out = packet([req.sid, req.fc | 128, behavior.exception]);
    else if (req.fc === 1) out = packet([req.sid, 1, 1, plant.power ? 1 : 0]);
    else if (req.fc === 3) {
      assert.equal(req.a, 1);
      assert.equal(req.n, 5);
      const bytes = plant.h.flatMap(v => [(v >>> 8) & 255, v & 255]);
      out = packet([req.sid, 3, 10, ...bytes]);
    } else if (req.fc === 4) {
      let v = req.a === 3 ? plant.t.slice(1) : [plant.fault];
      assert((req.a === 3 && req.n === 2) || (req.a === 9 && req.n === 1));
      out = packet([
        req.sid,
        4,
        v.length * 2,
        ...v.flatMap(v => [(v >>> 8) & 255, v & 255]),
      ]);
    } else if (req.fc === 5) {
      assert.equal(req.a, 0);
      assert(req.n === 0 || req.n === 65280);
      if (!behavior.notApplied) plant.power = req.n !== 0;
      out = Buffer.from(b);
    } else if (req.fc === 6) {
      assert(req.a >= 1 && req.a <= 3);
      if (!behavior.notApplied) plant.h[req.a - 1] = req.n;
      out = Buffer.from(b);
    } else throw Error('Undocumented function code ' + req.fc);
    if (behavior.drop) return s.length;
    if (behavior.corrupt) out[out.length - 1] ^= 0x40;
    if (behavior.wrongSid) {
      out[0] = 2;
      out = packet(out.subarray(0, out.length - 2));
    }
    if (behavior.noise)
      out = Buffer.concat([Buffer.from([17, 3, 2, 0, 1, 0, 0]), out]);
    const delay = behavior.delay || 30;
    if (behavior.split) {
      this.schedule(delay, () =>
        this.rx(out.subarray(0, 3).toString('latin1'))
      );
      this.schedule(delay + 20, () =>
        this.rx(out.subarray(3).toString('latin1'))
      );
    } else this.schedule(delay, () => this.rx(out.toString('latin1')));
    return s.length;
  }
  ready() {
    this.advance(1800);
    assert.equal(this.ctx.synchronized, true, this.logs.join('\n'));
    return this;
  }
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

test('exactly nine managed roles with read-only telemetry', () => {
  assert.equal(Object.keys(meta.vc).length, 9);
  for (const r of ['ewt', 'lwt', 'fault', 'link'])
    assert.equal(meta.vc[r].access, 'rc');
  assert.equal(meta.vc.address.access, 'wc');
  assert.equal(meta.vc.address.config.persisted, true);
  assert.equal(meta.vc.outdoor, undefined);
  const f = new Fixture().ready();
  assert.equal(f.components.size, 9);
  assert.equal(f.maxTimers, 1);
});
test('firmware reconciliation reruns reuse owned roles', () => {
  const a = new Fixture().ready();
  const keys = [...a.components.keys()];
  const b = new Fixture({
    components: a.components,
    storage: a.storage,
  }).ready();
  assert.deepEqual([...b.components.keys()], keys);
  assert.equal(b.components.size, 9);
});
test('foreign component survives creation without ID assumptions', () => {
  const foreign = { key: 'number:200', owner: 'script:99', value: 123 };
  const cs = new Map([[foreign.key, foreign]]);
  new Fixture({ components: cs }).ready();
  assert.equal(cs.size, 10);
  assert.equal(cs.get('number:200'), foreign);
  assert.equal(foreign.value, 123);
});
test('firmware budget failure is atomic in simulated reconciliation', () => {
  const cs = new Map([
    ['number:200', { key: 'number:200', owner: 'foreign', value: 1 }],
    ['number:201', { key: 'number:201', owner: 'foreign', value: 2 }],
  ]);
  assert.throws(() => new Fixture({ components: cs }), /VC budget/);
  assert.equal(cs.size, 2);
});
test('boot never writes stale UI values, including when commissioned', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    stale: { power: true, mode: 'Heating', cool: 24, heat: 58 },
  }).ready();
  assert.equal(f.writes.length, 0);
  assert.equal(f.value('power'), false);
  assert.equal(f.value('cool'), 7);
});
test('read-only controls restore actual state without Modbus writes', () => {
  const f = new Fixture().ready();
  f.input('power', true);
  f.input('cool', 12);
  f.advance(2000);
  assert.equal(f.writes.length, 0);
  assert.equal(f.value('power'), false);
  assert.equal(f.value('cool'), 7);
});
test('FC05 power write is confirmed by subsequent coil read', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.input('power', true);
  f.advance(3000);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].fc, 5);
  assert.equal(f.writes[0].n, 65280);
  assert.equal(f.value('power'), true);
  assert(f.value('link').includes('CONFIRMED power'));
});
test('FC06 cooling setpoint uses offset2 and verified candidate scale', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.input('cool', 8);
  f.advance(3000);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].fc, 6);
  assert.equal(f.writes[0].a, 2);
  assert.equal(f.writes[0].n, 80);
  assert.equal(f.value('cool'), 8);
});
test('FC06 mode changes use supplied YAML enum4', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.input('mode', 'Heating');
  f.advance(3000);
  assert.equal(f.writes[0].a, 1);
  assert.equal(f.writes[0].n, 4);
  assert.equal(f.value('mode'), 'Heating');
});
test('heating permits60 and rejects20/NaN/Infinity', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  for (const v of [20, NaN, Infinity]) {
    f.handle('heat').force(v);
    f.advance(50);
  }
  assert.equal(f.writes.length, 0);
  f.input('heat', 60);
  f.advance(3000);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].a, 3);
  assert.equal(f.writes[0].n, 600);
});
test('sensor access denies external writes', () => {
  const f = new Fixture().ready();
  assert.equal(f.input('lwt', 50), false);
  assert.equal(f.value('lwt'), 7);
});
test('changes from original LG controller are mirrored without feedback writes', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.plant.power = true;
  f.plant.h[0] = 4;
  f.plant.h[1] = 90;
  f.plant.t = [150, 380, 330];
  f.advance(7000);
  assert.equal(f.value('power'), true);
  assert.equal(f.value('mode'), 'Heating');
  assert.equal(f.value('cool'), 9);
  assert.equal(f.value('lwt'), 38);
  assert.equal(f.writes.length, 0);
});
test('signed water register handles negative temperatures', () => {
  const f = new Fixture({ plant: { t: [125, 65526, 120] } }).ready();
  assert.equal(f.value('lwt'), -1);
});
test('unknown mode blocks synchronization and commands', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    plant: { h: [3, 70, 350, 1, 1] },
  });
  f.advance(3000);
  assert.equal(f.ctx.synchronized, false);
  assert(f.value('link').includes('MAP/SCALE'));
  f.input('cool', 8);
  f.advance(3000);
  assert.equal(f.writes.length, 0);
});
test('wrong setpoint scale is rejected, independent scales supported', () => {
  const bad = new Fixture({ plant: { h: [0, 7, 35, 1, 1] } });
  bad.advance(2000);
  assert.equal(bad.ctx.synchronized, false);
  const good = new Fixture({
    plant: { h: [0, 7, 35, 1, 1] },
    cfg: { SETPOINT_SCALE: 1, SENSOR_SCALE: 0.1 },
  }).ready();
  assert.equal(good.value('heat'), 35);
  assert.equal(good.value('ewt'), 12);
});
test('bad CRC marks stale; reconnect reads fresh values without replay', () => {
  let corrupt = false;
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: () => ({ corrupt }),
  }).ready();
  corrupt = true;
  f.advance(12000);
  assert.equal(f.ctx.synchronized, false);
  f.input('power', true);
  f.advance(100);
  corrupt = false;
  f.advance(15000);
  assert.equal(f.ctx.synchronized, true);
  assert.equal(f.writes.length, 0);
  assert.equal(f.value('power'), false);
});
test('lost write acknowledgement is not retried and is resolved by readback', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: r => ({ drop: r.fc === 6 }),
  }).ready();
  f.input('cool', 9);
  f.advance(7000);
  assert.equal(f.writes.length, 1);
  assert.equal(f.value('cool'), 9);
  assert(f.value('link').includes('CONFIRMED cool'));
});
test('write echo with no applied command does not count as success', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: r => ({ notApplied: r.fc === 5 }),
  }).ready();
  f.input('power', true);
  f.advance(3500);
  assert.equal(f.writes.length, 1);
  assert.equal(f.value('power'), false);
  assert(f.value('link').includes('MISMATCH power'));
});
test('Modbus exception is rejected and not blindly retried', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: r => ({ exception: r.fc === 6 ? 3 : 0 }),
  }).ready();
  f.input('heat', 40);
  f.advance(3500);
  assert.equal(f.writes.length, 1);
  assert.equal(f.value('heat'), 35);
  assert(f.value('link').includes('MISMATCH heat'));
});
test('queued duplicate control changes coalesce to the last value', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.input('cool', 8);
  f.input('cool', 9);
  f.input('cool', 10);
  f.advance(3500);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].n, 100);
});
test('commands expire while waiting for another command verification', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true, COMMAND_TTL_MS: 1000, SETTLE_MS: 4000 },
  }).ready();
  f.input('cool', 8);
  f.input('heat', 40);
  f.advance(8500);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].a, 2);
});
test('fragmented responses and unrelated leading bytes are handled', () => {
  const f = new Fixture({
    behavior: () => ({ split: true, noise: true }),
  }).ready();
  assert.equal(f.value('ewt'), 12);
  assert.equal(f.writes.length, 0);
});
test('wrong slave responses do not synchronize or enable writes', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: () => ({ wrongSid: true }),
  });
  f.advance(7000);
  assert.equal(f.ctx.synchronized, false);
  assert.equal(f.writes.length, 0);
});
test('RX overflow is bounded and blocks commands', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: () => ({ drop: true }),
  });
  f.advance(700);
  f.rx('x'.repeat(300));
  f.advance(5000);
  assert.equal(f.ctx.synchronized, false);
  assert(f.ctx.rxBuffer.length <= 256);
});
test('broadcast address and invalid timer config rejected at startup', () => {
  for (const cfg of [
    { SLAVE_ID: 0 },
    { POLL_MS: NaN },
    { GAP_MS: 0 },
    { TIMEOUT_MS: 6000 },
  ]) {
    const f = new Fixture({ cfg });
    f.advance(3000);
    assert.equal(f.frames.length, 0);
  }
});
test('no jsuart capability stops before serial reconfiguration', () => {
  const f = new Fixture({ noJsuart: true });
  f.advance(1000);
  assert.equal(f.frames.length, 0);
  assert.equal(f.serialChanges.length, 0);
  assert.equal(f.ctx.stopped, true);
});
test('unavailable UART handle stops without Modbus frames', () => {
  const f = new Fixture({ uartUnavailable: true });
  f.advance(1000);
  assert.equal(f.frames.length, 0);
  assert.equal(f.ctx.stopped, true);
});
test('original serial configuration backed up once and retained', () => {
  const storage = new Map();
  const first = new Fixture({ storage }).ready();
  const saved = storage.get('lgser100');
  assert.equal(JSON.parse(saved).mode, 'disabled');
  new Fixture({
    storage,
    serial: { mode: 'mb_client', serial: { baud: 19200, format: '8E1' } },
  }).ready();
  assert.equal(storage.get('lgser100'), saved);
  assert.equal(first.serialChanges[0].config.mode, 'jsuart');
});
test('allowlist excludes installer registers and FC15', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  assert.equal(f.ctx.allowed(6, 4, 1), false);
  assert.equal(f.ctx.allowed(6, 0, 100), false);
  assert.equal(f.ctx.allowed(15, 0, 1), false);
  assert.equal(f.ctx.allowed(5, 1, 65280), false);
});
test('CRC agrees with a known Modbus vector', () => {
  const f = new Fixture();
  const input = Buffer.from('010300000001', 'hex');
  assert.equal(f.ctx.crc(input.toString('latin1')), 0x0a84);
  assert.equal(crc(input), 0x0a84);
});
test('enabled plant fault blocks start request but allows stop', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    plant: { fault: 123 },
  }).ready();
  f.input('power', true);
  f.advance(3000);
  assert.equal(f.writes.length, 0);
  f.plant.power = true;
  f.advance(7000);
  assert.equal(f.value('power'), true);
  f.input('power', false);
  f.advance(3000);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].n, 0);
});
test('user commands have separate desired and actual values until readback', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.input('cool', 8);
  f.advance(300);
  assert.equal(f.value('cool'), 7);
  f.advance(3000);
  assert.equal(f.value('cool'), 8);
});
test('first read timeout blocks queued writes before retry and starts a fresh snapshot', () => {
  let drop = false;
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: r => ({ drop: drop && r.fc === 4 }),
  }).ready();
  drop = true;
  f.advance(8000);
  assert.equal(f.ctx.synchronized, false);
  assert.equal(f.ctx.commandQueue.length, 0);
  f.input('power', true);
  f.advance(100);
  drop = false;
  f.plant.t = [160, 90, 140];
  f.advance(12000);
  assert.equal(f.ctx.synchronized, true);
  assert.equal(f.writes.length, 0);
  assert.equal(f.value('power'), false);
  assert.equal(f.value('lwt'), 9);
});
test('write timeout clears other queued commands before readback recovery', () => {
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    behavior: r => ({ drop: r.fc === 6 }),
  }).ready();
  f.input('cool', 8);
  f.input('heat', 40);
  f.advance(7000);
  assert.equal(f.writes.length, 1);
  assert.equal(f.value('cool'), 8);
  assert.equal(f.value('heat'), 35);
});
test('Modbus address tile selects a new server without any actuator write', () => {
  const second = {
    power: true,
    h: [4, 90, 400, 1, 1],
    t: [130, 380, 320],
    fault: 0,
  };
  const f = new Fixture({ plants: { 2: second } }).ready();
  f.input('address', 2);
  f.advance(50);
  assert.equal(f.ctx.synchronized, false);
  assert.equal(f.ctx.CFG.SLAVE_ID, 2);
  f.advance(5000);
  assert.equal(f.ctx.synchronized, true);
  assert.equal(f.value('address'), 2);
  assert.equal(f.value('heat'), 40);
  assert.equal(f.value('power'), true);
  assert.equal(f.writes.length, 0);
  assert(f.frames.slice(-4).every(r => r.sid === 2));
});
test('selected Modbus address persists across script restart', () => {
  const second = {
    power: true,
    h: [4, 90, 400, 1, 1],
    t: [130, 380, 320],
    fault: 0,
  };
  const first = new Fixture({ plants: { 2: second } }).ready();
  first.input('address', 2);
  first.advance(5000);
  const reboot = new Fixture({
    components: first.components,
    storage: first.storage,
    plants: { 2: second },
  }).ready();
  assert.equal(reboot.ctx.CFG.SLAVE_ID, 2);
  assert(reboot.frames.every(r => r.sid === 2));
  assert.equal(reboot.value('heat'), 40);
  assert.equal(reboot.writes.length, 0);
});
test('invalid address values are rejected without changing destination', () => {
  const f = new Fixture().ready();
  for (const n of [0, 248, 1.5, NaN, Infinity, '2']) {
    f.handle('address').force(n);
    f.advance(25);
  }
  assert.equal(f.ctx.CFG.SLAVE_ID, 1);
  assert.equal(f.value('address'), 1);
  assert(f.frames.every(r => r.sid === 1));
  assert.equal(f.writes.length, 0);
});
test('address change discards queued commands for the old server', () => {
  const second = {
    power: false,
    h: [0, 90, 400, 1, 1],
    t: [130, 90, 120],
    fault: 0,
  };
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    plants: { 2: second },
  }).ready();
  f.input('cool', 8);
  f.input('heat', 40);
  f.input('address', 2);
  f.advance(5000);
  assert.equal(f.writes.length, 0);
  assert.equal(f.ctx.CFG.SLAVE_ID, 2);
  assert.equal(f.value('cool'), 9);
});
test('address change during an outstanding command cancels callbacks and never retries it', () => {
  const second = {
    power: false,
    h: [0, 90, 400, 1, 1],
    t: [130, 90, 120],
    fault: 0,
  };
  const f = new Fixture({
    cfg: { ENABLE_WRITES: true },
    plants: { 2: second },
    behavior: r => ({ delay: r.fc === 6 ? 700 : 30 }),
  }).ready();
  f.input('cool', 8);
  f.advance(150);
  assert.equal(f.writes.length, 1);
  f.input('address', 2);
  f.advance(6000);
  assert.equal(f.ctx.synchronized, true);
  assert.equal(f.value('cool'), 9);
  assert.equal(f.value('address'), 2);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].sid, 1);
});
test('rapid address selection A-B-A rejects old responses and re-reads A', () => {
  const f = new Fixture({ behavior: r => ({ delay: 700 }) });
  f.advance(750);
  assert(f.ctx.transaction);
  f.input('address', 2);
  f.advance(20);
  f.input('address', 1);
  f.advance(8000);
  assert.equal(f.ctx.synchronized, true);
  assert.equal(f.ctx.CFG.SLAVE_ID, 1);
  assert.equal(f.value('address'), 1);
  assert.equal(f.value('cool'), 7);
  assert.equal(f.writes.length, 0);
});
test('unresponsive selected address stays unsynchronized and blocks actuator commands', () => {
  const f = new Fixture({ cfg: { ENABLE_WRITES: true } }).ready();
  f.input('address', 247);
  f.advance(7000);
  assert.equal(f.ctx.synchronized, false);
  assert.equal(f.value('address'), 247);
  f.input('power', true);
  f.advance(3000);
  assert.equal(f.writes.length, 0);
});
test('same-slot manifest migration replaces only the old outdoor role and preserves foreign components', () => {
  const old = new Fixture().ready();
  const tile = [...old.components.values()].find(c => c.role === 'address');
  tile.role = 'outdoor';
  tile.value = 15;
  const foreign = { key: 'number:299', owner: 'script:99', value: 999 };
  old.components.set(foreign.key, foreign);
  const updated = new Fixture({
    components: old.components,
    storage: old.storage,
  }).ready();
  assert.equal(updated.components.size, 10);
  assert.equal(updated.components.get(foreign.key), foreign);
  assert.equal(
    [...updated.components.values()].filter(c => c.owner === 'script:3').length,
    9
  );
  assert(![...updated.components.values()].some(c => c.role === 'outdoor'));
  assert.equal(updated.value('address'), 1);
});

test('managed metadata satisfies the physical 1024-character first-line limit', () => {
  const first = artifact.split('\n')[0];
  assert(first.startsWith('/* @meta {') && first.endsWith('} */'));
  assert(first.length <= 1024);
  assert(artifact.trimEnd().endsWith('init();'));
});
test('owned VC configuration failure prevents serial setup and bus requests', () => {
  const f = new Fixture({ configFailureRole: 'heat' });
  f.advance(3000);
  assert.equal(f.ctx.stopped, true);
  assert.equal(f.serialChanges.length, 0);
  assert.equal(f.frames.length, 0);
});

const failed = results.filter(r => r.status === 'FAIL');
const report = {
  validation: 'simulator-checked',
  hardware_tested: false,
  tests: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  limits:
    'Node VM with documented APIs and firmware reconciliation model; cannot validate Espruino memory/parser, real UART/RS485, actual LG map/scales or cloud UI.',
  results,
};
if (process.env.LG_TEST_REPORT)
  fs.writeFileSync(process.env.LG_TEST_REPORT, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    tests: report.tests,
    passed: report.passed,
    failed: report.failed,
  })
);
process.exitCode = failed.length ? 1 : 0;
