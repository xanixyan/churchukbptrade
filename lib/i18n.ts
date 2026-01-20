/**
 * Ukrainian localization dictionary
 * All user-facing strings in the application
 *
 * NOTE: Blueprint names are NOT localized - they remain as stored in the database
 */

export const uk = {
  // ============================================
  // COMMON
  // ============================================
  common: {
    loading: "Завантаження...",
    error: "Помилка",
    success: "Успішно",
    save: "Зберегти",
    cancel: "Скасувати",
    delete: "Видалити",
    edit: "Редагувати",
    close: "Закрити",
    back: "Назад",
    next: "Далі",
    search: "Пошук",
    clear: "Очистити",
    reset: "Скинути",
    yes: "Так",
    no: "Ні",
    none: "немає",
    all: "Всі",
    retry: "Повторити",
  },

  // ============================================
  // NAVIGATION & HEADER
  // ============================================
  nav: {
    home: "Головна",
    catalog: "Каталог",
    sellerLogin: "Вхід для продавців",
    sellerRegister: "Стати продавцем",
    adminPanel: "Панель адміністратора",
    logout: "Вихід",
    viewSite: "Переглянути сайт",
  },

  // ============================================
  // CATALOG & BLUEPRINTS
  // ============================================
  catalog: {
    title: "Каталог креслень",
    description: "Переглядай креслення ARC Raiders. Натисни на будь-який елемент, щоб побачити деталі та купити.",
    updated: "Оновлено",
    searchPlaceholder: "Пошук за назвою або ID...",
    onlyInStock: "Тільки в наявності",
    showingCount: "Показано {shown} з {total} креслень",
    noResults: "Креслень не знайдено",
    clearSearch: "Очистити пошук",
    resetCategory: "Скинути категорію",
    allCategories: "Всі типи",
  },

  blueprint: {
    quantity: "К-сть",
    available: "Доступно",
    inStock: "В наявності",
    outOfStock: "Немає в наявності",
    inStockCount: "В наявності: {count} шт.",
    sellers: "продавців",
    seller: "продавець",
    notes: "Примітки",
    backToCatalog: "Назад до каталогу",
    buy: "Купити",
  },

  // ============================================
  // SELECTION & CHECKOUT
  // ============================================
  selection: {
    select: "Обрати",
    exitSelection: "Вийти з вибору",
    clearSelection: "Очистити",
    buySelected: "Купити обране",
    itemsSelected: "{types} типів, {count} шт.",
    typesSingular: "тип",
    typesPlural: "типів",
    units: "шт.",
  },

  checkout: {
    title: "Оформити замовлення",
    titleWithCount: "Оформити замовлення ({types} типів, {count} шт.)",
    titleSingle: "Оформити замовлення (×{count})",
    yourOrder: "Ваше замовлення",
    discordNickLabel: "Ваш Discord нікнейм",
    discordNickPlaceholder: "username або username#1234",
    offerLabel: "Що пропонуєте взамін",
    offerPlaceholder: "Наприклад: 500 ARC, інше креслення, тощо",
    notesLabel: "Примітки",
    notesOptional: "опціонально",
    notesPlaceholder: "Зручний час для обміну, додаткова інформація...",
    submitting: "Відправляю...",
    submitOrder: "Оформити замовлення",
    orderSuccess: "Замовлення відправлено!",
    orderSuccessMessage: "Продавці отримали повідомлення та зв'яжуться з вами в Discord.",
    afterSubmitNote: "Після оформлення продавці отримають повідомлення та напишуть вам в Discord",
    fromStock: "з {qty}",
    required: "*",
  },

  // ============================================
  // ORDER MESSAGES
  // ============================================
  order: {
    multiSellerMessage: "Це замовлення включає кількох продавців. Ціна/умови мають бути узгоджені в приватних повідомленнях (DM).",
    submitted: "Замовлення відправлено! Продавці отримали повідомлення.",
    tooManyRequests: "Забагато запитів. Спробуйте через {seconds} секунд.",
    invalidJson: "Невірний формат даних",
    invalidData: "Невірні дані",
    serverNotConfigured: "Сервер не налаштовано для прийому замовлень",
    internalError: "Внутрішня помилка сервера",
    methodNotAllowed: "Метод не дозволено",
  },

  // ============================================
  // VALIDATION ERRORS
  // ============================================
  validation: {
    required: "Обов'язкове поле",
    invalidRequest: "Невірний запит",
    requestRejected: "Запит відхилено",
    discordRequired: "Discord нікнейм обов'язковий",
    discordTooLong: "Discord нікнейм занадто довгий (макс. 64 символи)",
    discordEmpty: "Discord нікнейм не може бути порожнім",
    offerRequired: "Вкажіть, що пропонуєте взамін",
    offerTooLong: "Пропозиція занадто довга (макс. 500 символів)",
    notesTooLong: "Примітки занадто довгі (макс. 500 символів)",
    selectAtLeastOne: "Оберіть хоча б одне креслення",
    tooManyItems: "Занадто багато позицій (макс. 50)",
    invalidItem: "Невірна позиція",
    missingBlueprintId: "Відсутній ID креслення",
    missingBlueprintName: "Відсутня назва креслення",
    invalidQuantity: "Невірна кількість (1-999)",
    passwordRequired: "Пароль обов'язковий",
    passwordTooShort: "Пароль має містити щонайменше 8 символів",
    passwordTooLong: "Пароль занадто довгий (макс. 128 символів)",
    passwordsDoNotMatch: "Паролі не співпадають",
  },

  // ============================================
  // AUTH & SELLER
  // ============================================
  auth: {
    login: "Увійти",
    logout: "Вийти",
    register: "Реєстрація",
    loginTitle: "Вхід для продавців",
    registerTitle: "Реєстрація продавця",
    discordIdLabel: "Discord ID",
    discordIdPlaceholder: "Ваш Discord username",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Введіть пароль",
    confirmPasswordLabel: "Підтвердіть пароль",
    confirmPasswordPlaceholder: "Повторіть пароль",
    loggingIn: "Вхід...",
    registering: "Реєстрація...",
    invalidCredentials: "Невірні облікові дані",
    tooManyLoginAttempts: "Забагато спроб входу. Спробуйте пізніше.",
    tooManyRegisterAttempts: "Забагато спроб реєстрації. Спробуйте пізніше.",
    accountCreated: "Обліковий запис створено. Очікуйте підтвердження від адміністратора.",
    connectionError: "Помилка з'єднання",
    alreadyHaveAccount: "Вже маєте обліковий запис?",
    noAccount: "Немає облікового запису?",
    registerHere: "Зареєструватися",
    loginHere: "Увійти",
  },

  // ============================================
  // SELLER STATUS
  // ============================================
  sellerStatus: {
    pending_verification: "Ваш обліковий запис очікує перевірки адміністратором.",
    active: "Ваш обліковий запис активний.",
    banned: "Ваш обліковий запис заблоковано.",
    disabled: "Ваш обліковий запис вимкнено.",
    unknown: "Невідомий статус облікового запису.",
    accountPending: "Обліковий запис очікує підтвердження",
    accountDenied: "Доступ до облікового запису заборонено",
  },

  // ============================================
  // SELLER DASHBOARD
  // ============================================
  seller: {
    dashboard: "Кабінет продавця",
    inventory: "Мій інвентар",
    inventoryDescription: "Керуйте кількістю креслень у вашому інвентарі",
    searchBlueprints: "Пошук креслень...",
    filters: "Фільтри",
    inStockOnly: "Тільки в наявності",
    outOfStockOnly: "Тільки відсутні",
    unsavedChanges: "незбережених змін",
    unsavedChange: "незбережена зміна",
    saving: "Збереження...",
    changesSaved: "Зміни збережено",
    noChanges: "Немає змін для збереження",
    inventoryStats: "Статистика інвентарю",
    totalTypes: "Типів креслень",
    totalItems: "Загальна кількість",
    welcomeBack: "Вітаємо",
    telegramNotSet: "Telegram не налаштовано",
    telegramSetup: "Налаштуйте Telegram для отримання сповіщень про замовлення",
  },

  // ============================================
  // ADMIN PANEL
  // ============================================
  admin: {
    panel: "Панель адміністратора",
    login: "Вхід адміністратора",
    passwordLabel: "Пароль",
    passwordPlaceholder: "Введіть пароль адміністратора",
    loggingIn: "Вхід...",
    loginFailed: "Помилка входу",
    invalidPassword: "Невірний пароль",
    notConfigured: "Доступ адміністратора не налаштовано",
    authFailed: "Помилка автентифікації",

    // Tabs
    sellersTab: "Продавці",
    blueprintsTab: "Креслення (застаріле)",
    blueprintsLegacyNote: "Це застарілий розділ управління кресленнями. Інвентар тепер керується через продавців.",

    // Sellers
    addSeller: "Додати продавця",
    sellerDiscordPlaceholder: "Discord username або ID",
    creating: "Створення...",
    sellerCreated: "Продавця створено",
    sellerUpdated: "Продавця оновлено",
    sellerDeleted: "Продавця видалено",
    noSellers: "Продавців поки немає. Додайте вище.",
    newSellerNote: "Нові продавці неактивні за замовчуванням і не можуть отримати доступ до кабінету, поки їх не активовано.",

    // Seller table
    discordId: "Discord ID",
    status: "Статус",
    telegram: "Telegram",
    items: "Позиції",
    created: "Створено",
    actions: "Дії",
    notSet: "Не встановлено",

    // Seller actions
    approve: "Підтвердити",
    ban: "Заблокувати",
    viewInventory: "Інвентар",
    confirmDelete: "Ви впевнені, що хочете видалити цього продавця? Цю дію неможливо скасувати.",
    confirmBan: "Ви впевнені, що хочете заблокувати цього продавця?",

    // Pending verification
    pendingCount: "{count} продавців очікують підтвердження",
    pendingCountSingular: "{count} продавець очікує підтвердження",
    reviewPending: "Перегляньте та підтвердіть нові реєстрації продавців нижче",

    // Edit seller modal
    editSeller: "Редагувати продавця",
    telegramChatId: "Telegram Chat ID",
    telegramPlaceholder: "Для сповіщень про замовлення",
    statusLabel: "Статус",
    statusPending: "Очікує підтвердження",
    statusActive: "Активний",
    statusDisabled: "Вимкнено",
    statusBanned: "Заблоковано",
    sellerApproved: "Продавця підтверджено та активовано",
    sellerBanned: "Продавця заблоковано",

    // Inventory modal
    inventoryTitle: "Інвентар: {seller}",
    inventoryDescription: "Керуйте кількістю креслень цього продавця",

    // Blueprints (legacy)
    searchBlueprintsPlaceholder: "Пошук за назвою, ID або slug...",
    availableFilter: "В наявності",
    unavailableFilter: "Відсутні",
    blueprint: "Креслення",
    type: "Тип",
    availableColumn: "Наявність",
    quantityColumn: "Кількість",
    noBlueprints: "Креслення не знайдено за вашим запитом",

    // Stats
    stats: {
      available: "В наявності",
      unavailable: "Немає в наявності",
      total: "Всього",
    },
  },

  // ============================================
  // FOOTER
  // ============================================
  footer: {
    howToBuy: "Як купити",
    step1: "Обери креслення та натисни",
    step1Action: "Купити обране",
    step2: "Введи свій Discord нік та що пропонуєш",
    step3: "Продавець напише тобі в Discord",
    copyright: "© {year} churchukbptrade. Усі права захищено.",
  },

  // ============================================
  // ERROR PAGES
  // ============================================
  errors: {
    notFound: "Сторінку не знайдено",
    notFoundDescription: "Вибачте, сторінка, яку ви шукаєте, не існує.",
    serverError: "Помилка сервера",
    serverErrorDescription: "Сталася помилка. Спробуйте пізніше.",
    goHome: "На головну",
    unauthorized: "Несанкціонований доступ",
    forbidden: "Доступ заборонено",
    noPermission: "У вас немає дозволу на виконання цієї дії",
  },

  // ============================================
  // TELEGRAM MESSAGES (for seller notifications)
  // ============================================
  telegram: {
    newOrder: "НОВЕ ЗАМОВЛЕННЯ",
    multiSeller: "МУЛЬТИ-ПРОДАВЕЦЬ",
    orderId: "Order ID",
    buyerDiscord: "Discord покупця",
    offer: "Пропозиція",
    offerOriginal: "Пропозиція (оригінал)",
    offerDisplayed: "Пропозиція (відображена)",
    notes: "Примітки",
    noNotes: "немає",
    items: "Замовлені позиції",
    summary: "Підсумок",
    itemsAvailable: "{available}/{total} позицій в наявності",
    inStockStatus: "Є в наявності ({qty} шт.)",
    outOfStockStatus: "Немає в наявності ({qty} шт.)",
    sellersInvolved: "Продавців задіяно",
  },
} as const;

// Type for translation keys
export type TranslationKey = string;

/**
 * Simple translation helper
 * Supports nested keys like "common.loading" and interpolation like "{count}"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = uk;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      // Return key if translation not found (helps identify missing translations)
      console.warn(`Translation not found: ${key}`);
      return key;
    }
  }

  if (typeof value !== "string") {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }

  // Handle interpolation
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey]?.toString() ?? `{${paramKey}}`;
    });
  }

  return value;
}

/**
 * Get seller status message in Ukrainian
 */
export function getSellerStatusMessageUk(status: string): string {
  switch (status) {
    case "pending_verification":
      return uk.sellerStatus.pending_verification;
    case "active":
      return uk.sellerStatus.active;
    case "banned":
      return uk.sellerStatus.banned;
    case "disabled":
      return uk.sellerStatus.disabled;
    default:
      return uk.sellerStatus.unknown;
  }
}
