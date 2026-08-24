/**
 * Zx public API.
 * @module zx
 */

import { registerChecklistFieldAdapter } from './components/checklist/field-adapter.js';
import { registerDatePickerFieldAdapters } from './components/date-picker/field-adapter.js';
import { registerDateRangeFieldAdapter } from './components/date-picker/range-field-adapter.js';
import { registerDateboxFieldAdapters } from './components/datebox/field-adapter.js';
import { registerFieldUploadAdapter } from './components/field-upload/field-adapter.js';
import { registerMultiValueEditorFieldAdapter } from './components/multi-value-editor/field-adapter.js';
import { registerNumberFieldAdapter } from './components/number-field/field-adapter.js';
import { registerRatingFieldAdapter } from './components/rating/field-adapter.js';
import { registerSelectFieldAdapter } from './components/select/field-adapter.js';
import { registerSliderFieldAdapter } from './components/slider/field-adapter.js';
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
  registerDateRangeFieldAdapter();
  registerTimeboxFieldAdapter();
  registerValueListFieldAdapter();
  registerMultiValueEditorFieldAdapter();
  registerFieldUploadAdapter();
  registerToggleFieldAdapter();
  registerNumberFieldAdapter();
  registerRatingFieldAdapter();
  registerTagPickerFieldAdapter();
  registerSliderFieldAdapter();
}

registerFieldAdapters();

export { Component } from './core/component.js';
export { h, htmlEscape, resolveElement, highlightMatch } from './core/dom.js';
export { position } from './core/position.js';
export { breakpoints, breakpointOf, matchBreakpoint, onBreakpoint } from './core/breakpoint.js';
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
export {
  debounce, throttle, uid, deepMerge, isElement, clamp, toArray, groupBy, sortBy, uniqueBy,
  escapeRegExp
} from './core/util.js';
export {
  formatNumber, formatCurrency, formatPercent, formatFileSize, formatRelativeTime
} from './core/format.js';
export { storage } from './core/storage.js';
export { toCsv, downloadBlob, copyToClipboard } from './core/export.js';
export { defineElements } from './elements/define.js';
export { button, buttonGroup } from './components/button/button.js';
export { badge, badgeGroup } from './components/badge/badge.js';
export { CheckButton } from './components/check-button/check-button.js';
export { emptyState } from './components/empty-state/empty-state.js';
export { spinner } from './components/loading/spinner.js';
export { ProgressBar } from './components/loading/progress-bar.js';
export { InlineLoading } from './components/loading/inline-loading.js';
export { skeleton, skeletonText, skeletonTable } from './components/skeleton/skeleton.js';
export { stack, grid, aspect } from './components/layout/layout.js';
export { truncate, isTruncated } from './components/truncate/truncate.js';
export { copyButton } from './components/copy/copy-button.js';
export { CopyInput } from './components/copy/copy-input.js';
export { Toolbar } from './components/toolbar/toolbar.js';
export { Toggle } from './components/toggle/toggle.js';
export { Groupbox } from './components/groupbox/groupbox.js';
export { Panel } from './components/panel/panel.js';
export { MasterPanel } from './components/master-panel/master-panel.js';
export {
  SplitView, clampSize, resolveSize, snapSize
} from './components/split-view/split-view.js';
export { Tabbox } from './components/tabbox/tabbox.js';
export { NavigationBar } from './components/navigation-bar/navigation-bar.js';
export { Stepper } from './components/stepper/stepper.js';
export { Breadcrumb } from './components/breadcrumb/breadcrumb.js';
export { Pagination, paginationRange } from './components/pagination/pagination.js';
export { Search } from './components/search/search.js';
export { Message } from './components/message/message.js';
export { Modal } from './components/modal/modal.js';
export { Dialog } from './components/dialog/dialog.js';
export { Dropdown } from './components/dropdown/dropdown.js';
export { Tooltip, tooltip, describe } from './components/tooltip/tooltip.js';
export { MenuButton } from './components/menu-button/menu-button.js';
export { ContextMenu } from './components/context-menu/context-menu.js';
export { Select } from './components/select/select.js';
export { Checklist } from './components/checklist/checklist.js';
export { TagPicker } from './components/tag-picker/tag-picker.js';
export { NumberField, parseNumber, snapNumber } from './components/number-field/number-field.js';
export { Rating } from './components/rating/rating.js';
export { Slider, stepPrecision } from './components/slider/slider.js';
export { DatePicker } from './components/date-picker/date-picker.js';
export { MonthPicker } from './components/date-picker/month-picker.js';
export { TimePicker } from './components/date-picker/time-picker.js';
export { Datebox, DateTimeBox } from './components/datebox/datebox.js';
export {
  DateRangePicker, clampRange, defaultDateRangePresets, normalizeRange, rangeNights, rangeStateOf
} from './components/date-picker/date-range-picker.js';
export {
  DateRangeBox, formatRangeText, parseRangeText
} from './components/datebox/date-range-box.js';
export { Timebox, splitTime, joinTime } from './components/timebox/timebox.js';
export { Table } from './components/table/table.js';
export { TreeView } from './components/tree/tree.js';
export { Finder } from './components/finder/finder.js';
export { DataFilter } from './components/data-filter/data-filter.js';
export { Field } from './components/field/field.js';
export { Fieldset } from './components/fieldset/fieldset.js';
export { Form } from './components/form/form.js';
export { Questionnaire } from './components/questionnaire/questionnaire.js';
export { ValueList } from './components/value-list/value-list.js';
export { MultiValueEditor } from './components/multi-value-editor/multi-value-editor.js';
export { FieldUpload } from './components/field-upload/field-upload.js';
