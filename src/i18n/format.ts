/**
 * Tiny `{placeholder}` interpolation for dictionary strings.
 *
 * Intentionally not a full ICU formatter: dictionary values stay plain strings,
 * which keeps JSON reviewable and the bundle tiny. Swap in `intl-messageformat`
 * later if the PRD needs pluralisation/gender rules.
 */

export type InterpolationValues = Record<string, string | number>;

export function interpolate(template: string, values: InterpolationValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
