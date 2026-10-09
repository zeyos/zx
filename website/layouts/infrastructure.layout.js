import {
  AccountMenu, ActivityList, AppSidebar, Chart, ChartJsAdapter, Dialog, InlineLoading, MenuButton,
  Search, Select, TableView, Tooltip, badge, button, copyButton, downloadBlob, emptyState, formatDate,
  formatNumber, formatPercent, formatRelativeTime, h, icon, rovingTabindex, statTile, toCsv
} from '../../src/index.js';
import {
  DATE, SHELL_BREAKPOINTS, adaptiveShell, allowsMotion, chartOptions, chartPalette, chartScales, disposer, dot,
  iconButton, iconTile, later,
  layoutContext, listTime, loadChartJs, paneHeader, panelBlock, propList, renderScope, shortcuts, toaster, unavailable,
  unavailablePane, watchTheme, workspaceHeader
} from './kit.js';
import { COMPANIES, ME, NOW, person } from './fixtures.js';

/**
 * Fieldstone's three data centres, and the counts the inventory below does not itemise. `peak` is
 * the busiest hour's inbound traffic and `uplink` the transit capacity, both in Gb/s.
 */
const SITES = [
  { id: 'fra1', name: 'FRA1', city: 'Frankfurt', octet: 10, vms: 186, vmDelta: 6, added: 3, peak: 6.4, uplink: 10 },
  { id: 'ber2', name: 'BER2', city: 'Berlin', octet: 20, vms: 112, vmDelta: -3, added: 1, peak: 3.6, uplink: 5 },
  { id: 'ams1', name: 'AMS1', city: 'Amsterdam', octet: 30, vms: 78, vmDelta: 2, added: 2, peak: 2.5, uplink: 5 }
];

/** Device lifecycle states, each drawn in one semantic tone everywhere it appears. */
const STATUSES = [
  { ID: 'active', name: 'Active', tone: 'success', indicator: 'done' },
  { ID: 'planned', name: 'Planned', tone: 'info', indicator: 'dotted' },
  { ID: 'offline', name: 'Offline', tone: 'neutral', indicator: 'ring' },
  { ID: 'failed', name: 'Failed', tone: 'danger', indicator: 'canceled' },
  { ID: 'decommissioning', name: 'Decommissioning', tone: 'warning', indicator: 'waiting' }
];

/** What a device is for. A rack drawing fills each device in its family's categorical tone. */
const FAMILIES = {
  network: { name: 'Network', tone: 'blue' },
  security: { name: 'Security', tone: 'violet' },
  compute: { name: 'Compute', tone: 'teal' },
  storage: { name: 'Storage', tone: 'pink' },
  other: { name: 'Other', tone: 'slate' }
};

/** Hardware models. `units` is the height in rack units; `family` is a key into `FAMILIES`. */
const DEVICE_TYPES = {
  patch: { maker: 'Generic', model: 'PP-24', units: 1, role: 'Patch panel', family: 'other', platform: null, icon: 'ethernet' },
  leaf: { maker: 'Lumeno', model: 'LX-4825', units: 1, role: 'Leaf switch', family: 'network', platform: 'NetOS 7.2', icon: 'network-wired' },
  mgmt: { maker: 'Lumeno', model: 'LX-1248', units: 1, role: 'Management switch', family: 'network', platform: 'NetOS 7.2', icon: 'network-wired' },
  firewall: { maker: 'Lumeno', model: 'LF-220', units: 1, role: 'Firewall', family: 'security', platform: 'NetOS 7.2', icon: 'shield-halved' },
  router: { maker: 'Lumeno', model: 'LR-640', units: 2, role: 'Edge router', family: 'network', platform: 'NetOS 7.2', icon: 'route' },
  compute1: { maker: 'Fernwerk', model: 'FX-1', units: 1, role: 'Compute', family: 'compute', platform: 'Linux 6.6', icon: 'server' },
  compute2: { maker: 'Fernwerk', model: 'FX-2', units: 2, role: 'Compute', family: 'compute', platform: 'Hypervisor 8.2', icon: 'server' },
  storage: { maker: 'Tessel', model: 'T-412', units: 4, role: 'Storage', family: 'storage', platform: 'StorOS 4.1', icon: 'hard-drive' },
  kvm: { maker: 'Generic', model: 'KVM-1', units: 1, role: 'Console', family: 'other', platform: null, icon: 'keyboard' },
  ups: { maker: 'Quellstrom', model: 'Q-3000', units: 2, role: 'Power', family: 'other', platform: 'Firmware 2.3', icon: 'bolt' }
};

/**
 * Two 42U racks per site, front view, units numbered from the bottom. Each device is
 * `[lowest unit, name, type, status = 'active']` and fills its type's height upwards from there.
 * `reserved` lists the runs of units held for planned work, as `[lowest unit, height, reason]`.
 */
const RACKS = [
  { id: 'fra1-r02', site: 'fra1', name: 'R02', location: 'Hall A · row 1', units: 42,
    reserved: [[18, 4, 'Compute expansion']], devices: [
    [42, 'fra1-r02-pp1', 'patch'], [41, 'fra1-r02-leaf1', 'leaf'], [40, 'fra1-r02-leaf2', 'leaf'],
    [38, 'fra1-r02-oob1', 'mgmt'], [36, 'fra1-fw1', 'firewall'], [35, 'fra1-fw2', 'firewall'],
    [32, 'fra1-edge1', 'router'], [28, 'fra1-cmp-01', 'compute2'], [26, 'fra1-cmp-02', 'compute2'],
    [24, 'fra1-cmp-03', 'compute2'], [22, 'fra1-cmp-04', 'compute2', 'planned'],
    [12, 'fra1-sto-01', 'storage'], [8, 'fra1-sto-02', 'storage'], [1, 'fra1-r02-ups1', 'ups']] },
  { id: 'fra1-r03', site: 'fra1', name: 'R03', location: 'Hall A · row 2', units: 42,
    reserved: [[20, 4, 'Replaces fra1-sto-04']], devices: [
    [42, 'fra1-r03-pp1', 'patch'], [41, 'fra1-r03-leaf1', 'leaf'], [40, 'fra1-r03-leaf2', 'leaf'],
    [38, 'fra1-r03-oob1', 'mgmt'], [34, 'fra1-cmp-11', 'compute2'], [32, 'fra1-cmp-12', 'compute2'],
    [30, 'fra1-cmp-13', 'compute2', 'failed'], [28, 'fra1-cmp-14', 'compute2'],
    [24, 'fra1-cmp-15', 'compute2', 'planned'], [16, 'fra1-sto-03', 'storage'],
    [12, 'fra1-sto-04', 'storage', 'decommissioning'], [7, 'fra1-r03-kvm1', 'kvm', 'offline'],
    [1, 'fra1-r03-ups1', 'ups']] },
  { id: 'ber2-r01', site: 'ber2', name: 'R01', location: 'Hall 3 · row C', units: 42,
    reserved: [], devices: [
    [42, 'ber2-r01-pp1', 'patch'], [41, 'ber2-r01-leaf1', 'leaf'], [40, 'ber2-r01-leaf2', 'leaf'],
    [39, 'ber2-r01-oob1', 'mgmt'], [37, 'ber2-fw1', 'firewall'], [34, 'ber2-edge1', 'router'],
    [30, 'ber2-cmp-01', 'compute1'], [29, 'ber2-cmp-02', 'compute1'], [28, 'ber2-cmp-03', 'compute1'],
    [27, 'ber2-cmp-04', 'compute1'], [26, 'ber2-cmp-05', 'compute1', 'offline'],
    [25, 'ber2-cmp-06', 'compute1'], [14, 'ber2-sto-01', 'storage'], [1, 'ber2-r01-ups1', 'ups']] },
  { id: 'ber2-r02', site: 'ber2', name: 'R02', location: 'Hall 3 · row C', units: 42,
    reserved: [], devices: [
    [42, 'ber2-r02-pp1', 'patch'], [41, 'ber2-r02-leaf1', 'leaf'], [40, 'ber2-r02-leaf2', 'leaf'],
    [38, 'ber2-r02-oob1', 'mgmt'], [34, 'ber2-cmp-07', 'compute2'], [32, 'ber2-cmp-08', 'compute2'],
    [30, 'ber2-cmp-09', 'compute2', 'planned'], [28, 'ber2-cmp-10', 'compute2', 'planned'],
    [18, 'ber2-sto-02', 'storage'], [1, 'ber2-r02-ups1', 'ups']] },
  { id: 'ams1-r01', site: 'ams1', name: 'R01', location: 'Suite 2.14', units: 42,
    reserved: [], devices: [
    [42, 'ams1-r01-pp1', 'patch'], [41, 'ams1-r01-leaf1', 'leaf'], [40, 'ams1-r01-leaf2', 'leaf'],
    [38, 'ams1-r01-oob1', 'mgmt'], [36, 'ams1-fw1', 'firewall'], [33, 'ams1-edge1', 'router'],
    [31, 'ams1-edge2', 'router', 'planned'], [26, 'ams1-cmp-01', 'compute2'],
    [24, 'ams1-cmp-02', 'compute2'], [22, 'ams1-cmp-03', 'compute2'], [10, 'ams1-sto-01', 'storage'],
    [1, 'ams1-r01-ups1', 'ups']] },
  { id: 'ams1-r02', site: 'ams1', name: 'R02', location: 'Suite 2.14', units: 42,
    reserved: [[22, 4, 'Cluster expansion']], devices: [
    [42, 'ams1-r02-pp1', 'patch'], [41, 'ams1-r02-leaf1', 'leaf'], [40, 'ams1-r02-leaf2', 'leaf'],
    [38, 'ams1-r02-oob1', 'mgmt'], [36, 'ams1-cmp-04', 'compute1'], [35, 'ams1-cmp-05', 'compute1'],
    [34, 'ams1-cmp-06', 'compute1', 'failed'], [33, 'ams1-cmp-07', 'compute1'],
    [20, 'ams1-cmp-08', 'compute2', 'planned'], [18, 'ams1-cmp-09', 'compute2', 'planned'],
    [1, 'ams1-r02-ups1', 'ups', 'decommissioning']] }
];

/** Address space per site. `size` and `used` count addresses. */
const PREFIXES = [
  { prefix: '10.10.0.0/20', site: 'fra1', role: 'Servers', size: 4096, used: 2950 },
  { prefix: '10.10.16.0/22', site: 'fra1', role: 'Storage', size: 1024, used: 941 },
  { prefix: '10.10.240.0/24', site: 'fra1', role: 'Management', size: 256, used: 61 },
  { prefix: '192.0.2.0/26', site: 'fra1', role: 'Public edge', size: 64, used: 41 },
  { prefix: '10.20.0.0/20', site: 'ber2', role: 'Servers', size: 4096, used: 1720 },
  { prefix: '10.20.16.0/22', site: 'ber2', role: 'Storage', size: 1024, used: 402 },
  { prefix: '10.20.240.0/24', site: 'ber2', role: 'Management', size: 256, used: 233 },
  { prefix: '198.51.100.0/27', site: 'ber2', role: 'Public edge', size: 32, used: 19 },
  { prefix: '10.30.0.0/21', site: 'ams1', role: 'Servers', size: 2048, used: 1608 },
  { prefix: '10.30.240.0/24', site: 'ams1', role: 'Management', size: 256, used: 48 },
  { prefix: '203.0.113.0/27', site: 'ams1', role: 'Public edge', size: 32, used: 29 }
];

/** Alert severities, most urgent first. */
const SEVERITIES = {
  critical: { label: 'Critical', tone: 'danger', icon: 'circle-exclamation', rank: 0 },
  warning: { label: 'Warning', tone: 'warning', icon: 'triangle-exclamation', rank: 1 },
  info: { label: 'Info', tone: 'info', icon: 'circle-info', rank: 2 }
};

/** Open monitoring alerts. `device` links into the inventory; `minutes` is the age. */
const ALERTS = [
  { id: 'al-1', site: 'fra1', severity: 'critical', title: 'Power supply 2 failed', device: 'fra1-cmp-13', minutes: 14 },
  { id: 'al-2', site: 'ams1', severity: 'critical', title: 'Host unreachable', device: 'ams1-cmp-06', minutes: 38 },
  { id: 'al-3', site: 'fra1', severity: 'warning', title: 'Inlet temperature 29 °C', subject: 'Rack R03', minutes: 25 },
  { id: 'al-4', site: 'ams1', severity: 'warning', title: `Transit B at ${formatPercent(0.87)} of capacity`, device: 'ams1-edge1', minutes: 52 },
  { id: 'al-5', site: 'fra1', severity: 'warning', title: `10.10.16.0/22 is ${formatPercent(941 / 1024)} allocated`, subject: 'Storage prefix', minutes: 130 },
  { id: 'al-6', site: 'ber2', severity: 'warning', title: 'Disk 7 reports reallocated sectors', device: 'ber2-sto-01', minutes: 190 },
  { id: 'al-7', site: 'ber2', severity: 'info', title: 'Maintenance on Transit A tonight, 22:00', subject: 'Circuit', minutes: 300 }
];

/** The change log. `actor` is an id into `PEOPLE`; `minutes` is the age. */
const CHANGES = [
  { id: 'ch-1', site: 'fra1', actor: 'jonas', title: 'set fra1-cmp-13 to Failed', detail: 'Power supply 2 replacement ordered.', minutes: 12 },
  { id: 'ch-2', site: 'ams1', actor: 'piet', title: 'added ams1-cmp-08 and ams1-cmp-09 to R02 as Planned', minutes: 95 },
  { id: 'ch-3', site: 'ber2', actor: 'camille', title: 'assigned 10.20.240.0/24 to VLAN 10', minutes: 180 },
  { id: 'ch-4', site: 'fra1', actor: 'jonas', title: 'set fra1-sto-04 to Decommissioning', detail: 'Data migrated to fra1-sto-03.', minutes: 1210 },
  { id: 'ch-5', site: 'ber2', actor: 'owen', title: 'connected ber2-r02-leaf2 Ethernet49 to ber2-edge1', minutes: 1630 },
  { id: 'ch-6', site: 'ams1', actor: 'ines', title: 'upgraded circuit Transit B to 10 Gb/s', minutes: 2900 },
  { id: 'ch-7', site: 'fra1', actor: 'piet', title: 'planned fra1-cmp-04 in R02 at U22', minutes: 5100 },
  { id: 'ch-8', site: 'ber2', actor: 'jonas', title: 'set ber2-cmp-05 to Offline', minutes: 8700 }
];

/** Time ranges for the traffic chart and the change log: how many points, how many minutes apart. */
const RANGES = [
  { ID: '1h', name: 'Last hour', points: 12, step: 5, format: '%H:%M' },
  { ID: '24h', name: 'Last 24 hours', points: 24, step: 60, format: '%H:00' },
  { ID: '7d', name: 'Last 7 days', points: 56, step: 180, format: '%a %H:00' },
  { ID: '30d', name: 'Last 30 days', points: 30, step: 1440, format: '%e %b' }
];

/** The navigation tree. Branches are disclosures; leaves are destinations. */
const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', icon: 'gauge' },
  { id: 'organization', label: 'Organization', icon: 'building', children: [
    { id: 'sites', label: 'Sites' }, { id: 'locations', label: 'Locations' }, { id: 'tenants', label: 'Tenants' }] },
  { id: 'racks', label: 'Racks', icon: 'layer-group', children: [
    { id: 'rack-list', label: 'Racks' }, { id: 'elevations', label: 'Elevations' }] },
  { id: 'devices', label: 'Devices', icon: 'server', children: [
    { id: 'device-list', label: 'Devices' }, { id: 'device-types', label: 'Device types' }, { id: 'platforms', label: 'Platforms' }] },
  { id: 'connections', label: 'Connections', icon: 'ethernet', children: [
    { id: 'cables', label: 'Cables' }, { id: 'interfaces', label: 'Interfaces' }] },
  { id: 'ipam', label: 'IPAM', icon: 'sitemap', children: [
    { id: 'prefixes', label: 'Prefixes' }, { id: 'ip-addresses', label: 'IP addresses' }, { id: 'vlans', label: 'VLANs' }] },
  { id: 'virtualization', label: 'Virtualization', icon: 'cubes', children: [
    { id: 'clusters', label: 'Clusters' }, { id: 'virtual-machines', label: 'Virtual machines' }] },
  { id: 'circuits', label: 'Circuits', icon: 'route' },
  { id: 'power', label: 'Power', icon: 'plug' }
];

/** Which main view each navigation destination opens; every other one shows a placeholder. */
const VIEWS = { dashboard: 'dashboard', 'device-list': 'devices', 'rack-list': 'elevations', elevations: 'elevations' };

/**
 * @typedef {Object} Device
 * @property {string} ID The device name, which is unique.
 * @property {string} name
 * @property {string} site Site id.
 * @property {string} rack Rack id.
 * @property {number} position Lowest rack unit the device occupies.
 * @property {number} height Height in rack units.
 * @property {string} typeId Key into `DEVICE_TYPES`.
 * @property {string} type Maker and model.
 * @property {string} role
 * @property {string|null} platform
 * @property {string} status Key into `STATUSES`.
 * @property {string} ip Primary IPv4 address.
 * @property {string} serial
 * @property {string} tenant
 */

/**
 * Expands the rack plans into the device inventory that the table, the racks, and the charts share.
 * @returns {Device[]}
 */
function deviceRecords() {
  return RACKS.flatMap((rack) => {
    const site = siteOf(rack.site);
    const rackNumber = Number(rack.name.slice(1));
    return rack.devices.map(([position, name, typeId, status = 'active'], index) => {
      const type = DEVICE_TYPES[typeId];
      const hosted = type.role === 'Compute' || type.role === 'Storage';
      return {
        ID: name, name, site: rack.site, rack: rack.id, position, height: type.units, typeId,
        type: `${type.maker} ${type.model}`, role: type.role, platform: type.platform, status,
        ip: hosted ? `10.${site.octet}.${rackNumber}.${10 + position}`
          : `10.${site.octet}.240.${rackNumber * 20 + index + 1}`,
        serial: `${type.maker.slice(0, 2).toUpperCase()}${7_300_000 + site.octet * 997 + rackNumber * 4_517 + position * 131}`,
        tenant: hosted ? COMPANIES[(rackNumber + position) % COMPANIES.length].name : 'Fieldstone'
      };
    });
  });
}

/** @param {string} id @returns {(typeof SITES)[number]} */
function siteOf(id) {
  return SITES.find((site) => site.id === id) ?? SITES[0];
}

/** @param {string} id @returns {(typeof RACKS)[number]} */
function rackOf(id) {
  return RACKS.find((rack) => rack.id === id) ?? RACKS[0];
}

/** @param {string} id @returns {(typeof STATUSES)[number]} */
function statusOf(id) {
  return STATUSES.find((status) => status.ID === id) ?? STATUSES[0];
}

/**
 * The unit range a device occupies, as printed on a rack: "U30–31", or "U7" for one unit.
 * @param {{position: number, height: number}} device
 * @returns {string}
 */
function unitLabel({ position, height }) {
  return height > 1 ? `U${position}–${position + height - 1}` : `U${position}`;
}

/**
 * The units to draw around a device in a rack excerpt: three above and below, widened so that no
 * neighbour or reservation is cut in half.
 * @param {Device} device
 * @returns {{from: number, to: number}}
 */
function windowAround(device) {
  const rack = rackOf(device.rack);
  let from = Math.min(rack.units, device.position + device.height + 2);
  let to = Math.max(1, device.position - 3);
  const runs = [...rack.devices.map(([position, , typeId]) => [position, DEVICE_TYPES[typeId].units]),
    ...rack.reserved];
  for (const [position, height] of runs) {
    const top = position + height - 1;
    if (position <= from && top > from) from = top;
    if (position < to && top >= to) to = position;
  }
  return { from, to };
}

/**
 * The key to a rack drawing: each device family's fill, the hatching of reserved units, and the
 * dot that marks a device which is not active.
 * @returns {HTMLUListElement}
 */
function rackLegend() {
  const swatch = (fill) => h('span', { class: 'infra__swatch', dataset: { fill }, 'aria-hidden': 'true' });
  return h('ul', { class: 'infra__rack-legend', 'aria-label': 'Rack key' },
    Object.values(FAMILIES).map((family) => h('li', {}, swatch(family.tone), family.name)),
    h('li', {}, swatch('reserved'), 'Reserved'),
    STATUSES.filter((status) => status.ID !== 'active').map((status) => h('li', {}, dot(status.tone), status.name)));
}

/**
 * One series in the traffic legend: its name, then its latest, highest, and 95th-percentile reading.
 * @param {string} id Series id, which picks the swatch.
 * @param {string} name
 * @param {number[]} values
 * @returns {HTMLLIElement}
 */
function seriesKey(id, name, values) {
  const sorted = [...values].sort((a, b) => a - b);
  const reading = (label, value) => h('span', { class: 'infra__key-reading' }, `${label} `,
    h('strong', { class: 'num' }, formatNumber(value, { decimals: 1 })));
  return h('li', { class: 'infra__key', dataset: { series: id } },
    h('span', { class: 'infra__key-name' }, name),
    reading('Now', values.at(-1)), reading('Peak', sorted.at(-1)),
    reading('p95', sorted[Math.ceil(sorted.length * 0.95) - 1]));
}

/**
 * A chart colour at another opacity. `chartPalette()` hands out `rgba()` strings, so only the
 * alpha needs replacing.
 * @param {string} colour
 * @param {number} alpha
 * @returns {string}
 */
function fade(colour, alpha) {
  return colour.replace(/[\d.]+\)$/, `${alpha})`);
}

/**
 * Lists a device's interfaces and what each is cabled to, derived from its neighbours in the rack.
 * @param {Device} device
 * @param {Device[]} devices The whole inventory.
 * @returns {{name: string, speed: string, peer: string, state: 'up'|'down'|'disabled'}[]}
 */
function interfacesOf(device, devices) {
  const rackmates = devices.filter((other) => other.rack === device.rack);
  const named = (suffix) => rackmates.find((other) => other.name.endsWith(suffix))?.name ?? `${device.site}-core`;
  const hosts = rackmates.filter((other) => other.role === 'Compute' || other.role === 'Storage');
  const link = (status) => (status === 'active' ? 'up' : status === 'failed' ? 'down' : 'disabled');
  const port = (name, speed, peer, state = link(device.status)) => ({ name, speed, peer, state });
  const index = hosts.indexOf(device) + 1;
  const side = device.name.endsWith('1') ? 1 : 2;
  switch (device.role) {
    case 'Compute':
    case 'Storage':
      return [
        port('eno1', '25G', `${named('leaf1')} · Ethernet${index}`),
        port('eno2', '25G', `${named('leaf2')} · Ethernet${index}`),
        port('bmc', '1G', `${named('oob1')} · Gi1/0/${index}`, device.status === 'failed' ? 'up' : undefined)
      ];
    case 'Leaf switch':
      return [port('Ethernet49', '100G', `${device.site}-edge1 · et-0/0/${side}`),
        ...hosts.slice(0, 5).map((host, i) =>
          port(`Ethernet${i + 1}`, '25G', `${host.name} · eno${side}`, link(host.status)))];
    case 'Edge router':
      return [port('et-0/0/0', '10G', 'Transit A'), port('et-0/0/1', '10G', 'Transit B'),
        port('et-0/0/2', '100G', `${named('leaf1')} · Ethernet49`)];
    case 'Patch panel':
      return [];
    default:
      return [port('mgmt0', '1G', `${named('oob1')} · Gi1/0/48`)];
  }
}

/**
 * Inbound and outbound uplink traffic in Gb/s for a site (or all of them) over a time range, and
 * the transit capacity it runs against. The curve follows the working day, with a little
 * deterministic noise so every render matches.
 * @param {string} site Site id or `'all'`.
 * @param {(typeof RANGES)[number]} range
 * @returns {{labels: string[], inbound: number[], outbound: number[], capacity: number}}
 */
function trafficSeries(site, range) {
  const sites = site === 'all' ? SITES : [siteOf(site)];
  const capacity = sites.reduce((sum, entry) => sum + entry.uplink, 0);
  const series = { labels: [], inbound: [], outbound: [], capacity };
  for (let index = range.points - 1; index >= 0; index -= 1) {
    const at = new Date(NOW.getTime() - index * range.step * 60_000);
    const daily = 0.58 + 0.34 * Math.sin(((at.getHours() + at.getMinutes() / 60 - 9) / 24) * 2 * Math.PI);
    const noise = (seed) => Math.abs(Math.sin(at.getTime() / 9e5 + seed) * 43_758.5453) % 1;
    const total = sites.reduce((sum, entry) => sum + entry.peak * daily * (0.9 + 0.2 * noise(entry.octet)), 0);
    series.labels.push(formatDate(at, range.format));
    series.inbound.push(Math.round(total * 10) / 10);
    series.outbound.push(Math.round(total * (0.52 + 0.1 * noise(7)) * 10) / 10);
  }
  return series;
}

export default {
  title: 'Infrastructure',
  category: 'IT',
  blurb: 'Three data centres at a glance: device health, alerts, and traffic, down to each unit of every rack.',
  components: [
    'Chart', 'StatTile', 'TableView', 'Tooltip', 'ActivityList', 'Select', 'Search', 'MenuButton',
    'InlineLoading', 'Dialog', 'ChartJsAdapter', 'Message'
  ],

  /**
   * Mounts the infrastructure workspace: a health dashboard, the device inventory, rack
   * elevations, and a device inspector that every view opens into.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const state = {
      view: 'dashboard', site: 'all', range: '24h', rack: 'fra1-r03', device: /** @type {string|null} */ (null),
      filters: { site: '', role: '', status: '', platform: '', query: '' },
      expanded: { alerts: false, changes: false },
      devices: deviceRecords(),
      alerts: ALERTS.map((alert) => ({ ...alert })),
      /** @type {HTMLElement|null} What opened the inspector, for focus to return to. */
      opener: null
    };
    const root = h('div', { class: 'infra shell' });
    // Narrow, the navigation becomes a drawer, and the device inspector opens as one.
    const shell = adaptiveShell(root, context, { asideLabel: 'Device details' });
    const notify = toaster(context, root);

    /* ---------------------------------------------------------- navigation -- */

    const me = person(ME);
    const sidebar = keep(new AppSidebar(null, {
      items: NAVIGATION, active: 'dashboard', expanded: ['devices'], collapsible: false, label: 'Infrastructure',
      onselect: (event) => {
        event.preventDefault();
        go(String(event.detail.id));
      }
    }));
    const account = keep(new AccountMenu(null, {
      account: { name: me.name, secondary: me.role, status: me.status },
      items: [
        { label: 'Profile', value: 'profile' }, { label: 'API tokens', value: 'tokens' }, '-',
        { label: 'Sign out', value: 'sign-out' }
      ],
      placement: 'top-start',
      onselect: (event) => notify(unavailable(event.detail.item.label), 'info')
    }));
    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'shell__body' }, sidebar.toElement()),
      h('div', { class: 'shell__footer' }, account.toElement()));

    /**
     * Opens a navigation destination.
     * @param {string} id Navigation item id.
     * @returns {void}
     */
    function go(id) {
      state.view = VIEWS[id] ?? 'placeholder';
      sidebar.setActive(id);
      const branch = NAVIGATION.find((item) => item.children?.some((child) => child.id === id));
      if (branch) sidebar.setExpanded([branch.id], { silent: true });
      for (const [name, pane] of Object.entries(views)) pane.hidden = name !== state.view;
      if (state.view === 'placeholder') showPlaceholder(id);
      if (state.view === 'elevations' || state.view === 'placeholder') closeInspector();
      render();
    }

    /**
     * Re-renders the visible view.
     * @returns {void}
     */
    function render() {
      if (state.view === 'dashboard') renderDashboard();
      if (state.view === 'devices') renderDevices();
      if (state.view === 'elevations') renderElevations();
    }

    /* -------------------------------------------------------- site switcher -- */

    /** @type {HTMLElement[]} Every site switcher on the page; all of them show `state.site`. */
    const switches = [];

    /**
     * A single-choice site filter: a radio group whose arrow keys move the choice, as in the APG
     * radio group pattern.
     * @returns {HTMLElement}
     */
    function siteSwitch() {
      const choices = [{ id: 'all', label: 'All sites' }, ...SITES.map((site) => ({ id: site.id, label: site.name }))];
      const radios = h('div', {
        class: 'segmented', role: 'radiogroup', 'aria-label': 'Site',
        onkeydown: (event) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
          if (!step) return;
          event.preventDefault();
          const index = choices.findIndex((choice) => choice.id === state.site);
          setSite(choices[(index + step + choices.length) % choices.length].id);
          radios.querySelector('[aria-checked="true"]')?.focus();
        }
      }, choices.map((choice) => h('button', {
        type: 'button', role: 'radio', class: 'segmented__item', dataset: { site: choice.id },
        'aria-checked': String(choice.id === state.site), tabindex: choice.id === state.site ? 0 : -1,
        onclick: () => setSite(choice.id)
      }, choice.label)));
      switches.push(radios);
      return radios;
    }

    /**
     * Filters every widget to one site, or to all of them, and re-renders the visible view.
     * @param {string} site Site id or `'all'`.
     * @returns {void}
     */
    function setSite(site) {
      state.site = site;
      for (const radio of switches.flatMap((radios) => [...radios.children])) {
        const checked = radio.dataset.site === site;
        radio.setAttribute('aria-checked', String(checked));
        radio.tabIndex = checked ? 0 : -1;
      }
      if (site !== 'all' && rackOf(state.rack).site !== site) state.rack = RACKS.find((rack) => rack.site === site).id;
      render();
    }

    /**
     * Whether a record belongs to the selected site.
     * @param {{site: string}} record
     * @returns {boolean}
     */
    function inScope(record) {
      return state.site === 'all' || record.site === state.site;
    }

    /* ------------------------------------------------------------ dashboard -- */

    const rangeSelect = keep(new Select(null, {
      items: RANGES, value: state.range, label: 'Time range',
      onchange: (event) => {
        state.range = String(event.detail.value);
        renderDashboard();
      }
    }));
    const refreshState = keep(new InlineLoading(null, {
      status: 'inactive', size: 'sm', description: `Updated ${formatDate(NOW, DATE.time)}`
    }));
    const siteFilter = () => (state.site === 'all' ? '' : state.site);
    const tiles = {
      devices: keep(statTile({
        label: 'Devices', deltaLabel: 'this week', onclick: () => openDevices({ site: siteFilter() })
      })),
      space: keep(statTile({
        label: 'Rack space', format: (units) => `${formatNumber(units)}U`, onclick: () => go('elevations')
      })),
      addresses: keep(statTile({ label: 'IP addresses' })),
      prefixes: keep(statTile({ label: 'Prefixes' })),
      vms: keep(statTile({ label: 'Virtual machines', deltaLabel: 'this week' }))
    };
    const statusChart = keep(new Chart(null, {
      type: 'doughnut', loading: true, aspectRatio: '1 / 1', label: 'Devices by status',
      onselect: (event) => openDevices({ site: siteFilter(), status: STATUSES[event.detail.index].ID })
    }));
    // Without an aspect ratio the chart keeps its viewport's minimum height and takes any width.
    const trafficChart = keep(new Chart(null, {
      type: 'line', loading: true, aspectRatio: 'auto', label: 'Uplink traffic in gigabits per second'
    }));
    const statusTotal = h('span', { class: 'infra__donut-total num' });
    const statusLegend = h('ul', { class: 'infra__legend', 'aria-label': 'Devices by status' });
    const trafficLegend = h('ul', { class: 'infra__keys', 'aria-label': 'Uplink traffic in gigabits per second' });
    const prefixList = h('ul', { class: 'infra__meters', 'aria-label': 'Prefix utilisation' });
    const alertList = h('ul', { class: 'infra__alerts', 'aria-label': 'Open alerts' });
    const alertCount = h('span', { class: 'infra__count' });
    const alertMore = h('div', { class: 'infra__more' });
    const changes = keep(new ActivityList(null, {
      label: 'Recent changes', variant: 'compact', emptyText: 'No changes in this period.'
    }));
    const changeMore = h('div', { class: 'infra__more' });
    const rackPicker = keep(new Select(null, {
      items: [], label: 'Rack', valueKey: 'id', labelKey: (rack) => `${siteOf(rack.site).name} · ${rack.name}`,
      onchange: (event) => {
        state.rack = String(event.detail.value);
        renderRack();
      }
    }));
    const rackMeta = h('p', { class: 'meta infra__rack-meta' });
    const rackHost = h('div', { class: 'infra__rack-host' });
    const rackParts = renderScope(context);

    /**
     * A titled dashboard widget, a region named by its title unless `region` is false — for a
     * widget whose content is a named region already.
     * @param {string} area Grid area name.
     * @param {string} title
     * @param {{meta?: Node|string, actions?: Node|Node[], region?: boolean}} head
     * @param {...Node} body
     * @returns {HTMLElement}
     */
    function widget(area, title, { meta, actions, region = true } = {}, ...body) {
      return h('section', { class: 'surface infra__widget', dataset: { area }, 'aria-label': region ? title : null },
        h('header', { class: 'infra__widget-head' },
          h('h3', { class: 'surface__title' }, title),
          meta ? h('span', { class: 'surface__meta' }, meta) : null,
          actions ? h('div', { class: 'infra__widget-actions' }, actions) : null),
        ...body);
    }

    /**
     * A widget's "View all" action, named for screen readers by what it lists.
     * @param {string} what
     * @param {() => void} onclick
     * @returns {HTMLElement}
     */
    function viewAll(what, onclick) {
      const action = button({ label: 'View all', size: 'sm', kind: 'ghost', onclick });
      action.setAttribute('aria-label', `View all ${what}`);
      return action;
    }

    const dashboard = h('section', { class: 'shell__main', 'aria-label': 'Dashboard' },
      paneHeader({
        title: 'Dashboard', size: 'page', className: 'infra__header', leading: shell.navToggle(),
        actions: [refreshState.toElement(), siteSwitch(), h('div', { class: 'infra__range' }, rangeSelect.toElement()),
          iconButton('arrows-rotate', 'Refresh', refresh, { shortcut: { label: 'R', keys: 'R' } }), shell.asideToggle()]
      }),
      h('div', { class: 'shell__body shell__body--padded infra__dashboard' },
        h('div', { class: 'infra__grid' },
          h('div', { class: 'infra__tiles', dataset: { area: 'tiles' } },
            Object.values(tiles).map((tile) => tile.toElement())),
          widget('traffic', 'Uplink traffic', {}, trafficLegend, trafficChart.toElement()),
          widget('status', 'Device status',
            { actions: viewAll('devices', () => openDevices({ site: siteFilter() })) },
            h('div', { class: 'infra__donut-layout' },
              h('div', { class: 'infra__donut' }, statusChart.toElement(),
                h('div', { class: 'infra__donut-label', 'aria-hidden': 'true' },
                  statusTotal, h('span', { class: 'meta' }, 'devices'))),
              statusLegend)),
          widget('alerts', 'Open alerts', { meta: alertCount }, alertList, alertMore),
          widget('prefixes', 'Prefix utilisation',
            { meta: 'Most allocated first', actions: viewAll('prefixes', () => go('prefixes')) }, prefixList),
          widget('changes', 'Recent changes', { region: false }, changes.toElement(), changeMore),
          widget('rack', 'Rack', { actions: h('div', { class: 'infra__rack-picker' }, rackPicker.toElement()) },
            rackMeta, rackHost, rackLegend()))));

    loadChartJs().then((engine) => {
      if (context.signal.aborted) return;
      const adapter = new ChartJsAdapter(engine);
      for (const chart of [statusChart, trafficChart]) chart.setAdapter(adapter).setLoading(false);
      renderCharts(false);
    }).catch((error) => {
      if (!context.signal.aborted) for (const chart of [statusChart, trafficChart]) chart.setError(error);
    });

    /**
     * Re-renders every dashboard widget for the selected site and time range.
     * @returns {void}
     */
    function renderDashboard() {
      const sites = state.site === 'all' ? SITES : [siteOf(state.site)];
      const racks = RACKS.filter(inScope);
      const devices = state.devices.filter(inScope);
      const prefixes = PREFIXES.filter(inScope);
      const sum = (list, key) => list.reduce((total, entry) => total + entry[key], 0);
      const mounted = sum(devices, 'height');
      const [used, size] = [sum(prefixes, 'used'), sum(prefixes, 'size')];
      const hosts = devices.filter((device) => device.role === 'Compute' && device.status === 'active');
      const full = prefixes.filter((prefix) => prefix.used / prefix.size >= 0.9);
      tiles.devices.update({
        value: devices.length, caption: `in ${formatNumber(racks.length)} racks`, delta: sum(sites, 'added')
      });
      tiles.space.update({ value: mounted, caption: `of ${formatNumber(sum(racks, 'units'))}U` });
      tiles.addresses.update({ value: used, caption: `of ${formatNumber(size)}` });
      tiles.prefixes.update({ value: prefixes.length, caption: `${formatNumber(full.length)} over 90% full` });
      tiles.vms.update({
        value: sum(sites, 'vms'), caption: `on ${formatNumber(hosts.length)} hosts`, delta: sum(sites, 'vmDelta')
      });

      const counts = STATUSES.map((status) => devices.filter((device) => device.status === status.ID).length);
      statusTotal.textContent = formatNumber(devices.length);
      statusLegend.replaceChildren(...STATUSES.map((status, index) => h('li', {}, h('button', {
        type: 'button', class: 'infra__legend-item', disabled: counts[index] === 0,
        'aria-label': `${status.name}: ${formatNumber(counts[index])} devices. Show them.`,
        onclick: () => openDevices({ site: siteFilter(), status: status.ID })
      }, dot(status.tone), h('span', { class: 'infra__legend-name' }, status.name),
      h('span', { class: 'num' }, formatNumber(counts[index])),
      h('span', { class: 'meta num' }, formatPercent(devices.length ? counts[index] / devices.length : 0))))));
      prefixList.replaceChildren(...prefixes.sort((a, b) => b.used / b.size - a.used / a.size).slice(0, 8)
        .map(prefixRow));

      renderAlerts();
      const range = RANGES.find((entry) => entry.ID === state.range);
      const recent = CHANGES.filter((change) => inScope(change) && change.minutes <= range.points * range.step);
      changes.setItems(limited('changes', recent, 3, changeMore).map((change) => {
        const actor = person(change.actor);
        const at = new Date(NOW.getTime() - change.minutes * 60_000);
        return {
          id: change.id, actor: actor.name, avatar: { name: actor.name }, title: change.title,
          metadata: [siteOf(change.site).name, change.detail].filter(Boolean),
          timestamp: at, timeLabel: listTime(at)
        };
      }));

      rackPicker.setItems(racks);
      rackPicker.set(state.rack, { silent: true });
      renderRack();
      renderCharts(true);
    }

    /**
     * One prefix: its address and role, a meter coloured by threshold, and the share as text.
     * @param {(typeof PREFIXES)[number]} prefix
     * @returns {HTMLElement}
     */
    function prefixRow(prefix) {
      const share = prefix.used / prefix.size;
      const tone = share >= 0.9 ? 'danger' : share >= 0.75 ? 'warning' : 'success';
      const detail = `${siteOf(prefix.site).name} · ${prefix.role}`;
      return h('li', { class: 'infra__meter-row' },
        h('span', { class: 'infra__meter-name' },
          h('span', { class: 'mono' }, prefix.prefix), h('span', { class: 'meta' }, detail)),
        h('span', {
          class: 'infra__meter', role: 'meter', dataset: { tone }, style: { '--infra-share': share },
          'aria-label': prefix.prefix, 'aria-valuemin': 0, 'aria-valuemax': prefix.size,
          'aria-valuenow': prefix.used, 'aria-valuetext': `${formatPercent(share)}, ${detail}`
        }, h('span', { class: 'infra__meter-fill' })),
        h('span', { class: 'infra__meter-share num' }, formatPercent(share)));
    }

    /**
     * Shows the first few entries of a widget's list, with a toggle for the rest.
     * @template T
     * @param {'alerts'|'changes'} key Which widget, for its expanded state.
     * @param {T[]} entries
     * @param {number} limit
     * @param {HTMLElement} footer Where the toggle goes.
     * @returns {T[]} The entries to render.
     */
    function limited(key, entries, limit, footer) {
      const hidden = entries.length - limit;
      footer.replaceChildren(hidden < 2 ? '' : button({
        label: state.expanded[key] ? 'Show fewer' : `Show ${formatNumber(hidden)} more`,
        icon: state.expanded[key] ? 'chevron-up' : 'chevron-down', size: 'sm', kind: 'ghost',
        onclick: () => {
          state.expanded[key] = !state.expanded[key];
          renderDashboard();
        }
      }));
      return hidden < 2 || state.expanded[key] ? entries : entries.slice(0, limit);
    }

    /**
     * Re-renders the open alerts for the selected site, most severe first.
     * @returns {void}
     */
    function renderAlerts() {
      const alerts = state.alerts.filter(inScope)
        .sort((a, b) => SEVERITIES[a.severity].rank - SEVERITIES[b.severity].rank || a.minutes - b.minutes);
      const critical = alerts.filter((alert) => alert.severity === 'critical').length;
      alertCount.replaceChildren(
        critical ? badge({ label: `${formatNumber(critical)} critical`, kind: 'danger', size: 'sm' }) : '',
        h('span', { class: 'meta' }, `${formatNumber(alerts.length)} open`));
      alertList.replaceChildren(...(alerts.length ? limited('alerts', alerts, 5, alertMore).map(alertRow)
        : [h('li', {}, emptyState({ icon: 'circle-check', title: 'No open alerts', size: 'sm' }))]));
    }

    /**
     * One alert: its severity, what is affected, its age, and an acknowledge action.
     * @param {(typeof ALERTS)[number]} alert
     * @returns {HTMLElement}
     */
    function alertRow(alert) {
      const severity = SEVERITIES[alert.severity];
      const device = state.devices.find((entry) => entry.ID === alert.device);
      const age = formatRelativeTime(new Date(NOW.getTime() - alert.minutes * 60_000), { now: NOW });
      return h('li', { class: 'infra__alert' },
        h('span', { class: 'infra__alert-icon', dataset: { tone: severity.tone } }, icon(severity.icon)),
        h('span', { class: 'infra__alert-body' },
          h('span', { class: 'infra__alert-title' },
            h('span', { class: 'visually-hidden' }, `${severity.label}: `), alert.title),
          h('span', { class: 'meta' }, device
            ? h('button', { type: 'button', class: 'link-button', onclick: () => openDevice(device.ID) }, device.name)
            : alert.subject, ` · ${siteOf(alert.site).name} · ${age}`)),
        iconButton('check', `Acknowledge “${alert.title}”`, () => {
          state.alerts = state.alerts.filter((entry) => entry !== alert);
          renderAlerts();
          notify(`Acknowledged: ${alert.title}.`);
        }));
    }

    /**
     * Draws both charts in the current theme. Colours are read from the semantic tokens on every
     * call, so a theme switch only needs to call this again.
     * @param {boolean} animate Whether the change may animate.
     * @returns {void}
     */
    function renderCharts(animate) {
      if (statusChart.el.dataset.state === 'loading' || !root.isConnected) return;
      const palette = chartPalette(root);
      const base = chartOptions(palette, animate && allowsMotion(context));
      const devices = state.devices.filter(inScope);
      statusChart.update({ ...base, cutout: '78%' });
      statusChart.setData({
        labels: STATUSES.map((status) => status.name),
        datasets: [{
          label: 'Devices',
          data: STATUSES.map((status) => devices.filter((device) => device.status === status.ID).length),
          // A neutral status is drawn in the muted text colour, like its dot in the legend.
          backgroundColor: STATUSES.map((status) => (status.tone === 'neutral' ? palette.muted : palette[status.tone])),
          borderColor: palette.surface, borderWidth: 2, hoverOffset: 4
        }]
      });

      const series = trafficSeries(state.site, RANGES.find((entry) => entry.ID === state.range));
      const [inbound, outbound] = palette.series;
      const { x, y } = chartScales(palette, { unit: 'Gb/s' });
      trafficChart.update({
        ...base,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ...x, ticks: { ...x.ticks, maxRotation: 0, autoSkipPadding: 24 } },
          y: { ...y, beginAtZero: true, ticks: { ...y.ticks, maxTicksLimit: 5 } }
        }
      });
      trafficChart.setData({
        labels: series.labels,
        datasets: [
          { label: 'Inbound', data: series.inbound, fill: 'origin', borderColor: inbound, backgroundColor: fade(inbound, 0.08) },
          { label: 'Outbound', data: series.outbound, fill: false, borderColor: outbound, backgroundColor: outbound },
          {
            label: 'Capacity', data: series.labels.map(() => series.capacity), fill: false,
            borderColor: palette.muted, borderWidth: 1, borderDash: [4, 4], pointHoverRadius: 0
          }
        ]
      });
      trafficLegend.replaceChildren(
        seriesKey('inbound', 'Inbound', series.inbound),
        seriesKey('outbound', 'Outbound', series.outbound),
        h('li', { class: 'infra__key', dataset: { series: 'capacity' } },
          h('span', { class: 'infra__key-name' }, 'Capacity'),
          h('strong', { class: 'num' }, formatNumber(series.capacity))));
    }

    watchTheme(context, () => renderCharts(false));

    /**
     * Fetches fresh figures: the tiles show their loading state, then the new numbers.
     * @returns {void}
     */
    function refresh() {
      if (context.preview) return;
      refreshState.set('active', 'Refreshing…');
      for (const tile of Object.values(tiles)) tile.update({ loading: true });
      later(context, () => {
        for (const tile of Object.values(tiles)) tile.update({ loading: false });
        renderDashboard();
        refreshState.set('success', 'Updated just now');
      }, 600);
    }

    /* ---------------------------------------------------------------- racks -- */

    /**
     * Draws a rack's front elevation: numbered units, the devices that occupy them, the runs held
     * for planned work, and the empty slots between. Each device is a button filled in its
     * family's tone and named with its position and status; a dot marks any status but active, a
     * tooltip repeats the details on hover or focus, the arrow keys move between devices, and
     * Enter opens one.
     * @param {(typeof RACKS)[number]} rack
     * @param {{from?: number, to?: number, parts: ReturnType<typeof renderScope>}} options `from` and
     *   `to` limit the drawing to a window of units; `parts` collects its tooltips.
     * @returns {HTMLElement}
     */
    function rackElevation(rack, { from = rack.units, to = 1, parts }) {
      const row = (unit) => from - unit + 1;
      const within = (position, height) => position <= from && position + height - 1 >= to;
      const mounted = state.devices.filter((device) => device.rack === rack.id && within(device.position, device.height));
      const reserved = rack.reserved.filter(([position, height]) => within(position, height));
      const runs = [...mounted.map((device) => [device.position, device.height]), ...reserved];
      const taken = new Set(runs.flatMap(([position, height]) => Array.from({ length: height }, (_, i) => position + i)));
      /** Places a list item over the units from `top` down to `bottom`, clipped to the window. */
      const place = (top, bottom, attributes, ...children) => {
        const first = Math.min(from, top);
        return { row: row(first), node: h('li', {
          ...attributes, style: { '--row': row(first), '--span': first - Math.max(to, bottom) + 1 }
        }, ...children) };
      };
      const items = [];
      let top = null;
      for (let unit = from; unit >= to - 1; unit -= 1) {
        if (unit >= to && !taken.has(unit)) {
          top ??= unit;
        } else if (top !== null) {
          const size = top - unit;
          items.push(place(top, unit + 1, { class: 'infra__rack-free' },
            h('span', { class: 'visually-hidden' }, `${unitLabel({ position: unit + 1, height: size })} free`),
            Array.from({ length: size }, () => h('span', { class: 'infra__rack-unit', 'aria-hidden': 'true' }))));
          top = null;
        }
      }
      for (const [position, height, reason] of reserved) {
        items.push(place(position + height - 1, position, { class: 'infra__rack-reserved' },
          h('span', { class: 'infra__rack-reason' },
            h('span', { class: 'visually-hidden' }, `${unitLabel({ position, height })} `), `Reserved · ${reason}`)));
      }
      for (const device of mounted) {
        const status = statusOf(device.status);
        const type = DEVICE_TYPES[device.typeId];
        const block = h('button', {
          type: 'button', class: 'infra__device', dataset: { device: device.ID, fill: FAMILIES[type.family].tone },
          'aria-current': device.ID === state.device ? 'true' : null,
          'aria-label': `${device.name}, ${device.type}, ${unitLabel(device)}, ${status.name}`,
          onclick: () => openDevice(device.ID)
        },
        h('span', { class: 'infra__device-name' }, device.name),
        h('span', { class: 'infra__device-type' }, type.model),
        device.status === 'active' ? null : dot(status.tone));
        parts.own(new Tooltip(block, {
          placement: 'left', delay: 250, content: () => h('div', { class: 'infra__tip' },
            h('strong', {}, device.name), h('span', {}, `${device.type} · ${device.role}`),
            h('span', {}, `${unitLabel(device)} · ${status.name}`), h('span', { class: 'mono' }, device.ip))
        }));
        items.push(place(device.position + device.height - 1, device.position, { class: 'infra__rack-slot' }, block));
      }
      const bay = h('ul', { class: 'infra__rack-bay', 'aria-label': `Devices in ${rack.name}, top to bottom` },
        items.sort((a, b) => a.row - b.row).map((item) => item.node));
      parts.own(rovingTabindex(bay, '.infra__device'));
      return h('figure', { class: 'infra__rack', style: { '--units': from - to + 1 } },
        h('div', { class: 'infra__rack-numbers', 'aria-hidden': 'true' },
          Array.from({ length: from - to + 1 }, (_, index) => h('span', {}, String(from - index)))),
        bay);
    }

    /**
     * The units mounted in a rack.
     * @param {(typeof RACKS)[number]} rack
     * @returns {number}
     */
    function usedUnits(rack) {
      return state.devices.filter((device) => device.rack === rack.id)
        .reduce((total, device) => total + device.height, 0);
    }

    /**
     * The units neither mounted nor reserved in a rack.
     * @param {(typeof RACKS)[number]} rack
     * @returns {number}
     */
    function freeUnits(rack) {
      return rack.units - usedUnits(rack) - rack.reserved.reduce((total, [, height]) => total + height, 0);
    }

    /**
     * Re-renders the dashboard's rack widget.
     * @returns {void}
     */
    function renderRack() {
      const rack = rackOf(state.rack);
      rackMeta.textContent = `${siteOf(rack.site).city}, ${rack.location} · ${formatNumber(freeUnits(rack))}U free`;
      rackParts.reset();
      rackHost.replaceChildren(rackElevation(rack, { parts: rackParts }));
    }

    /* ----------------------------------------------------------- elevations -- */

    const elevationParts = renderScope(context);
    const elevationRow = h('div', { class: 'infra__elevations' });
    const elevationSummary = h('span', { class: 'meta', role: 'status' });
    const elevations = h('section', { class: 'shell__main', 'aria-label': 'Rack elevations', hidden: true },
      paneHeader({
        title: 'Rack elevations', size: 'page', className: 'infra__header', leading: shell.navToggle(), actions: [siteSwitch()]
      }),
      h('div', { class: 'shell__toolbar' }, rackLegend(), h('span', { class: 'shell__spacer' }), elevationSummary),
      h('div', { class: 'shell__body shell__body--padded' }, elevationRow));

    /**
     * Draws every rack of the selected site side by side.
     * @returns {void}
     */
    function renderElevations() {
      const racks = RACKS.filter(inScope);
      const used = racks.reduce((total, rack) => total + usedUnits(rack), 0);
      const units = racks.reduce((total, rack) => total + rack.units, 0);
      elevationSummary.textContent = `${formatNumber(racks.length)} racks · ${formatNumber(used)} of ${formatNumber(units)}U mounted`;
      elevationParts.reset();
      elevationRow.replaceChildren(...racks.map((rack) => h('section', {
        class: 'surface infra__elevation', 'aria-label': `${siteOf(rack.site).name} ${rack.name}`
      },
      h('header', { class: 'infra__widget-head' },
        h('h3', { class: 'surface__title' }, `${siteOf(rack.site).name} · ${rack.name}`),
        h('span', { class: 'surface__meta' }, rack.location),
        h('span', { class: 'infra__widget-actions surface__meta num' }, `${formatNumber(freeUnits(rack))}U free`)),
      rackElevation(rack, { parts: elevationParts }))));
    }

    /* -------------------------------------------------------------- devices -- */

    const choices = (key) => [...new Set(state.devices.map((device) => device[key]).filter(Boolean))].sort()
      .map((value) => ({ ID: value, name: value }));
    const filterSelects = {
      site: keep(new Select(null, {
        items: SITES.map((site) => ({ ID: site.id, name: site.name })), placeholder: 'Site', label: 'Site', clearable: true
      })),
      role: keep(new Select(null, { items: choices('role'), placeholder: 'Role', label: 'Role', clearable: true })),
      status: keep(Select.status(null, { items: STATUSES, placeholder: 'Status', label: 'Status', clearable: true })),
      platform: keep(new Select(null, {
        items: choices('platform'), placeholder: 'Platform', label: 'Platform', clearable: true
      }))
    };
    for (const [key, select] of Object.entries(filterSelects)) {
      select.on('change', (event) => {
        state.filters[key] = event.detail.value == null ? '' : String(event.detail.value);
        renderDevices();
      });
    }
    const search = keep(new Search(null, {
      placeholder: 'Name, IP, or serial',
      oninput: (event) => {
        state.filters.query = event.detail.value;
        renderDevices();
      },
      onclear: () => {
        state.filters.query = '';
        renderDevices();
      }
    }));
    const deviceCount = h('span', { class: 'meta num', role: 'status' });
    const columnsHost = h('div', { class: 'infra__columns' });
    const toolbar = h('div', { class: 'shell__toolbar infra__filters', role: 'group', 'aria-label': 'Filter devices' },
      h('div', { class: 'infra__search' }, search.toElement()),
      Object.values(filterSelects).map((select) => h('div', { class: 'infra__filter' }, select.toElement())),
      h('span', { class: 'shell__spacer' }), deviceCount);
    const table = keep(new TableView(null, {
      recordId: 'ID', selectable: 'single', sort: { id: 'name', dir: 'asc' },
      hiddenFields: ['platform', 'serial', 'tenant'],
      fieldControls: { label: 'Columns', target: columnsHost },
      emptyText: () => emptyState({
        icon: 'filter', title: 'No devices match', description: 'Clear a filter to see more.', size: 'sm'
      }),
      fields: [
        { id: 'name', label: 'Name', sortable: true, view: { table: { width: '1.4fr', popin: false } },
          render: (device) => h('span', { class: 'infra__cell-name' },
            icon(DEVICE_TYPES[device.typeId].icon, { size: 14 }), h('span', {}, device.name)) },
        { id: 'status', label: 'Status', sortable: true, view: { table: { width: '1.1fr' } },
          sortValue: (device) => STATUSES.indexOf(statusOf(device.status)),
          render: (device) => statusBadge(device.status) },
        { id: 'site', label: 'Site', sortable: true, view: { table: { width: '0.6fr' } },
          get: (device) => siteOf(device.site).name },
        { id: 'rack', label: 'Rack', sortable: true, view: { table: { width: '1.1fr' } },
          get: (device) => `${rackOf(device.rack).name} · ${unitLabel(device)}`,
          sortValue: (device) => `${device.rack}-${String(99 - device.position).padStart(2, '0')}` },
        { id: 'role', label: 'Role', sortable: true, view: { table: { width: '1fr' } } },
        { id: 'type', label: 'Type', sortable: true, view: { table: { width: '1fr' } } },
        { id: 'platform', label: 'Platform', sortable: true, view: { table: { width: '1fr' } },
          render: (device) => device.platform ?? '—' },
        { id: 'ip', label: 'Primary IP', view: { table: { width: '1.1fr' } },
          render: (device) => h('span', { class: 'mono' }, device.ip) },
        { id: 'serial', label: 'Serial', view: { table: { width: '1fr' } } },
        { id: 'tenant', label: 'Tenant', sortable: true, view: { table: { width: '1.2fr' } } }
      ],
      table: { stickyHeader: true, zebra: false, responsive: 'sm' },
      onrecordclick: (event) => openDevice(String(event.detail.id))
    }));
    // On a phone the export keeps only its icon; its name stays the words.
    const exportButton = button({ label: 'Export CSV', icon: 'download', onclick: exportDevices });
    exportButton.dataset.narrow = 'icon';
    const devicesView = h('section', { class: 'shell__main', 'aria-label': 'Devices', hidden: true },
      paneHeader({
        title: 'Devices', size: 'page', leading: shell.navToggle(),
        actions: [columnsHost, exportButton, shell.asideToggle()]
      }),
      toolbar,
      h('div', { class: 'shell__body infra__table' }, table.toElement()));

    /**
     * A status badge in the device's semantic tone.
     * @param {string} id Status id.
     * @returns {HTMLElement}
     */
    function statusBadge(id) {
      const status = statusOf(id);
      return badge({ label: status.name, kind: status.tone, dot: true });
    }

    /**
     * The devices that pass the current filters, in the table's sort order.
     * @returns {Device[]}
     */
    function visibleDevices() {
      const { site, role, status, platform, query } = state.filters;
      const needle = query.trim().toLowerCase();
      const rows = state.devices.filter((device) => (!site || device.site === site) && (!role || device.role === role)
        && (!status || device.status === status) && (!platform || device.platform === platform)
        && (!needle || `${device.name} ${device.ip} ${device.serial}`.toLowerCase().includes(needle)));
      const sort = table.getSort();
      const field = table.getFields().find((entry) => entry.id === sort?.id);
      if (!field) return rows;
      const value = (device) => String(field.sortValue?.(device) ?? field.get?.(device) ?? device[field.id] ?? '');
      const direction = sort.dir === 'desc' ? -1 : 1;
      return rows.sort((a, b) => direction * value(a).localeCompare(value(b), undefined, { numeric: true }));
    }

    /**
     * Refills the device table from the filters.
     * @returns {void}
     */
    function renderDevices() {
      const rows = visibleDevices();
      table.setData(rows);
      table.setSelection(rows.some((row) => row.ID === state.device) ? [state.device] : [], { silent: true });
      const filtered = Object.values(state.filters).some(Boolean);
      deviceCount.textContent = filtered
        ? `${formatNumber(rows.length)} of ${formatNumber(state.devices.length)} devices`
        : `${formatNumber(rows.length)} devices`;
    }

    /**
     * Opens the device inventory with the given filters, replacing the current ones.
     * @param {Partial<typeof state.filters>} filters
     * @returns {void}
     */
    function openDevices(filters) {
      state.filters = { site: '', role: '', status: '', platform: '', query: '', ...filters };
      for (const [key, select] of Object.entries(filterSelects)) {
        select.set(state.filters[key] || null, { silent: true });
      }
      search.set(state.filters.query, { silent: true });
      go('device-list');
    }

    /**
     * Saves the filtered devices as a CSV file.
     * @returns {void}
     */
    function exportDevices() {
      const columns = ['name', 'status', 'site', 'rack', 'position', 'role', 'type', 'platform', 'ip', 'serial',
        'tenant'];
      downloadBlob('devices.csv', toCsv(visibleDevices(), columns), { type: 'text/csv;charset=utf-8' });
    }

    /* ------------------------------------------------------------ inspector -- */

    const inspectorParts = renderScope(context);
    const excerptParts = renderScope(context);
    const inspectorMenu = keep(new MenuButton(iconButton('ellipsis', 'More actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'Show in its rack', value: 'rack', icon: 'layer-group' },
        '-',
        { label: 'Delete device', value: 'delete', icon: 'trash', danger: true }
      ],
      onselect: (event) => deviceAction(String(event.detail.value))
    }));
    const inspectorBody = h('div', { class: 'shell__body' });
    const inspector = h('aside', {
      class: 'shell__aside shell__aside--wide', 'aria-label': 'Device details', hidden: true
    },
    paneHeader({
      title: 'Device',
      actions: [
        inspectorMenu.toElement(),
        iconButton('xmark', 'Close details', closeInspector, { shortcut: { label: 'Esc', keys: 'Escape' } })
      ]
    }),
    inspectorBody);
    let interfaceBlock = panelBlock('Interfaces');
    let excerptBlock = panelBlock('Rack position');

    /**
     * Opens a device in the inspector and marks it wherever it is shown. Where the inspector has
     * no column of its own (below 1180px) it opens as a drawer, and the header's details button
     * brings it back once closed.
     * @param {string} id Device id.
     * @returns {void}
     */
    function openDevice(id) {
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && inspector.contains(active);
      if (active instanceof HTMLElement && !inside) state.opener = active;
      state.device = id;
      inspector.hidden = false;
      renderInspector();
      if (state.view === 'devices') table.setSelection([id], { silent: true });
      markCurrent();
      // J and K step on from inside the inspector: focus moves to the new device in its rack drawing.
      if (inside && !inspector.contains(document.activeElement)) {
        inspector.querySelector('.infra__device[aria-current="true"]')?.focus({ preventScroll: true });
      }
      if (root.clientWidth <= SHELL_BREAKPOINTS.aside) shell.toggleAside(true);
    }

    /**
     * Closes the inspector, and its drawer first if it is one. Focus inside it goes back to what
     * opened it.
     * @returns {void}
     */
    function closeInspector() {
      shell.toggleAside(false);
      const returning = inspector.contains(document.activeElement);
      state.device = null;
      inspector.hidden = true;
      if (returning) {
        // What opened it, or else the open view's title, so focus never falls back to the page.
        let target = state.opener?.isConnected && state.opener.checkVisibility() ? state.opener : null;
        if (!target) {
          target = root.querySelector('.shell__main:not([hidden]) .shell__title');
          if (target instanceof HTMLElement) target.tabIndex = -1;
        }
        target?.focus({ preventScroll: true });
      }
      state.opener = null;
      inspectorParts.reset();
      excerptParts.reset();
      table.clearSelection({ silent: true });
      markCurrent();
    }

    /**
     * Marks the open device in every rack on screen without redrawing it, so focus stays put.
     * @returns {void}
     */
    function markCurrent() {
      for (const block of root.querySelectorAll('.shell__main .infra__device')) {
        if (block.dataset.device === state.device) block.setAttribute('aria-current', 'true');
        else block.removeAttribute('aria-current');
      }
    }

    /**
     * Fills the inspector with the open device: identity, editable status, properties, cabling, and
     * where it sits in its rack.
     * @returns {void}
     */
    function renderInspector() {
      const device = state.devices.find((entry) => entry.ID === state.device);
      if (!device) return;
      const rack = rackOf(device.rack);
      const site = siteOf(device.site);
      const type = DEVICE_TYPES[device.typeId];
      inspectorParts.reset();
      const status = inspectorParts.own(Select.status(null, {
        items: STATUSES, value: device.status, label: 'Status',
        onchange: (event) => setStatus(device, String(event.detail.value))
      }));
      inspectorBody.replaceChildren(
        h('div', { class: 'panel-block infra__identity' },
          iconTile(type.icon, FAMILIES[type.family].tone, { size: 'lg' }),
          h('div', {},
            h('h2', { class: 'record-title record-title--sm' }, device.name),
            h('p', { class: 'meta' }, `${device.type} · ${device.role}`))),
        panelBlock('Properties',
          propList([
            ['Status', status.toElement()],
            ['Site', `${site.name} · ${site.city}`],
            ['Rack', `${rack.name} · ${rack.location}`],
            ['Position', `${unitLabel(device)} · front`],
            ['Platform', device.platform],
            ['Primary IPv4', h('span', { class: 'infra__copyable' }, h('span', { class: 'mono' }, device.ip),
              copyButton({ text: device.ip, title: 'Copy address', size: 'sm' }))],
            ['Serial', h('span', { class: 'mono' }, device.serial)],
            ['Tenant', device.tenant]
          ])),
        interfaceBlock, excerptBlock);
      renderLinks(device);
    }

    /**
     * Re-renders the parts of the inspector that follow the device's status: the link states and
     * the rack excerpt. Both blocks are replaced in place.
     * @param {Device} device
     * @returns {void}
     */
    function renderLinks(device) {
      const interfaces = interfacesOf(device, state.devices);
      const ports = interfaces.length ? h('ul', { class: 'infra__interfaces' }, interfaces.map((port) => h('li', {},
        dot(port.state === 'up' ? 'success' : port.state === 'down' ? 'danger' : 'neutral'),
        h('span', { class: 'mono' }, port.name, h('span', { class: 'visually-hidden' }, `, ${port.state}`)),
        h('span', { class: 'infra__peer' }, port.peer),
        h('span', { class: 'meta num' }, port.speed))))
        : h('p', { class: 'meta' }, 'Passive device: its front ports pass straight through to the rear.');
      excerptParts.reset();
      const next = [
        panelBlock(`Interfaces · ${formatNumber(interfaces.length)}`, ports),
        panelBlock(`Rack position · ${rackOf(device.rack).name}`,
          rackElevation(rackOf(device.rack), { ...windowAround(device), parts: excerptParts }))
      ];
      interfaceBlock.replaceWith(next[0]);
      excerptBlock.replaceWith(next[1]);
      [interfaceBlock, excerptBlock] = next;
    }

    /**
     * Changes a device's status and re-renders everything that shows it. The inspector's own status
     * input stays in place, so focus does not move.
     * @param {Device} device
     * @param {string} status
     * @returns {void}
     */
    function setStatus(device, status) {
      device.status = status;
      render();
      renderLinks(device);
      notify(`${device.name} is now ${statusOf(status).name.toLowerCase()}.`);
    }

    /**
     * Runs an action from the inspector's overflow menu.
     * @param {string} action
     * @returns {Promise<void>}
     */
    async function deviceAction(action) {
      const device = state.devices.find((entry) => entry.ID === state.device);
      if (!device) return;
      if (action === 'rack') {
        state.rack = device.rack;
        if (!inScope(device)) setSite(device.site);
        shell.toggleAside(false);
        go('dashboard');
        if (!context.preview) {
          [...dashboard.querySelectorAll('.infra__device')].find((block) => block.dataset.device === device.ID)?.focus();
        }
        return;
      }
      const confirmed = await Dialog.confirm({
        title: `Delete ${device.name}?`,
        message: `It is removed from ${rackOf(device.rack).name}, its cables are disconnected, `
          + 'and its addresses are released.',
        okLabel: 'Delete device', danger: true
      });
      if (!confirmed || context.signal.aborted) return;
      state.devices = state.devices.filter((entry) => entry !== device);
      state.alerts = state.alerts.filter((alert) => alert.device !== device.ID);
      render();
      closeInspector();
      notify(`${device.name} deleted.`);
    }

    /* ---------------------------------------------------------- placeholder -- */

    const placeholder = h('section', { class: 'shell__main', hidden: true });

    /**
     * Shows a destination that is not built in this example, with the way back to the dashboard.
     * @param {string} id Navigation item id.
     * @returns {void}
     */
    function showPlaceholder(id) {
      const branch = NAVIGATION.find((entry) => entry.id === id || entry.children?.some((child) => child.id === id));
      const item = branch.id === id ? branch : branch.children.find((child) => child.id === id);
      placeholder.setAttribute('aria-label', item.label);
      placeholder.replaceChildren(paneHeader({ title: item.label, size: 'page', leading: shell.navToggle() }),
        h('div', { class: 'shell__body shell__body--padded' },
          unavailablePane(item.label, { label: 'Back to dashboard', onclick: () => go('dashboard') })));
    }

    /* ------------------------------------------------------------- assembly -- */

    const views = { dashboard, devices: devicesView, elevations, placeholder };
    root.append(nav, dashboard, devicesView, elevations, placeholder, inspector);
    container.append(root);
    renderDashboard();

    /**
     * Opens the next or previous device of the filtered table.
     * @param {number} step `1` for the next row, `-1` for the previous one.
     * @returns {void}
     */
    function stepDevice(step) {
      if (state.view !== 'devices') return;
      const rows = visibleDevices();
      const index = rows.findIndex((row) => row.ID === state.device);
      const next = rows[Math.max(0, Math.min(rows.length - 1, index + step))];
      if (next) openDevice(next.ID);
    }

    /**
     * The site before or after the selected one, wrapping around "All sites".
     * @param {number} step
     * @returns {string}
     */
    function cycleSite(step) {
      const ids = ['all', ...SITES.map((site) => site.id)];
      return ids[(ids.indexOf(state.site) + step + ids.length) % ids.length];
    }

    shortcuts(root, {
      '[': () => setSite(cycleSite(-1)),
      ']': () => setSite(cycleSite(1)),
      r: refresh,
      j: () => stepDevice(1),
      k: () => stepDevice(-1),
      '/': () => {
        if (state.view !== 'devices') go('device-list');
        search.focus();
      },
      Escape: () => {
        if (!state.device) return false;
        closeInspector();
        return undefined;
      }
    }, context);
  }
};
