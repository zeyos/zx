import { GxWrapper } from './base.js';
import { installElementStorage, installGlobals, parse } from './globals.js';
import {
  BootstrapMessage, BootstrapPopup, CheckButton, Dialog, Dropdown, MenuButton, Msgbox, Popup,
  PopupAlert, PopupConfirm, PopupConfirmCanceled, Toggle
} from './map/basic.js';
import {
  BootstrapChecklist, BootstrapTable, Checklist, DataFilter, Permission, SimpleTable, Table
} from './map/data.js';
import {
  BootstrapTimebox, CoreTimebox, Datebox, DatePicker, MonthPicker, Timebox, TimePicker
} from './map/date-time.js';
import { Factory } from './map/factory.js';
import { Field, Fieldset, FieldUpload, Form, MultiValueEditor, ValueList } from './map/form.js';
import { Client, Request } from './map/http.js';
import {
  BootstrapTabbox, Groupbox, MasterPanel, NavigationBar, Panel, Search, Tabbox
} from './map/layout.js';
import {
  BootstrapSelect, BootstrapSelectDyn, BootstrapSelectFilter, BootstrapSelectPrio,
  Select, SelectDyn, SelectDynREST, SelectFilter, SelectPrio
} from './map/select.js';
import { Container, Settings, Blend, Collapse, HGroup, Hud, Templates, Toggling } from './map/stubs.js';
import { util } from './map/utilities.js';

/** Compatibility utilities and explicit global/prototype installers. */
const compat = Object.freeze({ installGlobals, installElementStorage, parse, GxWrapper });

/** Window-independent legacy gx namespace. */
export const gx = {
  core: { Settings },
  ui: {
    Container, SimpleTable, Timebox: CoreTimebox,
    Collapse, Blend, Hud, Toggling, HGroup, Templates
  },
  util,
  zeyos: {
    Toggle, Msgbox, Popup, Dialog, Dropdown,
    Select, SelectFilter, SelectDyn, SelectPrio,
    Checklist, Permission, Table, Tabbox,
    Panel, MasterPanel, Groupbox, Search,
    Datebox, DatePicker, TimePicker, MonthPicker, Timebox,
    Client, Request, Factory
  },
  bootstrap: {
    Message: BootstrapMessage,
    Popup: BootstrapPopup,
    PopupAlert,
    PopupConfirm,
    PopupConfirmCanceled,
    MenuButton,
    CheckButton,
    Select: BootstrapSelect,
    SelectFilter: BootstrapSelectFilter,
    SelectDyn: BootstrapSelectDyn,
    SelectDynREST,
    SelectPrio: BootstrapSelectPrio,
    Checklist: BootstrapChecklist,
    Table: BootstrapTable,
    Tabbox: BootstrapTabbox,
    NavigationBar,
    Timebox: BootstrapTimebox,
    Form,
    Fieldset,
    Field,
    ValueList,
    MultiValueEditor,
    FieldUpload,
    DataFilter
  },
  compat
};

/** Assigns the compatibility namespace to a browser-like host without installing optional globals. @param {typeof globalThis} [host=globalThis] @returns {typeof gx} */
export function install(host = globalThis) {
  installElementStorage(host);
  host.gx = gx;
  return gx;
}

gx.install = install;

export { GxWrapper, installElementStorage, installGlobals, parse };
export default gx;
