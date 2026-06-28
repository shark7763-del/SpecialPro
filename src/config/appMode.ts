export type AppMode = 'demo' | 'school_test'

export const appMode: AppMode = import.meta.env.VITE_APP_MODE === 'school_test' ? 'school_test' : 'demo'

export const isSchoolTestMode = appMode === 'school_test'
