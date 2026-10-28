import { Field } from '../field/field.js';
import { Slider } from './slider.js';

/**
 * Registers the Slider-backed `slider` field type.
 * @returns {void}
 */
export function registerSliderFieldAdapter() {
  Field.register('slider', (field, options) => {
    const slider = field.own(new Slider(null, {
      // The Field already renders the label, so the slider keeps it only for its own control.
      label: options.label ? String(options.label) : undefined,
      hideLabel: true,
      disabled: Boolean(options.disabled),
      ...(options.props ?? {})
    }));
    let setting = false;
    // The range input's native `change` bubbles out of the slider after the slider has reported
    // the same commit; without this the Field would emit `change` twice per edit.
    field.listen(slider.el, 'change', (event) => event.stopImmediatePropagation());
    slider.on('change', (event) => {
      if (!setting) field.emit('change', { value: event.detail.value });
    });
    slider.on('input', (event) => field.emit('input', { value: event.detail.value }));
    return {
      el: slider.el,
      get: () => slider.get(),
      set: (value) => {
        setting = true;
        try {
          slider.set(Number(value) || 0, { silent: true });
        } finally {
          setting = false;
        }
      },
      focus: () => slider.focus(),
      setDisabled: (value) => (value ? slider.disable() : slider.enable()),
      setReadonly: (value) => { slider.setReadonly(value); }
    };
  });
}
