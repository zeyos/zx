import { Field } from '../field/field.js';
import { Rating } from './rating.js';

/**
 * Registers the Rating-backed `rating` field type.
 * @returns {void}
 */
export function registerRatingFieldAdapter() {
  Field.register('rating', (field, options) => {
    const rating = field.own(new Rating(null, {
      label: options.label ? String(options.label) : undefined,
      ...(options.props ?? {})
    }));
    let setting = false;
    rating.on('change', (event) => {
      if (!setting) field.emit('change', { value: event.detail.value });
    });
    return {
      el: rating.el,
      // Unrated reads as null rather than 0, so Form's required check treats it as empty.
      get: () => rating.get() || null,
      set: (value) => {
        setting = true;
        try {
          rating.set(Number(value) || 0, { silent: true });
        } finally {
          setting = false;
        }
      },
      focus: () => rating.focus(),
      setDisabled: (value) => (value ? rating.disable() : rating.enable())
    };
  });
}
