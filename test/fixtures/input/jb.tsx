// Misc
import {
    useRef,
    Fragment,
    useState,
    useEffect,
    type FC,
    type MouseEvent
}                           from 'react';
import cn                   from 'classnames';
import { navigate }         from '@reach/router';
import {
    format,
    endOfMonth
}                           from 'date-fns';
import { FontAwesomeIcon }  from '@fortawesome/react-fontawesome';
import {
    find,
    map
}                           from 'lodash';
// DS
import {
    YpMenu,
    YpInput,
    YpModal,
    YpTooltip,
    YpElement,
    YpDivider,
    useYpModal,
    YpSkeleton,
    YpTypography,
    useYpWrapperContext
} from 'ds';
// @app/dossier
import BulletinAnnulationFormComponent  from '@app/dossier/components/bulletins/salaries/BulletinAnnulationFormComponent';
import { isEqualBulletin }              from '@app/dossier/components/bulletins/utils/bulletin';
import BulletinStatutEnum               from '@app/dossier/models/enums/bulletin/BulletinStatut';
import BulletinPdfStatutEnum            from '@app/dossier/models/enums/bulletin/BulletinPdfStatut';
import BulletinTypeEnum                 from '@app/dossier/models/enums/BulletinType';
import MoisEnum                         from '@app/dossier/models/enums/Mois';
import { useDossierContext }            from '@app/dossier/providers/contexts/DossierContextProvider';
import useGEDListProvider               from '@app/dossier/providers/ged/GEDListProvider';
import useBulletinAnnulationForm        from '@app/dossier/providers/bulletins/BulletinAnnulationFormProvider';
import useBulletinAnnuleList            from '@app/dossier/providers/bulletins/BulletinAnnuleListProvider';
import useBulletinAnnulationList        from '@app/dossier/providers/bulletins/BulletinAnnulationListProvider';
import { moduleRoute as DossierModule } from '@app/dossier/resources/common/Router';
import { getValorisationByPropertyKey } from '@app/dossier/utils/fiche';
import BulletinAnnulationSVG            from '@app/dossier/utils/bulletin/bulletin-annulation.svg?react';
import BulletinAnnuleIcon               from '@app/dossier/utils/bulletin/bulletin-annule.svg?react';
import BulletinAnnulationIcon           from '@app/dossier/utils/bulletin/bulletin-annulation.svg?react';
import BulletinRemplacementIcon         from '@app/dossier/utils/bulletin/bulletin-remplacement.svg?react';
import BulletinComplementaireIcon       from '@app/dossier/utils/bulletin/bulletin-complementaire.svg?react';
import type BulletinPeriodeModel        from '@app/dossier/models/BulletinPeriodeModel';
import type BulletinChronologiqueModel  from '@app/dossier/models/BulletinChronologiqueModel';
import type {
    TBulletinsListByIndCntModel,
    TSalarieWithBulletin,
    TSelectedBulletin
}                                       from '@app/dossier/pages/bulletins/BulletinsPage';
// @core
import { useUserContext }           from '@core/providers/contexts/UserContextProvider';
import type { TDataProviderReturn } from '@core/models/ProviderModel';
// @library
import { getDateFormat }        from '@library/utils/dates';
import { formatLeadingZeros }   from '@library/utils/number';
// @yutils
import { conjugate } from 'yutils/text';