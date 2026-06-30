import { useCallback } from 'react';
import { useLocaleStore } from '../stores/localeStore';

export function useTranslation() {
  const translations = useLocaleStore((s) => s.translations);

  const t = useCallback(
    (key: string): string => {
      const parts = key.split('.');
      let val: any = translations;
      for (const part of parts) {
        if (val && typeof val === 'object' && part in val) {
          val = val[part];
        } else {
          return key; // fallback to key itself
        }
      }
      return typeof val === 'string' ? val : key;
    },
    [translations]
  );

  return { t };
}
