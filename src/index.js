/**
 * Zx public API.
 * @module zx
 */

import { registerChecklistFieldAdapter } from './components/checklist/field-adapter.js';
import { registerDatePickerFieldAdapters } from './components/date-picker/field-adapter.js';
import { registerDateboxFieldAdapters } from './components/datebox/field-adapter.js';
import { registerFieldUploadAdapter } from './components/field-upload/field-adapter.js';
import { registerMultiValueEditorFieldAdapter } from './components/multi-value-editor/field-adapter.js';
import { registerNumberFieldAdapter } from './components/number-field/field-adapter.js';
import { registerRatingFieldAdapter } from './components/rating/field-adapter.js';
import { registerSelectFieldAdapter } from './components/select/field-adapter.js';
import { registerTagPickerFieldAdapter } from './components/tag-picker/field-adapter.js';
import { registerTimeboxFieldAdapter } from './components/timebox/field-adapter.js';
import { registerToggleFieldAdapter } from './components/toggle/field-adapter.js';
import { registerValueListFieldAdapter } from './components/value-list/field-adapter.js';

/**
 * Registers every component-backed Field adapter. Calling this function repeatedly is safe.
 * @returns {void}
 */
export function registerFieldAdapters() {
  registerSelectFieldAdapter();
  registerChecklistFieldAdapter();
  registerDateboxFieldAdapters();
  registerDatePickerFieldAdapters();
  registerTimeboxFieldAdapter();
  registerValueListFieldAdapter();
  registerMultiValueEditorFieldAdapter();
  registerFieldUploadAdapter();
  registerToggleFieldAdapter();
  registerNumberFieldAdapter();
  registerRatingFieldAdapter();
  registerTagPickerFieldAdapter();
}

registerFieldAdapters();

export { Component } from './core/component.js';
export { h, htmlEscape, resolveElement } from './core/dom.js';
export { position } from './core/position.js';
export { Http, zeyosService, parseResult } from './core/http.js';
export { setTranslator, setLanguage, getLanguage, translate, printf } from './core/i18n.js';
export { focusTrap, rovingTabindex, typeahead } from './core/keyboard.js';
export {
  formatDate, parseDate, clampDate, isSameDay, addDays, addMonths, getWeekStart
} from './core/date.js';
export {
  icon, icons, iconNames, registerIcons,
  configureIcons, getIconConfig, useFontAwesome, useBuiltinIcons, loadFontAwesome
} from './core/icons.js';
export {
  faStyles, faFamilies, faNames, faIconClasses, parseIconSpec, kitUrl, loadFontAwesomeKit
} from './core/fontawesome.js';
export { debounce, uid, deepMerge, isElement, clamp, toArray } from './core/util.js';
export { defineElements } from './elements/define.js';
export { button, buttonGroup } from './components/button/button.js';
export { CheckButton } from './components/check-button/check-button.js';
export { Toggle } from './components/toggle/toggle.js';
export { Groupbox } from './components/groupbox/groupbox.js';
export { Panel } from './components/panel/panel.js';
export { MasterPanel } from './components/master-panel/master-panel.js';
export { Tabbox } from './components/tabbox/tabbox.js';
export { NavigationBar } from './components/navigation-bar/navigation-bar.js';
export { Search } from './components/search/search.js';
export { Message } from './components/message/message.js';
export { Modal } from './components/modal/modal.js';
export { Dialog } from './components/dialog/dialog.js';
export { Dropdown } from './components/dropdown/dropdown.js';
export { MenuButton } from './components/menu-button/menu-button.js';
export { Select } from './components/select/select.js';
export { Checklist } from './components/checklist/checklist.js';
export { TagPicker } from './components/tag-picker/tag-picker.js';
export { NumberField, parseNumber, snapNumber } from './components/number-field/number-field.js';
export { Rating } from './components/rating/rating.js';
export { Permission } from './components/permission/permission.js';
export { DatePicker } from './components/date-picker/date-picker.js';
export { MonthPicker } from './components/date-picker/month-picker.js';
export { TimePicker } from './components/date-picker/time-picker.js';
export { Datebox, DateTimeBox } from './components/datebox/datebox.js';
export { Timebox, splitTime, joinTime } from './components/timebox/timebox.js';
export { Table } from './components/table/table.js';
export { TreeView } from './components/tree/tree.js';
export { Finder } from './components/finder/finder.js';
export { DataFilter } from './components/data-filter/data-filter.js';
export { Field } from './components/field/field.js';
export { Fieldset } from './components/fieldset/fieldset.js';
export { Form } from './components/form/form.js';
export { ValueList } from './components/value-list/value-list.js';
export { MultiValueEditor } from './components/multi-value-editor/multi-value-editor.js';
export { FieldUpload } from './components/field-upload/field-upload.js';
