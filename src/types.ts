export interface Config {
  // Groupes d'imports (simplifié)
  groups: Array<{
    name: string
    order: number
    isDefault?: boolean
    match: RegExp
  }>

  // Ordre des types d'imports (simplifié et renommé)
  importOrder: {
    default: number    // import X from 'y'
    named: number      // import { X } from 'y' 
    typeOnly: number   // import type { X } from 'y'
    sideEffect: number // import 'x.css'
  }

  // Nouvelles options de formatage
  format: {
    onSave: boolean,
    indent?: number,
    singleQuote?: boolean,
    bracketSpacing?: boolean,
  }

  // Patterns réutilisables
  patterns?: {
    appModules?: RegExp
  }
}

export interface FormattedImportGroup {
  groupName: string
  commentLine: string
  importLines: string[]
}
