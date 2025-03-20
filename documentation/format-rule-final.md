# Règles de formatage des imports

## 1. Responsabilités du Parser

Le parser est responsable de l'analyse des imports et de leur organisation en groupes structurés.

### 1.1 Regroupement et ordre des imports

#### 1.1.1 Groupes d'imports
- Les imports sont organisés en groupes configurés (comme "core", "library", "utils", etc.) avec un ordre spécifique
- Les groupes sont identifiés par des commentaires de section (ex: `// Core`)
- Les groupes sont triés selon leur propriété `order` configurée

#### 1.1.2 Ordre à l'intérieur des groupes
- L'ordre exact des imports dans un groupe est :
  1. Autres imports par défaut, triés alphabétiquement
  2. Autres imports nommés, triés alphabétiquement
  3. Autres imports de type par défaut, triés alphabétiquement
  4. Autres imports de type nommés, triés alphabétiquement

#### 1.1.3 Hiérarchie des types d'imports
- La hiérarchie précise des imports est :
  1. Imports à effets de bord (ex: `import 'module';`)
  2. Imports par défaut non-type
  3. Imports nommés non-type
  4. Imports de type par défaut
  5. Imports de type nommés
- Cette hiérarchie s'applique après avoir priorisé les imports React au sein de chaque groupe
- Les imports de type avec plusieurs éléments nommés doivent suivre le format : `import type { ElementA, ElementB } from 'module';`
- Les imports nommés à l'intérieur des accolades doivent être triés alphabétiquement

#### 1.1.4 Cas spécial React
- Les imports React ont toujours la priorité la plus élevée dans leur groupe
- Les imports React suivent strictement cet ordre :
  1. Import par défaut de React (non-type)
  2. Imports React nommés (non-type)
  3. Import de type par défaut de React
  4. Imports de type nommés de React
- Cette règle prévaut sur toutes les autres règles d'ordre alphabétique

#### 1.1.5 Regroupement dynamique des imports
- Les imports correspondant à un modèle de chemin `@app/{sousdossier}/*` sont groupés par sous-dossier
- Ces groupes sont nommés exactement selon le format `// @app/{sousdossier}`
- Les groupes dynamiques sont triés alphabétiquement par nom de sous-dossier (ex: `@app/client` avant `@app/dossier` avant `@app/notification`)
- Au sein de chaque groupe dynamique, les imports suivent toutes les règles standard d'ordre et de formatage (règles 1.1.2 et 1.1.3)
- Pour les groupes avec beaucoup d'imports (comme @app/dossier), les imports peuvent être organisés en considérant aussi la structure du chemin du module, avec les composants triés par sous-chemin (par exemple, les imports de `/components/absences/` ensemble)

#### 1.1.6 Commentaires de section par défaut
- Les imports qui ne correspondent pas aux groupes dynamiques ou prédéfinis sont placés dans un groupe par défaut nommé `// Misc`
- Les imports depuis des bibliothèques de design system (comme 'ds') sont regroupés sous le commentaire de section `// DS`
- Ces commentaires de section sont toujours présents, même s'il n'y a qu'un seul import dans le groupe

### 1.2 Détection des modèles de chemin

Le parser analyse les chemins d'imports pour créer et organiser dynamiquement des groupes basés sur des chemins de modules.

#### 1.2.1 Détection de modèle de chemin
- Le code utilise une expression régulière (`appSubfolderPattern`) pour identifier les imports depuis des chemins qui correspondent à `@app/{sousdossier}/*`

#### 1.2.2 Enregistrement dynamique de groupe
- Lorsqu'un chemin d'import correspondant à ce modèle est trouvé, il extrait le nom du sous-dossier et l'enregistre comme un groupe dynamique:
  ```javascript
  if (appSubfolderMatch?.[1]) {
      const subfolder = appSubfolderMatch[1];
      if (typeof configManager.registerAppSubfolder === 'function') {
          configManager.registerAppSubfolder(subfolder);
      }
  }
  ```

#### 1.2.3 Génération de groupe
- Cela crée des commentaires de section comme `// @app/dossier`, `// @app/client`, etc. basés sur les noms des sous-dossiers

#### 1.2.4 Organisation
- Les imports au sein de ces groupes dynamiques sont ensuite triés selon les mêmes règles que les autres groupes

#### 1.2.5 Configuration
- Ce modèle est configurable via regex. Le code utilise `config.regexPatterns.appSubfolderPattern` pour identifier ces groupes dynamiques
- Dans la configuration, vous devriez pouvoir définir ce modèle regex pour correspondre aux chemins d'imports pour lesquels vous souhaitez créer des groupes dynamiques, par exemple:
  ```javascript
  appSubfolderPattern: /@app\/([^/]+)/
  ```

## 2. Responsabilités du Formatter

Le formatter est responsable de l'alignement et du formatage final des imports après que le parser les ait organisés.

### 2.1 Alignement précis
- Dans chaque groupe, tous les mots-clés `from` doivent être alignés sur la même colonne
- L'espacement entre la fin de la partie import et le mot-clé `from` est réalisé avec des espaces
- L'alignement doit s'adapter à l'import le plus long de chaque groupe individuel
- Lorsqu'un import a plusieurs éléments nommés, l'accolade fermante doit être alignée avec les autres identifiants d'import
- Le calcul exact de l'alignement doit prendre en compte tous les caractères, y compris les accolades et les espaces

### 2.2 Gestion des imports multi-lignes
- Les imports avec plusieurs éléments nommés sur plusieurs lignes doivent être formatés avec :
  - Une accolade ouvrante sur la première ligne
  - Les imports nommés triés alphabétiquement, un par ligne
  - L'accolade fermante sur une ligne séparée, alignée avec les autres identifiants d'import
  - Les espaces nécessaires pour aligner le mot-clé `from` avec les autres imports du groupe

### 2.3 Optimisation des groupements d'imports
- Les imports nommés provenant du même module doivent être regroupés dans un seul statement
- Dans ces regroupements, les imports doivent être triés alphabétiquement
- Les regroupements d'imports doivent suivre le format multi-lignes si le nombre d'imports est supérieur à 3

### 2.4 Annotations de commentaires
- Des annotations peuvent être ajoutées entre parenthèses après le commentaire de section pour clarifier le contenu du groupe
- Exemple: `// Misc (group Misc)`, `// DS (Alphabetical order + group DS + aligned from based on longest length name)`
- Dans des cas complexes, des commentaires multi-lignes peuvent être utilisés pour expliquer le calcul de l'alignement, comme dans le groupe Utils de l'exemple 3

In-fine le parser fournit une structure d'imports hautement organisée et cohérente, puis le formatter s'occupe de l'alignement visuel qui rend le code plus lisible.

## 3. Exemples de formatage

### 3.1 Exemple 1

Input:
```TS
import type { Test } from 'react';
import { useState }  from 'react';
import type Test from 'react';

import { YpButton }  from 'ds';

import React  from 'react';
```

Expected output:
```TS
// Misc
import React          from 'react';
import { useState }   from 'react';
import type Test      from 'react';
import type { Test }  from 'react';

// DS
import { YpButton }  from 'ds';
```

### 3.2 Exemple 2 : Medium

Input:
```TS
// @app/dossier
import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
import AccordFormComponent from '@app/dossier/components/britania/init/AbsenceInitFormComponent';
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
import AbsencesFormComponent from '@app/dossier/components/absences/init/AbsencesFormComponent';
```

Expected output:
```TS
// @app/client
import useUtilisateurSearch  from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';

// @app/dossier
import AbsenceInitFormComponent  from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsencesFormComponent     from '@app/dossier/components/absences/init/AbsencesFormComponent';
import AccordFormComponent       from '@app/dossier/components/britania/init/AbsenceInitFormComponent';

// @app/notification
import { useClientNotification }  from '@app/notification/ClientNotificationProvider';
```

### 3.3 Exemple 3 : Complexe

Input:
```TS
// Misc
import {
    useRef,
    useMemo,
    useState,
    useEffect,
    useCallback,
    Fragment,
    FragmentUse,
}                           from 'react';
import cn                   from 'classnames';
import {
    format,
    getWeek,
    subWeeks,
    addWeeks,
    parseISO,
    endOfDay,
    isBefore,
    isWeekend,
    isSameDay,
    startOfDay,
    startOfMonth,
    lastDayOfWeek,
    lastDayOfMonth,
    differenceInDays,
    isWithinInterval,
    eachDayOfInterval,
    eachWeekOfInterval
}                           from 'date-fns';
import { fr }               from 'date-fns/locale';
import { FontAwesomeIcon }  from '@fortawesome/react-fontawesome';
import {
    map,
    find,
    last,
    first,
    filter,
    orderBy,
    isEmpty
}                           from 'lodash';
import { navigate }         from '@reach/router';
import { v4 as uuidv4  }    from 'uuid';
import type {
    FC,
    ChangeEvent
}                           from 'react';
import {
    createColumnHelper,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable,
    type ColumnDef,
    type Cell
}                           from '@tanstack/react-table';
// DS
import {
    YpInput,
    YpAlert,
    YpButton,
    YpSelect,
    YpElement,
    YpTooltip,
    YpPopover,
    YpSkeleton,
    useYpModal,
    YpFormModal,
    YpTypography,
    YpStepperNew,
    useYpStepper,
    YpConfirmModal,
    YpDataTableTimeline,
    useYpWrapperContext,
    YpTag,
} from 'ds';
// @app/notification
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
// @app/dossier
import AbsenceInitFormComponent                       from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsenceParamFormComponent                      from '@app/dossier/components/absences/param/AbsenceParamFormComponent';
import AbsenceRecapDetailComponent                    from '@app/dossier/components/absences/recap/AbsenceRecapDetailComponent';
import AbsenceRapportComponent                        from '@app/dossier/components/absences/AbsenceRapportComponent';
import AbsenceImportFormComponent                     from '@app/dossier/components/absences/import/AbsenceImportFormComponent';
import AbsenceDsnComponent                            from '@app/dossier/components/absences/dsn/AbsenceDsnComponent';
import SalarieCellRenderer                            from '@app/dossier/components/salaries/SalarieCellRenderer';
import { StatutImportEnum }                           from '@app/dossier/models/RapportImportModel';
import ModeDemarrageAbsenceEnum                       from '@app/dossier/models/enums/ModeDemarrageAbsence';
import NatureEvenementAbsenceEnum                     from '@app/dossier/models/enums/NatureEvenementAbsence';
import StatutRegroupementAbsenceEnum                  from '@app/dossier/models/enums/StatutRegroupementAbsence';
import DsnAtStatut                                    from '@app/dossier/models/enums/DsnAtStatus';
import { AbsenceFilterEnum }                          from '@app/dossier/models/enums/AbsenceFilterEnum';
import GenerationDsnStatutDepot                       from '@app/dossier/models/enums/GenerationDsnStatutDepot';
import RegroupementAbsenceStatutEnum                  from '@app/dossier/models/enums/RegroupementAbsenceStatut';
import useRegroupementAbsenceDetail                   from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import useAbsenceImport                               from '@app/dossier/providers/absences/import/AbsenceImportProvider';
import { useDossierContext }                          from '@app/dossier/providers/contexts/DossierContextProvider';
import useDsnAtListProvider                           from '@app/dossier/providers/dsn/DsnAtListProvider';
import useFichesHistorisationList                     from '@app/dossier/providers/fiches/FichesHistorisationListProvider';
import useRapportImportDetail                         from '@app/dossier/providers/edp/RapportImportDetailProvider';
import useRapportImportLast                           from '@app/dossier/providers/edp/RapportImportLastProvider';
import useDsnAtActionsProvider                        from '@app/dossier/providers/dsn/DsnAtActionsProvider';
import useRegroupementsAbsencesList                   from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import useDsnAtResumeListProvider                     from '@app/dossier/providers/dsn/DsnAtResumeListProvider';
import { moduleRoute as DossierModule }               from '@app/dossier/resources/common/Router';
import type DossierModel                              from '@app/dossier/models/DossierModel';
import type RegroupementAbsenceModel                  from '@app/dossier/models/absences/RegroupementAbsenceModel';
import type SalariesAbsencesListModel                 from '@app/dossier/models/SalariesAbsencesListModel';
import type { TRegroupementAbsenceAdditionals }       from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import type { TRegroupementsAbsencesListAdditionals } from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
// @app/client
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
// @core
import { getLocationId }  from '@core/utils/misc';
import { useUserContext } from '@core/providers/contexts/UserContextProvider';
import type {
    WsDataModel,
    TDataProviderReturn
}                         from '@core/models/ProviderModel';
// @library
import { getDateFormat }      from '@library/utils/dates';
import { getPageStyleHeight } from '@library/utils/styles';
import { useSearch }          from '@library/utils/search';
// Utils
import {
    conjugate,
    getTextPreview
}                     from 'yutils/text';
import { getPalette } from 'yutils/colors';
```

Expected output:
```TS
// Misc (group Misc)
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
}                          from 'react';
import type {
    ChangeEvent,
    FC
}                          from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { navigate }        from '@reach/router';
import {
    createColumnHelper,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable
}                          from '@tanstack/react-table';
import type {
    Cell,
    ColumnDef
}                          from '@tanstack/react-table';
import cn                  from 'classnames';
import {
    addWeeks,
    differenceInDays,
    eachDayOfInterval,
    eachWeekOfInterval,
    endOfDay,
    format,
    getWeek,
    isBefore,
    isSameDay,
    isWeekend,
    isWithinInterval,
    lastDayOfMonth,
    lastDayOfWeek,
    parseISO,
    startOfDay,
    startOfMonth,
    subWeeks
}                          from 'date-fns';
import { fr }              from 'date-fns/locale';
import {
    filter,
    find,
    first,
    isEmpty,
    last,
    map,
    orderBy
}                          from 'lodash';
import { v4 as uuidv4 }    from 'uuid';

// DS (Alphabetical order + group DS + aligned from based on longest length name)
import {
    useYpModal,
    useYpStepper,
    useYpWrapperContext,
    YpAlert,
    YpButton,
    YpConfirmModal,
    YpDataTableTimeline,
    YpElement,
    YpFormModal,
    YpInput,
    YpPopover,
    YpSelect,
    YpSkeleton,
    YpStepperNew,
    YpTag,
    YpTooltip,
    YpTypography
}                        from 'ds';

// @app/client (group @app/client)
import useUtilisateurSearch  from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';

// @app/dossier (Alphabetical order + group @app/dossier + path subfolders alphabetical order order)
import AbsenceRapportComponent                        from '@app/dossier/components/absences/AbsenceRapportComponent';
import AbsenceDsnComponent                            from '@app/dossier/components/absences/dsn/AbsenceDsnComponent';
import AbsenceImportFormComponent                     from '@app/dossier/components/absences/import/AbsenceImportFormComponent';
import AbsenceInitFormComponent                       from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsenceParamFormComponent                      from '@app/dossier/components/absences/param/AbsenceParamFormComponent';
import AbsenceRecapDetailComponent                    from '@app/dossier/components/absences/recap/AbsenceRecapDetailComponent';
import SalarieCellRenderer                            from '@app/dossier/components/salaries/SalarieCellRenderer';
import type RegroupementAbsenceModel                  from '@app/dossier/models/absences/RegroupementAbsenceModel';
import type DossierModel                              from '@app/dossier/models/DossierModel';
import { AbsenceFilterEnum }                          from '@app/dossier/models/enums/AbsenceFilterEnum';
import DsnAtStatut                                    from '@app/dossier/models/enums/DsnAtStatus';
import GenerationDsnStatutDepot                       from '@app/dossier/models/enums/GenerationDsnStatutDepot';
import ModeDemarrageAbsenceEnum                       from '@app/dossier/models/enums/ModeDemarrageAbsence';
import NatureEvenementAbsenceEnum                     from '@app/dossier/models/enums/NatureEvenementAbsence';
import RegroupementAbsenceStatutEnum                  from '@app/dossier/models/enums/RegroupementAbsenceStatut';
import StatutRegroupementAbsenceEnum                  from '@app/dossier/models/enums/StatutRegroupementAbsence';
import { StatutImportEnum }                           from '@app/dossier/models/RapportImportModel';
import type SalariesAbsencesListModel                 from '@app/dossier/models/SalariesAbsencesListModel';
import useAbsenceImport                               from '@app/dossier/providers/absences/import/AbsenceImportProvider';
import useRegroupementAbsenceDetail                   from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import type { TRegroupementAbsenceAdditionals }       from '@app/dossier/providers/absences/RegroupementAbsenceDetailProvider';
import useRegroupementsAbsencesList                   from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import type { TRegroupementsAbsencesListAdditionals } from '@app/dossier/providers/absences/RegroupementsAbsencesListProvider';
import { useDossierContext }                          from '@app/dossier/providers/contexts/DossierContextProvider';
import useDsnAtActionsProvider                        from '@app/dossier/providers/dsn/DsnAtActionsProvider';
import useDsnAtListProvider                           from '@app/dossier/providers/dsn/DsnAtListProvider';
import useDsnAtResumeListProvider                     from '@app/dossier/providers/dsn/DsnAtResumeListProvider';
import useRapportImportDetail                         from '@app/dossier/providers/edp/RapportImportDetailProvider';
import useRapportImportLast                           from '@app/dossier/providers/edp/RapportImportLastProvider';
import useFichesHistorisationList                     from '@app/dossier/providers/fiches/FichesHistorisationListProvider';
import { moduleRoute as DossierModule }               from '@app/dossier/resources/common/Router';

// @app/notification (group @app/notification)
import { useClientNotification } from '@app/notification/ClientNotificationProvider';

// @core (Here from is aligned based on the whole group because of useUserContext length)
import type {
    TDataProviderReturn,
    WsDataModel
}                         from '@core/models/ProviderModel';
import { useUserContext } from '@core/providers/contexts/UserContextProvider';
import { getLocationId }  from '@core/utils/misc';

// @library (group @library)
import { getDateFormat }      from '@library/utils/dates';
import { useSearch }          from '@library/utils/search';
import { getPageStyleHeight } from '@library/utils/styles';

/*
*  Utils (group Utils)
*  Import nommée donc nous faisons ce raisonnement :
*  On parcour les noms des imports par longueur = getTextPreview.length : Ce qui ici nous donne 14 charactère
*  Nous avons ensuite 4 espace d'indentation
*  Sur la ligne on a donc 4 charactère (Parce que on as 3 espaces et une accolade de fermeture `}`)
*  + 1 charactère d'espacement avant from (Toujours)
*  Ce qui nous donne 19 charactères avant "from 'yutils/text'".
*/
import { getPalette } from 'yutils/colors';
import {
    conjugate,
    getTextPreview
}                     from 'yutils/text';
```