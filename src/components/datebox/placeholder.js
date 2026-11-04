/**
 * What each numeric format token reads as in a date field's placeholder: `%Y` is `YYYY` in English
 * and `JJJJ` in German. Datebox and DateRangeBox each replace the tokens their format allows.
 * @param {(key: string) => string} message Resolves a message key for the field.
 * @returns {Record<string, string>} Placeholder text by format token.
 */
export function placeholderTokens(message) {
  return {
    '%d': message('datebox.placeholder.day'),
    '%e': message('datebox.placeholder.dayShort'),
    '%m': message('datebox.placeholder.month'),
    '%Y': message('datebox.placeholder.year'),
    '%y': message('datebox.placeholder.yearShort'),
    '%H': message('datebox.placeholder.hour'),
    '%M': message('datebox.placeholder.minute'),
    '%S': message('datebox.placeholder.second')
  };
}
