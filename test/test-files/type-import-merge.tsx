// Misc
import {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo
} from 'react';
import { get } from 'lodash';

// DS
import { useYpWrapperContext } from 'ds';

// @app/dossier
import FicheTypeEnum from '@app/dossier/models/enums/FicheTypeEnum';
import useHistorisationService from '@app/dossier/services/fiches/HistorisationService';
import type {
    TDynamicSearchItem,
    TDynamicSearchModel
} from '@app/dossier/models/fiches/FicheDynamicSearch';

// @library
import { WsDataModel } from '@library/form-new/models/ProviderModel';
import type {
    TCallParams,
    TDataProviderReturn
} from '@library/form-new/models/ProviderModel';