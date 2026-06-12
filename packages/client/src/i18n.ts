import { createContext, useContext } from 'react'

export type Lang = 'en' | 'cs'

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    'search.placeholder': 'Search torrents...',
    'search.button': 'Search',
    'search.searching': 'Searching',
    'results.heading': 'Results',
    'results.add': 'Add',
    'results.empty': 'No results found. Try a different query.',
    'results.hint': 'Search for torrents using the bar above.',
    'torrents.heading': 'Active Torrents',
    'torrents.empty': 'No active torrents.',
    'torrents.empty_hint': 'Search and add one above.',
    'player.live': 'Live',
    'player.no_subtitles': 'No subtitles',
    'player.close': 'Close',
    'player.close_player': 'Close player',
    'player.expand': 'Expand',
    'player.collapse': 'Collapse',
    'player.loading': 'Loading stream\u2026',
    'indexer.connected': '\u25CF Indexer connected',
    'indexer.not_configured': '\u25CB Indexer not configured',
    'theme.dark': 'Dark mode',
    'theme.light': 'Light mode',
    'auth.login': 'Login',
    'auth.logging_in': 'Logging in\u2026',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.logout': 'Logout',
  },
  cs: {
    'search.placeholder': 'Hledat torrenty...',
    'search.button': 'Hledat',
    'search.searching': 'Hled\u00e1n\u00ed',
    'results.heading': 'V\u00fdsledky',
    'results.add': 'P\u0159idat',
    'results.empty': 'Nenalezeny \u017e\u00e1dn\u00e9 v\u00fdsledky. Zkuste jin\u00fd dotaz.',
    'results.hint': 'Hledejte torrenty pomoc\u00ed vyhled\u00e1v\u00e1n\u00ed v\u00fd\u0161e.',
    'torrents.heading': 'Aktivn\u00ed torrenty',
    'torrents.empty': '\u017d\u00e1dn\u00e9 aktivn\u00ed torrenty.',
    'torrents.empty_hint': 'Vyhledejte a p\u0159idejte n\u011bjak\u00fd v\u00fd\u0161e.',
    'player.live': '\u017div\u011b',
    'player.no_subtitles': 'Bez titulk\u016f',
    'player.close': 'Zav\u0159\u00edt',
    'player.close_player': 'Zav\u0159\u00edt p\u0159ehr\u00e1va\u010d',
    'player.expand': 'Rozbalit',
    'player.collapse': 'Sbalit',
    'player.loading': 'Na\u010d\u00edt\u00e1n\u00ed streamu\u2026',
    'indexer.connected': '\u25CF Indexer p\u0159ipojen',
    'indexer.not_configured': '\u25CB Indexer nen\u00ed nakonfigurov\u00e1n',
    'theme.dark': 'Tmav\u00fd re\u017eim',
    'theme.light': 'Sv\u011btl\u00fd re\u017eim',
    'auth.login': 'P\u0159ihl\u00e1sit',
    'auth.logging_in': 'P\u0159ihla\u0161ov\u00e1n\u00ed\u2026',
    'auth.username': 'U\u017eivatelsk\u00e9 jm\u00e9no',
    'auth.password': 'Heslo',
    'auth.logout': 'Odhl\u00e1sit',
  },
}

export interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

export const LangContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k: string) => translations.en[k] || k,
})

export function useLang() {
  return useContext(LangContext)
}
