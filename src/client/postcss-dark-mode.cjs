/**
 * PostCSS plugin that appends dark mode color remapping rules AFTER
 * Tailwind has finished processing. This avoids circular dependency
 * issues because these rules are injected post-Tailwind.
 *
 * Covers: bg-white, bg-gray-*, text-gray-*, border-gray-*, divide-gray-*,
 * ring-gray-*, shadow-*, hover states, and focus ring overrides.
 */
module.exports = () => {
  return {
    postcssPlugin: 'postcss-dark-mode-remap',
    Once(root) {
      const { Rule, Declaration } = require('postcss');

      const rules = [
        // ── Backgrounds ──
        ['.dark .bg-white', 'background-color', '#1f2937'],
        ['.dark .bg-gray-50', 'background-color', '#111827'],
        ['.dark .bg-gray-100', 'background-color', '#1f2937'],
        ['.dark .bg-gray-200', 'background-color', '#374151'],
        ['.dark .bg-gray-300', 'background-color', '#4b5563'],
        ['.dark .bg-gray-400', 'background-color', '#6b7280'],

        // ── Borders ──
        ['.dark .border-gray-50', 'border-color', '#374151'],
        ['.dark .border-gray-100', 'border-color', '#374151'],
        ['.dark .border-gray-200', 'border-color', '#4b5563'],
        ['.dark .border-gray-300', 'border-color', '#4b5563'],
        ['.dark .border-gray-400', 'border-color', '#6b7280'],
        ['.dark .border-white', 'border-color', '#374151'],

        // ── Text ──
        ['.dark .text-gray-900', 'color', '#f3f4f6'],
        ['.dark .text-gray-800', 'color', '#e5e7eb'],
        ['.dark .text-gray-700', 'color', '#d1d5db'],
        ['.dark .text-gray-600', 'color', '#9ca3af'],
        ['.dark .text-gray-500', 'color', '#9ca3af'],
        ['.dark .text-gray-400', 'color', '#9ca3af'],
        ['.dark .text-gray-300', 'color', '#6b7280'],
        ['.dark .text-black', 'color', '#f3f4f6'],

        // ── Ring ──
        ['.dark .ring-gray-100', '--tw-ring-color', '#374151'],
        ['.dark .ring-gray-200', '--tw-ring-color', '#4b5563'],
        ['.dark .ring-gray-300', '--tw-ring-color', '#4b5563'],

        // ── Dividers ──
        ['.dark .divide-gray-50 > :not([hidden]) ~ :not([hidden])', 'border-color', '#374151'],
        ['.dark .divide-gray-100 > :not([hidden]) ~ :not([hidden])', 'border-color', '#374151'],
        ['.dark .divide-gray-200 > :not([hidden]) ~ :not([hidden])', 'border-color', '#4b5563'],
        ['.dark .divide-gray-300 > :not([hidden]) ~ :not([hidden])', 'border-color', '#4b5563'],

        // ── Hover backgrounds ──
        ['.dark .hover\\:bg-white:hover', 'background-color', '#1f2937'],
        ['.dark .hover\\:bg-gray-50:hover', 'background-color', '#1f2937'],
        ['.dark .hover\\:bg-gray-100:hover', 'background-color', '#374151'],
        ['.dark .hover\\:bg-gray-200:hover', 'background-color', '#4b5563'],
        ['.dark .hover\\:bg-gray-300:hover', 'background-color', '#6b7280'],
        ['.dark .hover\\:bg-primary-50:hover', 'background-color', '#374151'],

        // ── Hover text ──
        ['.dark .hover\\:text-gray-900:hover', 'color', '#f3f4f6'],
        ['.dark .hover\\:text-gray-800:hover', 'color', '#e5e7eb'],
        ['.dark .hover\\:text-gray-700:hover', 'color', '#d1d5db'],
        ['.dark .hover\\:text-gray-600:hover', 'color', '#9ca3af'],

        // ── Hover borders ──
        ['.dark .hover\\:border-gray-300:hover', 'border-color', '#4b5563'],
        ['.dark .hover\\:border-gray-400:hover', 'border-color', '#6b7280'],

        // ── Focus ring overrides ──
        ['.dark .focus\\:ring-gray-200:focus', '--tw-ring-color', '#4b5563'],
        ['.dark .focus\\:ring-gray-300:focus', '--tw-ring-color', '#4b5563'],
        ['.dark .focus\\:border-gray-300:focus', 'border-color', '#4b5563'],

        // ── Shadows ──
        ['.dark .shadow-sm', 'box-shadow', '0 1px 2px 0 rgba(0,0,0,0.3)'],
        ['.dark .shadow', 'box-shadow', '0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)'],
        ['.dark .shadow-md', 'box-shadow', '0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.4)'],
        ['.dark .shadow-lg', 'box-shadow', '0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.4)'],
        ['.dark .shadow-xl', 'box-shadow', '0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.4)'],

        // ── Placeholder text ──
        ['.dark .placeholder-gray-400::placeholder', 'color', '#9ca3af'],
        ['.dark .placeholder-gray-500::placeholder', 'color', '#6b7280'],
      ];

      for (const [selector, prop, value] of rules) {
        const rule = new Rule({ selector });
        rule.append(new Declaration({ prop, value, important: true }));
        root.append(rule);
      }
    },
  };
};

module.exports.postcss = true;
