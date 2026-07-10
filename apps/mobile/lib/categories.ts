import type { Ionicons } from '@expo/vector-icons';
import type { TranslationKey } from './i18n';

export type CategoryId =
  | 'ushqime'
  | 'higjene'
  | 'shtepi'
  | 'veshje'
  | 'transport'
  | 'shendetesi'
  | 'argetim'
  | 'te_tjera';

export type Category = { id: CategoryId; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap };

export const CATEGORIES: Category[] = [
  { id: 'ushqime', labelKey: 'categories.ushqime', icon: 'restaurant-outline' },
  { id: 'higjene', labelKey: 'categories.higjene', icon: 'sparkles-outline' },
  { id: 'shtepi', labelKey: 'categories.shtepi', icon: 'home-outline' },
  { id: 'veshje', labelKey: 'categories.veshje', icon: 'shirt-outline' },
  { id: 'transport', labelKey: 'categories.transport', icon: 'car-outline' },
  { id: 'shendetesi', labelKey: 'categories.shendetesi', icon: 'medkit-outline' },
  { id: 'argetim', labelKey: 'categories.argetim', icon: 'ticket-outline' },
  { id: 'te_tjera', labelKey: 'categories.te_tjera', icon: 'ellipsis-horizontal-circle-outline' },
];

export const DEFAULT_CATEGORY: CategoryId = 'te_tjera';

export function categoryLabelKey(id: string | null | undefined): TranslationKey {
  return CATEGORIES.find((category) => category.id === id)?.labelKey ?? categoryLabelKey(DEFAULT_CATEGORY);
}

export function categoryIcon(id: string | null | undefined): keyof typeof Ionicons.glyphMap {
  return CATEGORIES.find((category) => category.id === id)?.icon ?? categoryIcon(DEFAULT_CATEGORY);
}

const KEYWORD_RULES: { id: CategoryId; keywords: string[] }[] = [
  {
    id: 'higjene',
    keywords: [
      'shampo', 'sapun', 'dhëmb', 'dhemb', 'deodorant', 'higjien', 'kozmetik', 'parfum',
      'krem', 'pelena', 'peceta', 'furç', 'pambuk', 'brisk', 'losion', 'xhel', 'shakuqe',
      'shami',
    ],
  },
  {
    id: 'shtepi',
    keywords: [
      'pastrim', 'deterg', 'fshes', 'higjienike', 'qese', 'kova', 'sfungjer', 'zarf',
      'qiri', 'pjatë', 'pjate', 'gotë', 'gote', 'thes', 'llambë', 'llambe', 'bateri',
      'peshqir', 'çarçaf', 'carcaf', 'jastëk', 'jastek', 'tenxhere', 'tave',
    ],
  },
  {
    id: 'veshje',
    keywords: [
      'rroba', 'këmish', 'kemish', 'pantallona', 'fund', 'fustan', 'çorape', 'corape',
      'atlete', 'këpuc', 'kepuc', 'xhaket', 'pallto', 'bluz', 'brek', 'triko', 'çantë',
      'cante', 'kapel', 'shall', 'dorezë', 'doreze',
    ],
  },
  {
    id: 'transport',
    keywords: ['karburant', 'benzin', 'naft', 'parking', 'taksi', 'autobus', 'tren', 'trageu'],
  },
  {
    id: 'shendetesi',
    keywords: ['farmaci', 'ilaç', 'ilac', 'vitamin', 'mjek', 'shurup', 'termometer', 'receta'],
  },
  {
    id: 'argetim',
    keywords: ['kinema', 'restorant', 'kafene', 'bileta', 'koncert', 'lojë', 'loje'],
  },
  {
    id: 'ushqime',
    keywords: [
      // mish & peshk
      'bukë', 'buke', 'mish', 'pul', 'viç', 'vic', 'derr', 'peshk', 'file', 'filet',
      'sallam', 'suxhuk', 'proshut', 'ton', 'sardele',
      // perime & fruta
      'perime', 'fruta', 'mollë', 'molle', 'portokall', 'banane', 'domate', 'patate',
      'qep', 'hudh', 'karrot', 'brokoli', 'spec', 'patellxhan', 'kungull', 'lulelaker',
      'dardh', 'rrush', 'kumbull', 'kajsi', 'pjeshk', 'shalqi', 'pjepër', 'pjeper',
      'limon', 'mandarin', 'ananas',
      // bulmet & të tjera
      'vezë', 'veze', 'djath', 'gjalp', 'qumësht', 'qumesht', 'kos', 'gjizë', 'gjize',
      'miell', 'oriz', 'makarona', 'spageti', 'vaj', 'uthull', 'salc', 'sheqer',
      'kripë', 'kripe', 'piper', 'erëza', 'ereza', 'çokollat', 'cokollat', 'karamele',
      'akullore', 'mjaltë', 'mjalte', 'konserv', 'arra', 'bajame', 'biskota', 'snack',
      // pije
      'coca', 'cola', 'pepsi', 'fanta', 'sprite', 'birr', 'verë', 'vere', 'lëng', 'leng',
      'kafe', 'çaj', 'caj', 'redbull', 'ujë', 'uje', 'juice',
    ],
  },
];

export function suggestCategory(productName: string): CategoryId {
  const normalized = productName.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.id;
    }
  }
  return DEFAULT_CATEGORY;
}
