// Misc
import { isWithinInterval }            from 'date-fns';
import {
    find,
    isNaN,
    reduce,
    filter,
    reject,
    orderBy,
    isNumber,
    isString,
    capitalize
}                                      from 'lodash';
import type {
    FieldError,
    FieldErrors,
    RegisterOptions as ValidationRules
}                                      from 'react-hook-form';

// @app/dossier
import { DonneeTypeEnum }                  from '@app/dossier/models/enums/DonneeContextuelle';
import type DonneeContextuelleModel        from '@app/dossier/models/DonneeContextuelleModel';
import type { THistorisationValorisation } from '@app/dossier/models/fiches/HistorisationModel';
import type GroupementModel                from '@app/dossier/models/GroupementModel';
import type RechercheEntrepriseModel       from '@app/dossier/models/RechercheEntrepriseModel';
import type { TAutreEtablissementModel }   from '@app/dossier/models/RechercheEntrepriseModel';
import type { TReferencialModel }          from '@app/dossier/providers/referencial/ReferencialContextProvider';

// @library
import { required }        from '@library/form/providers/validation';
import {
    isStringDate,
    getDateFormat
}                          from '@library/utils/dates';
import { getRoundedValue } from '@library/utils/number';
import type { TFieldType } from '@library/form-new/models/FieldModel';

export const getDCByCodes = (valorisations: THistorisationValorisation[] = [], codes: string[] = []): Record<string, string> =>
    reduce(codes, (result, code) =>
        Object.assign(result, { [code]: find(valorisations, { property_key: code })?.valeurs?.[0] })
    , {} as Record<string, string>);

export const getValorisationByPropertyKey = <T extends THistorisationValorisation[]>(valorisations: T | undefined, dcLibelle: string): string => {
    const valorisation = valorisations?.find((e) => e.property_key === dcLibelle);
    return valorisation ? valorisation.valeurs[0] : 'Pas de valeur';
};

export const getIntValorisationByPropertyKey = <T extends THistorisationValorisation[]>(valorisations: T | undefined, dcLibelle: string): number => {
    const valorisation = valorisations?.find((e) => e.property_key === dcLibelle);
    return valorisation && !isNaN(Number(valorisation.valeurs[0])) ? Number(valorisation.valeurs[0]) : 0;
};

export const datas = (
    historisations: THistorisationValorisation[] = [],
    datas: DonneeContextuelleModel[]
): Record<string, string> => reduce(
    reject(historisations, (valorisation: THistorisationValorisation) =>
        filter(historisations, { property_key: valorisation.property_key })?.length > 1
            ? valorisation.scope !== 'utilisateur'
            : false
    ), (result, valorisation) => {
        const data = find(datas, { code: valorisation.property_key });
        const isNumberType = DonneeTypeEnum.code(valorisation.type_donnee_contextuelle) === 'Numerique';
        const isBooleanType = DonneeTypeEnum.code(valorisation.type_donnee_contextuelle) === 'Booleen';
        return Object.assign(result, {
            [valorisation.property_key]: (
                data?.lien?.is_multiple
                    ? valorisation.valeurs
                    : isBooleanType
                        ? !valorisation.valeurs[0] ? false : valorisation.valeurs[0]
                        : isNumberType && isNumber(Number(valorisation.valeurs[0])) && !isNaN(Number(valorisation.valeurs[0]))
                            ? getRoundedValue(Number(valorisation.valeurs[0]))
                            : valorisation.valeurs[0]
            ) ?? null
        });
    }, {}
);

export const getDonneesContextuellesMapping = (data: RechercheEntrepriseModel|TAutreEtablissementModel): Record<string, string> =>
    reduce(data.mapping_donnees_contextuelles, (result, value, key) =>
        Object.assign(result, { [key]: data[value[0] as keyof (RechercheEntrepriseModel | TAutreEtablissementModel)] }),
    {});

export const getFormattedValue = (value: string): string => {
    if (isStringDate(value, 'server')) {
        return getDateFormat(`${value}`, 'user');
    } else if (value === 'false') {
        return 'Non';
    } else if (value === 'true') {
        return 'Oui';
    } else {
        return value || '-';
    }
};

export const getTypeValue = (type?: number, table_reference_id?: string | null): TFieldType => {
    switch(type) {
    case 1:
        return 'toggle';
    case 2:
        return table_reference_id ? 'selectBlueprint' : 'text';
    case 3:
        return 'date';
    case 4:
        return 'number';
    default:
        return 'text';
    }
};

export const isDCObsolete = (
    dateDebut: string | null | undefined,
    dateFin: string | null | undefined,
    formDateApplication: string
): boolean => !isWithinInterval(new Date(formDateApplication), {
    start: new Date(dateDebut ?? '0001-01-01'),
    end: new Date(dateFin ?? '9999-12-31')
});

export type FieldRules = {
    key: string;
    rules: ValidationRules;
}

export const getListFieldRules = (dcList: DonneeContextuelleModel[]): FieldRules[] =>
    dcList.map((dc) => {
        const fieldRules: FieldRules = {
            key: `donnees_contextuelles.${dc.code}`,
            rules: {
                required: dc.obligatoire ? required : false
            }
        };
        if(isString(dc.regex_validation)) {
            fieldRules.rules.pattern = {
                value: new RegExp(dc.regex_validation),
                message: dc.regex_error_message || 'Le format n\'est pas valide'
            };
        }
        return fieldRules;
    });

const getGroupementByLibelle = (libelle: string, fiche_type: number, referencial?: TReferencialModel,): GroupementModel | null =>
    find(referencial?.groupements?.[fiche_type], { libelle: libelle }) ?? null;

const getGroupementByCode = (code: string, fiche_type: number, referencial?: TReferencialModel,): GroupementModel | null =>
    find(referencial?.groupements?.[fiche_type], { code: code }) ?? null;

export const getDCByGroupement = <T extends string>(
    libelle: T,
    fiche_type: number,
    referencial?: TReferencialModel
): DonneeContextuelleModel[] =>
        orderBy(filter(referencial?.donneesContextuelles?.[fiche_type], {
            groupement_id: getGroupementByLibelle(libelle, fiche_type, referencial)?.id
        }), ['position']);

export const getDCByCodeGroupement = <T extends string>(
    code: T,
    fiche_type: number,
    referencial?: TReferencialModel
): DonneeContextuelleModel[] =>
        orderBy(filter(referencial?.donneesContextuelles?.[fiche_type], {
            groupement_id: getGroupementByCode(code, fiche_type, referencial)?.id
        }), ['position']);

export const isFicheRightTrigramme = (firstDc: string | undefined, trigramme: string): boolean => {
    if (firstDc?.startsWith(trigramme)) {
        return true;
    } else {
        return false;
    }
};

/**
 *
 * @param trigrammeMaster Trigramme de la fiche maitre
 * @param trigrammeSlave Trigramme de la fiche esclave
 * @param master Si la Dc est maitre ou non
 * @returns **xxxLienXxxYyy** - Permet de gérer dynamiquement le nom des Dc lien maitre / esclave ou esclave /maitre
 */

export const getDcLienName = (trigrammeMaster: string, trigrammeSlave: string, master: boolean): string =>
    master
        ? `${trigrammeMaster}Lien${capitalize(trigrammeMaster)}${capitalize(trigrammeSlave)}`
        : `${trigrammeSlave}Lien${capitalize(trigrammeMaster)}${capitalize(trigrammeSlave)}`;
