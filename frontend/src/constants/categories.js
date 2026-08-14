export const OTHER_CATEGORY_VALUE = '__other__'

export const EQUIPMENT_CATEGORIES = [
  { value: 'Cameras', label: 'Cameras & Photography' },
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Computers & Accessories', label: 'Computers & Accessories' },
  { value: 'Calculators', label: 'Calculators' },
  { value: 'Lab', label: 'Lab Equipment' },
  { value: 'Tools', label: 'Tools & Hardware' },
  { value: 'Sports', label: 'Sports Gear' },
  { value: 'Books & Study Materials', label: 'Books & Study Materials' },
  { value: 'Musical Instruments', label: 'Musical Instruments' },
  { value: 'Kitchen Gadgets', label: 'Kitchen Gadgets' },
  { value: 'Event & Presentation Equipment', label: 'Event & Presentation Equipment' },
]

export const FIXED_CATEGORY_VALUES = EQUIPMENT_CATEGORIES.map(({ value }) => value)

export const getFixedCategory = (category = '') => {
  const normalizedCategory = category.trim().toLocaleLowerCase()
  return EQUIPMENT_CATEGORIES.find(
    ({ value }) => value.toLocaleLowerCase() === normalizedCategory,
  )
}

export const getCategoryLabel = (category) => (
  getFixedCategory(category)?.label || category
)

export const mergeEquipmentCategories = (discoveredCategories = []) => {
  const fixedKeys = new Set(
    FIXED_CATEGORY_VALUES.map((category) => category.toLocaleLowerCase()),
  )
  const customCategories = new Map()

  discoveredCategories.forEach((category) => {
    const trimmedCategory = typeof category === 'string' ? category.trim() : ''
    const categoryKey = trimmedCategory.toLocaleLowerCase()

    if (trimmedCategory && !fixedKeys.has(categoryKey) && !customCategories.has(categoryKey)) {
      customCategories.set(categoryKey, trimmedCategory)
    }
  })

  return [
    ...FIXED_CATEGORY_VALUES,
    ...Array.from(customCategories.values()).sort((a, b) => a.localeCompare(b)),
  ]
}
