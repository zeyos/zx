import { Form, Message, Select } from '../index.js';
import { overlayScope } from '../core/overlay-host.js';
import { connect, errorMessage } from './connect.js';
import {
  calendarDayToUnixSeconds, dateToUnixSeconds, unixSecondsToCalendarDay, unixSecondsToDate
} from './query.js';
import { fieldToZxField, resolveFields } from './schema.js';
import { buildZeyosSelectConfig } from './select.js';

/**
 * @typedef {Object} ZeyosFormOptions
 * @property {string[]} [fields] Curated ordered field allow-list.
 * @property {string[]} [exclude] Field ids to omit.
 * @property {Record<string, string>} [labels] Per-field label overrides.
 * @property {Record<string, string>} [formats] Per-field semantic format overrides, such as
 * `{ duedate: 'date' }` for a Unix-second field that holds a calendar day.
 * @property {string} [timeZone] IANA time zone of the ZeyOS instance. A date-only field's stored
 * midnight is read as the calendar day it names in this zone, and a picked day is saved as midnight
 * in it; defaults to the runtime's own zone.
 * @property {string} [title=''] Fieldset legend.
 * @property {1|2|3} [columns=2] Fieldset column count.
 * @property {Record<string, unknown>} [value] Initial record using ZeyOS storage values.
 * @property {unknown} [id] Initial record id to load.
 * @property {(record: Record<string, unknown>) => unknown|Promise<unknown>} [onSaved] Success callback.
 * @property {Element|string|null} [scope=null] Element or selector whose theme scope shows the
 * binding's toasts — the save confirmation and the report of a failed request. Null uses the form's
 * own element, so a form inside a scoped shell or dialog toasts inside that scope.
 * @property {boolean} [notify=true] Whether the binding raises toasts. `false` keeps it silent:
 * `save()`, `load()`, and `ready` still resolve or reject, and reporting is the caller's.
 */

/**
 * @typedef {Object} ZeyosFormConfig
 * @property {Record<string, any>[]} fieldMeta Ordered normalized schema metadata.
 * @property {Record<string, Record<string, any>>} fields Field descriptors keyed by id.
 * @property {Array<{id: string, resource: string}>} entityFields Referenced-resource fields.
 * @property {Record<string, any>} formOptions Plain Zx Form options.
 * @property {(record: Record<string, unknown>) => Record<string, unknown>} mapFromRecord Maps Unix
 * seconds to Date values: a date-only field to local midnight of its calendar day in `timeZone`.
 * @property {(values: Record<string, unknown>) => Record<string, unknown>} mapToRecord Maps Date and
 * enum values to API storage values: a date-only field to midnight of its day in `timeZone`.
 */

/**
 * @typedef {Object} ZeyosFormBinding
 * @property {Form} form Generated Zx form.
 * @property {Promise<Record<string, unknown>|null>} ready Initial value/load readiness.
 * @property {(id: unknown) => Promise<Record<string, unknown>>} load Loads and maps one record.
 * @property {() => Promise<Record<string, unknown>|null>} save Validates and creates or updates the
 * record, then confirms with a toast in the form's scope unless `notify` is false.
 * @property {() => Form} getForm Returns the generated Zx Form.
 * @property {() => void} destroy Destroys the form and all owned fields/selects.
 */

/**
 * Builds the DOM-free form configuration consumed by {@link zeyosForm}. Entity descriptors retain
 * the `zxselect` type and receive the same async options used by {@link zeyosSelect}; enum options
 * come from normalized schema metadata with readable labels, and the returned mappers handle
 * Unix-second dates — date-only fields as calendar days in `opts.timeZone`.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `transactions`.
 * @param {ZeyosFormOptions} [opts={}] Schema curation and layout options.
 * @returns {ZeyosFormConfig} Plain generator configuration and value mappers.
 */
export function buildZeyosFormConfig(client, resource, opts = {}) {
  const fieldMeta = resolveFields(client, resource, opts);
  const fields = {};
  const entityFields = [];
  /** @type {Map<string, 'date'|'datetime'>} */
  const dateKinds = new Map();

  for (const meta of fieldMeta) {
    const descriptor = fieldToZxField(meta);
    if (descriptor.type === 'date' || descriptor.type === 'datetime') {
      dateKinds.set(String(meta.id), descriptor.type);
    }
    const referencedResource = descriptor.type === 'zxselect' && typeof descriptor.props?.entity === 'string'
      ? descriptor.props.entity
      : null;
    if (referencedResource) {
      entityFields.push({ id: String(meta.id), resource: referencedResource });
      descriptor.props = {
        ...buildZeyosSelectConfig(client, referencedResource, {
          clearable: !descriptor.required,
          placeholder: `Select ${String(descriptor.label).toLowerCase()}`
        })
      };
    }
    fields[String(meta.id)] = descriptor;
  }

  return {
    fieldMeta,
    fields,
    entityFields,
    formOptions: {
      fieldsets: [{
        title: String(opts.title ?? ''),
        columns: normalizeColumns(opts.columns),
        fields
      }]
    },
    mapFromRecord: (record) => mapFromRecord(record, fieldMeta, dateKinds),
    mapToRecord: (values) => mapToRecord(values, fieldMeta, dateKinds)
  };
}

/**
 * Generates a schema-driven Zx Form and a small async binding object. `load(id)` hydrates entity
 * labels and converts Unix seconds to Date objects. `save()` validates, maps values back to API
 * storage types, calls create/update through the WP14 connection facade, invokes
 * `onSaved(record)`, and shows a success toast. Its toasts — that confirmation and the report of a
 * failed request — appear in the theme scope of `opts.scope` or of the form itself, and
 * `notify: false` silences them. Await `ready` when `opts.id` or `opts.value` is supplied.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `transactions`.
 * @param {ZeyosFormOptions} [opts={}] Schema, initial value, and save options.
 * @returns {ZeyosFormBinding} Generated form and lifecycle/data methods.
 */
export function zeyosForm(client, resource, opts = {}) {
  if (opts.onSaved != null && typeof opts.onSaved !== 'function') {
    throw new TypeError('zeyosForm onSaved must be a function');
  }
  const notify = opts.notify !== false;
  const config = buildZeyosFormConfig(client, resource, opts);
  // The caller's scope, or the form's own element, decides where a toast appears — never whatever
  // element happens to hold focus when a request settles.
  const toastScope = () => opts.scope ?? form.el;
  const facade = connect(client, {
    onError: (error) => notify ? Message.error(errorMessage(error), { scope: toastScope() }) : undefined
  });
  const form = new Form(null, config.formOptions);
  let currentId = opts.value?.ID ?? opts.id ?? null;
  let destroyed = false;
  let savePending = null;

  const applyRecord = async (record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError('ZeyOS form value must be a record');
    }
    await Promise.all(config.entityFields.map(async ({ id, resource: referencedResource }) => {
      const value = record[id];
      if (value == null) return;
      const selected = value && typeof value === 'object'
        ? value
        : normalizeRecord(await facade.get(referencedResource, value));
      const select = Select.from(form.getField(id)?.getInput());
      if (select instanceof Select) select.setItems([selected]);
    }));
    if (!destroyed) form.setValues(config.mapFromRecord(record), { silent: true });
    return record;
  };

  const load = async (id) => {
    if (id == null || id === '') throw new TypeError('zeyosForm.load() requires an id');
    const record = normalizeRecord(await facade.get(resource, id));
    currentId = record.ID ?? id;
    await applyRecord(record);
    return record;
  };

  const save = () => {
    if (destroyed) return Promise.reject(new Error('Cannot save a destroyed ZeyOS form'));
    if (savePending) return savePending;
    if (!form.submit()) return Promise.resolve(null);
    // Resolved now, while the form is in place, and to the theme scope rather than the open
    // dialog the overlay host would be: `onSaved` may close and destroy that dialog, and a toast
    // parked inside it would fall back to an unstyled <body>.
    const host = notify ? overlayScope(toastScope()) : null;

    savePending = (async () => {
      let payload;
      try {
        payload = config.mapToRecord(form.getValues());
        delete payload.ID;
      } catch (error) {
        facade.reportError(error, { operation: 'serialize', resource });
        throw error;
      }

      const result = currentId == null
        ? await facade.create(resource, payload)
        : await facade.update(resource, { ID: currentId, ...payload });
      const record = normalizeRecord(result);
      currentId = record.ID ?? currentId;
      if (opts.onSaved) {
        try {
          await opts.onSaved(record);
        } catch (error) {
          facade.reportError(error, { operation: 'onSaved', resource });
          throw error;
        }
      }
      if (host) Message.success(`${recordLabel(record, resource)} saved successfully.`, { scope: host });
      return record;
    })().finally(() => {
      savePending = null;
    });
    return savePending;
  };

  const ready = Object.prototype.hasOwnProperty.call(opts, 'id')
    ? load(opts.id)
    : (opts.value ? applyRecord(opts.value) : Promise.resolve(null));

  return {
    form,
    ready,
    load,
    save,
    getForm: () => form,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      form.destroy();
    }
  };
}

/**
 * @param {Record<string, unknown>} record
 * @param {Record<string, any>[]} meta
 * @param {Map<string, 'date'|'datetime'>} dateKinds
 * @returns {Record<string, unknown>}
 */
function mapFromRecord(record, meta, dateKinds) {
  const values = {};
  for (const field of meta) {
    const id = String(field.id);
    const value = record[id];
    const kind = dateKinds.get(id);
    if (!kind || value == null || value === '') values[id] = value;
    else if (kind === 'date') values[id] = unixSecondsToCalendarDay(/** @type {number|string} */ (value), field.timeZone);
    else values[id] = unixSecondsToDate(/** @type {number|string} */ (value));
  }
  return values;
}

/**
 * @param {Record<string, unknown>} values
 * @param {Record<string, any>[]} meta
 * @param {Map<string, 'date'|'datetime'>} dateKinds
 * @returns {Record<string, unknown>}
 */
function mapToRecord(values, meta, dateKinds) {
  const record = {};
  for (const field of meta) {
    const id = String(field.id);
    let value = values[id];
    const kind = dateKinds.get(id);
    if (kind) {
      if (value == null || value === '') value = null;
      else if (kind === 'date') value = calendarDayToUnixSeconds(/** @type {Date} */ (value), field.timeZone);
      else value = dateToUnixSeconds(/** @type {Date} */ (value));
    } else if (hasEnum(field) && isNumericType(field.type) && value !== '' && value != null) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) value = numeric;
    }
    record[id] = value;
  }
  return record;
}

/** @param {Record<string, any>} meta @returns {boolean} */
function hasEnum(meta) {
  return meta.enums != null || meta.enum != null;
}

/** @param {unknown} type @returns {boolean} */
function isNumericType(type) {
  return /^(?:smallint|integer|bigint|int|int2|int4|int8|numeric|decimal)$/i.test(String(type ?? ''));
}

/** @param {unknown} value @returns {1|2|3} */
function normalizeColumns(value) {
  const number = Number(value ?? 2);
  return /** @type {1|2|3} */ ([1, 2, 3].includes(number) ? number : 2);
}

/** @param {unknown} result @returns {Record<string, unknown>} */
function normalizeRecord(result) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const nested = result.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
    return result;
  }
  throw new TypeError('ZeyOS operation did not return a record');
}

/** @param {Record<string, unknown>} record @param {string} resource @returns {string} */
function recordLabel(record, resource) {
  for (const key of ['transactionnum', 'name', 'lastname', 'customernum', 'number', 'ID']) {
    if (record[key] != null && record[key] !== '') return String(record[key]);
  }
  return String(resource);
}
